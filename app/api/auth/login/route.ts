import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit, rateLimiter } from "@/lib/rate-limit";
import { z } from "zod";
import {
  checkAccountLock,
  recordFailedLogin,
  recordSuccessfulLogin,
  formatLockoutTime,
} from "@/lib/failed-logins";
import {
  sendAccountLockedEmail,
  sendLoginNotification,
} from "@/lib/security-alerts";
import { getEnv } from "@/env";

// Validate environment on startup
const env = getEnv();

/* ================================
   Validation Schema
================================ */
const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  rememberMe: z.boolean().default(false),
  recaptchaToken: z.string().min(1, "Security verification required"),
});

/* ================================
   Helper: Extract IP and User Agent
================================ */
function getClientInfo(req: Request): { ip: string; userAgent: string } {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip"); // Cloudflare
  
  const ip = cfConnectingIp || forwarded?.split(",")[0]?.trim() || realIp || "anonymous";
  const userAgent = req.headers.get("user-agent") || "Unknown";

  return { ip, userAgent };
}

/* ================================
   Helper: Verify reCAPTCHA
================================ */
async function verifyRecaptcha(
  token: string,
  ip: string
): Promise<{
  success: boolean;
  score?: number;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const verifyRes = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: env.RECAPTCHA_SECRET_KEY,
          response: token,
          remoteip: ip,
        }).toString(),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    const verifyData = await verifyRes.json();
    const score = verifyData.score ?? 0;

    if (!verifyData.success) {
      return {
        success: false,
        error: "Security verification failed",
      };
    }

    // Configurable threshold (0.6 is stricter, 0.5 is common)
    const threshold = parseFloat(process.env.RECAPTCHA_THRESHOLD || "0.6");
    
    if (score < threshold) {
      return {
        success: false,
        score,
        error: `Security score too low (${score.toFixed(2)}). Please try again or contact support if you continue to have issues.`,
      };
    }

    return { success: true, score };
  } catch (err) {
    console.error("reCAPTCHA verification error:", err);
    return {
      success: false,
      error: "Security verification service unavailable. Please try again in a moment.",
    };
  }
}

