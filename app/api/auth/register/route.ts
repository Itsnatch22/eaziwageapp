import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createToken, hashToken, isValidTokenFormat } from "@/lib/token";
import sendWelcomeEmail from "@/lib/emails/WelcomeEmail";
import { checkRateLimit, rateLimiter } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/email-validation";
import { getEnv } from "@/env";

// Validate environment variables on startup
const env = getEnv();

const baseSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  recaptchaToken: z.string().min(1, "reCAPTCHA token is required"),
});

const employerSchema = baseSchema.extend({
  role: z.literal("employer"),
  companyName: z.string().min(1, "Company name is required"),
  companySize: z.number().int().min(1).optional(),
  inviteToken: z.string().optional(),
});

const employeeSchema = baseSchema.extend({
  role: z.literal("employee"),
  companyName: z.string().optional(),
  companySize: z.number().optional(),
  inviteToken: z
    .string()
    .min(1, "Invite token is required")
    .refine(isValidTokenFormat, "Invalid invite token format"),
});

const schema = z.discriminatedUnion("role", [employerSchema, employeeSchema]);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify reCAPTCHA token with Google
 */
async function verifyRecaptcha(token: string, ip: string): Promise<{
  success: boolean;
  score?: number;
  error?: string;
}> {
  try {
    const verifyResponse = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${env.RECAPTCHA_SECRET_KEY}&response=${token}&remoteip=${ip}`,
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.success) {
      return {
        success: false,
        error: "reCAPTCHA verification failed",
      };
    }

    // reCAPTCHA v3 score: 0.0 (bot) to 1.0 (human)
    const score = verifyData.score || 0;
    const threshold = 0.5; // Configurable threshold

    if (score < threshold) {
      return {
        success: false,
        score,
        error: `Security score too low (${score.toFixed(2)}). Please try again or contact support.`,
      };
    }

    return { success: true, score };
  } catch (err) {
    console.error("reCAPTCHA verification error:", err);
    return {
      success: false,
      error: "Failed to verify security check",
    };
  }
}

/**
 * Clean up orphaned user if registration fails
 */
async function cleanupOrphanedUser(userId: string) {
  try {
    await supabase.auth.admin.deleteUser(userId);
    console.log(`Cleaned up orphaned user: ${userId}`);
  } catch (err) {
    console.error(`Failed to cleanup orphaned user ${userId}:`, err);
  }
}

export async function POST(req: Request) {
  let userId: string | null = null;

  try {
    // Extract IP address
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "anonymous";

    // Check rate limit
    const rateLimit = await checkRateLimit(rateLimiter, ip);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many registration attempts. Please try again after ${new Date(
            rateLimit.reset
          ).toLocaleTimeString()}`,
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

    // Parse and validate request body
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
          { status: 400, headers: rateLimit.headers }
        );
      }
      throw err;
    }

    // Verify reCAPTCHA
    const recaptchaResult = await verifyRecaptcha(input.recaptchaToken, ip);
    if (!recaptchaResult.success) {
      return NextResponse.json(
        {
          error: recaptchaResult.error || "Security verification failed",
        },
        { status: 400, headers: rateLimit.headers }
      );
    }

    // Enhanced email validation
    const emailValidation = await validateEmail(input.email, true);
    if (!emailValidation.valid) {
      return NextResponse.json(
        {
          error: emailValidation.error,
          suggestion: emailValidation.suggestion,
        },
        { status: 400, headers: rateLimit.headers }
      );
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", input.email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        {
          error: "An account with this email already exists. Please log in instead.",
        },
        { status: 409, headers: rateLimit.headers }
      );
    }

    // Create auth user
    const { data: authUser, error: createErr } =
      await supabase.auth.admin.createUser({
        email: input.email.toLowerCase(),
        password: input.password,
        email_confirm: false, // We'll handle verification manually
      });

    if (createErr) {
      console.error("Failed to create auth user:", createErr);
      return NextResponse.json(
        {
          error:
            createErr.code === "email_exists" ||
            createErr.message.includes("already been registered") ||
            createErr.message === "User already registered"
              ? "An account with this email already exists"
              : "Failed to create account. Please try again.",
        },
        { status: 400, headers: rateLimit.headers }
      );
    }

    userId = authUser.user.id;

    // Handle company/invite logic
    let companyId: string | null = null;

    if (input.role === "employer") {
      if (!input.companyName) {
        await cleanupOrphanedUser(userId);
        return NextResponse.json(
          { error: "Company name is required for employer accounts" },
          { status: 400, headers: rateLimit.headers }
        );
      }

      // Create company
      const { data: comp, error: compError } = await supabase
        .from("companies")
        .insert({
          name: input.companyName,
          size: input.companySize ?? 1,
          created_by: userId,
        })
        .select()
        .single();

      if (compError) {
        console.error("Failed to create company:", compError);
        await cleanupOrphanedUser(userId);
        return NextResponse.json(
          { error: "Failed to create company. Please try again." },
          { status: 500, headers: rateLimit.headers }
        );
      }

      companyId = comp.id;
    } else {
      // Employee - validate invite token
      if (!input.inviteToken) {
        await cleanupOrphanedUser(userId);
        return NextResponse.json(
          {
            error:
              "Invite token is required for employee accounts. Please contact your employer.",
          },
          { status: 400, headers: rateLimit.headers }
        );
      }

      const tokenHash = hashToken(input.inviteToken);

      // Use transaction-like behavior: check and update in one query
      const { data: invite, error: inviteError } = await supabase
        .from("employee_invites")
        .select("*")
        .eq("token_hash", tokenHash)
        .eq("used", false)
        .maybeSingle();

      if (inviteError || !invite) {
        await cleanupOrphanedUser(userId);
        return NextResponse.json(
          {
            error:
              "Invalid or expired invite token. Please request a new one from your employer.",
          },
          { status: 400, headers: rateLimit.headers }
        );
      }

      // Check if invite is expired
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await cleanupOrphanedUser(userId);
        return NextResponse.json(
          {
            error:
              "This invite token has expired. Please request a new one from your employer.",
          },
          { status: 400, headers: rateLimit.headers }
        );
      }

      companyId = invite.company_id;

      // Mark invite as used
      const { error: updateError } = await supabase
        .from("employee_invites")
        .update({ used: true, used_by: userId, used_at: new Date().toISOString() })
        .eq("token_hash", tokenHash);

      if (updateError) {
        console.error("Failed to mark invite as used:", updateError);
        // Continue anyway - user is created
      }
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: input.fullName,
      email: input.email.toLowerCase(),
      role: input.role,
      company_id: companyId,
    });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
      await cleanupOrphanedUser(userId);
      return NextResponse.json(
        { error: "Failed to create user profile. Please try again." },
        { status: 500, headers: rateLimit.headers }
      );
    }

    // Create verification token
    const { token, tokenHash } = createToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    const { error: verifyError } = await supabase
      .from("email_verifications")
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (verifyError) {
      console.error("Failed to create verification token:", verifyError);
      // Don't fail registration, but log it
    }

    // Send welcome email with verification link
    try {
      await sendWelcomeEmail({
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        role: input.role,
        verificationUrl: `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`,
        companyName: input.role === "employer" ? input.companyName : undefined,
      });
    } catch (emailErr) {
      console.error("Failed to send welcome email:", emailErr);
      // Don't fail registration, email can be resent later
    }

    // Return success response
    return NextResponse.json(
      {
        message:
          "Account created successfully! Please check your email to verify your account.",
        redirectTo: "/check-email",
        rateLimit: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
        },
      },
      {
        status: 201,
        headers: rateLimit.headers,
      }
    );
  } catch (err) {
    console.error("Registration error:", err);

    // Clean up orphaned user if we created one
    if (userId) {
      await cleanupOrphanedUser(userId);
    }

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred during registration. Please try again or contact support if the problem persists.",
      },
      { status: 500 }
    );
  }
}