/* ================================
   POST /api/auth/login
================================ */
export async function POST(req: Request) {
  const { ip, userAgent } = getClientInfo(req);

  try {
    /* ================================
       1. Parse and validate input
    ================================= */
    const body = await req.json();
    
    let input;
    try {
      input = schema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const firstError = err.issues[0];
        return NextResponse.json(
          {
            error: firstError.message,
            field: firstError.path.join("."),
          },
          { status: 400 }
        );
      }
      throw err;
    }

    const { email, password, rememberMe, recaptchaToken } = input;

    /* ================================
       2. Check account lockout
    ================================= */
    const lockStatus = await checkAccountLock(email);
    
    if (lockStatus.isLocked) {
      const remainingTime = lockStatus.remainingTime || 0;
      const timeString = formatLockoutTime(remainingTime);

      return NextResponse.json(
        {
          error: `Account temporarily locked due to multiple failed login attempts. Please try again in ${timeString}.`,
          locked: true,
          remainingTime,
          suggestion: "Forgot your password? You can reset it instead.",
        },
        { status: 423 } // 423 Locked
      );
    }

    /* ================================
       3. Rate limiting (IP based)
    ================================= */
    const rateLimit = await checkRateLimit(rateLimiter, ip);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many login attempts from your network. Please try again after ${new Date(
            rateLimit.reset
          ).toLocaleTimeString()}.`,
          rateLimit: {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            reset: rateLimit.reset,
          },
        },
        {
          status: 429,
          headers: rateLimit.headers,
        }
      );
    }

    /* ================================
       4. reCAPTCHA verification
    ================================= */
    const recaptchaResult = await verifyRecaptcha(recaptchaToken, ip);
    
    if (!recaptchaResult.success) {
      await recordFailedLogin(email, ip, userAgent, "invalid_password");
      return NextResponse.json(
        {
          error: recaptchaResult.error || "Security verification failed",
        },
        { 
          status: 400,
          headers: rateLimit.headers,
        }
      );
    }

    /* ================================
       5. Create Supabase client
    ================================= */
    const cookieStore = await cookies();

    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    /* ================================
       6. Authenticate user
    ================================= */
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (authError || !data.user || !data.session) {
      // Record failed login attempt
      await recordFailedLogin(
        email,
        ip,
        userAgent,
        authError?.message.includes("not found") ? "user_not_found" : "invalid_password"
      );

      // Check if this failure caused a lockout
      const newLockStatus = await checkAccountLock(email);
      
      if (newLockStatus.isLocked && !lockStatus.isLocked) {
        // Account just got locked - send notification
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("email", email.toLowerCase())
          .single();

        if (profile) {
          await sendAccountLockedEmail(
            email,
            profile.full_name,
            15, // lockout duration in minutes
            {
              ip,
              userAgent,
              timestamp: new Date(),
            }
          );
        }

        const remainingTime = newLockStatus.remainingTime || 0;
        const timeString = formatLockoutTime(remainingTime);

        return NextResponse.json(
          {
            error: `Too many failed attempts. Your account has been locked for ${timeString}. Check your email for unlock instructions.`,
            locked: true,
            remainingTime,
          },
          { 
            status: 423,
            headers: rateLimit.headers,
          }
        );
      }

      // Return generic error (don't reveal if user exists)
      const attemptsRemaining = 5 - (lockStatus.failedAttempts + 1);
      const showWarning = attemptsRemaining <= 2 && attemptsRemaining > 0;

      return NextResponse.json(
        {
          error: "Email or password is incorrect",
          suggestion: "Forgot your password? Reset it here",
          resetLink: "/forgot-password",
          ...(showWarning && {
            warning: `${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining before account lockout`,
          }),
        },
        { 
          status: 401,
          headers: rateLimit.headers,
        }
      );
    }

    /* ================================
       7. Fetch user profile
    ================================= */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, full_name, email_verified")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await recordFailedLogin(email, ip, userAgent, "user_not_found");
      return NextResponse.json(
        {
          error: "User profile not found. Please contact support.",
        },
        { 
          status: 500,
          headers: rateLimit.headers,
        }
      );
    }

    /* ================================
       8. Check email verification
    ================================= */
    if (!profile.email_verified) {
      return NextResponse.json(
        {
          error: "Please verify your email address before logging in",
          action: "resend_verification",
          suggestion: "Check your inbox for the verification email, or request a new one",
        },
        { 
          status: 403,
          headers: rateLimit.headers,
        }
      );
    }

    /* ================================
       9. Set session with custom duration
    ================================= */
    const maxAge = rememberMe
      ? 30 * 24 * 60 * 60 // 30 days
      : 24 * 60 * 60; // 24 hours (increased from 1 hour for better UX)

    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    /* ================================
       10. Record successful login
    ================================= */
    await recordSuccessfulLogin(data.user.id, email, ip, userAgent);

    /* ================================
       11. Send login notification (optional - for new devices)
    ================================= */
    // TODO: Implement device fingerprinting to detect new devices
    // For now, we can send notifications for all logins or skip this
    // Uncomment below to send notification on every login:
    // await sendLoginNotification(
    //   email,
    //   profile.full_name,
    //   { ip, userAgent, timestamp: new Date() },
    //   false // isNewDevice - would need device fingerprinting
    // );

    /* ================================
       12. Determine redirect
    ================================= */
    const redirectTo =
      profile.role === "employer"
        ? "/dashboard/employer-dashboard"
        : "/dashboard/employee-dashboard";

    /* ================================
       13. Success response
    ================================= */
    return NextResponse.json(
      {
        success: true,
        redirectTo,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: profile.role,
        },
        rateLimit: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
        },
      },
      {
        status: 200,
        headers: rateLimit.headers,
      }
    );
  } catch (err) {
    console.error("Login error:", err);
    
    // Log the error for monitoring
    // TODO: Send to error tracking service (e.g., Sentry)

    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again or contact support if the problem persists.",
      },
      { status: 500 }
    );
  }
}