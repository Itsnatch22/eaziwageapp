import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, resendLimiter } from "@/lib/rate-limit";
import { createToken } from "@/lib/token";
import { sendResetEmail } from "@/lib/emails";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEnv } from "@/env";

const env = getEnv();

const schema = z.object({
  email: z.string().email("Invalid email address"),
  redirectTo: z.string().url().optional(),
  recaptchaToken: z.string().min(1).optional(),
});

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "anonymous"
  );
}

async function verifyRecaptcha(token: string, ip: string) {
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.RECAPTCHA_SECRET_KEY,
      response: token,
      remoteip: ip,
    }).toString(),
  });

  const data = await response.json();
  if (!data.success) return false;

  const score = data.score ?? 1;
  const threshold = Number(process.env.RECAPTCHA_THRESHOLD ?? "0.5");
  return score >= threshold;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message ?? "Invalid request", field: issue?.path.join(".") },
        { status: 400 }
      );
    }

    const { email, recaptchaToken } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const ipLimit = await checkRateLimit(resendLimiter, ip);
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: ipLimit.headers }
      );
    }

    const emailLimit = await checkRateLimit(resendLimiter, `forgot:${normalizedEmail}`);
    if (!emailLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: emailLimit.headers }
      );
    }

    if (recaptchaToken) {
      const validCaptcha = await verifyRecaptcha(recaptchaToken, ip);
      if (!validCaptcha) {
        return NextResponse.json(
          { error: "Security verification failed" },
          { status: 400, headers: ipLimit.headers }
        );
      }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email_verified")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // Always return generic success to avoid account enumeration.
    if (!profile) {
      return NextResponse.json(
        {
          success: true,
          message:
            "If an account exists for that email, we sent a password reset link. Check your inbox.",
        },
        { headers: ipLimit.headers }
      );
    }

    const { token, tokenHash } = createToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

    const { error: insertError } = await supabaseAdmin.from("password_resets").insert({
      user_id: profile.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Failed to create password reset token:", insertError);
      return NextResponse.json(
        { error: "Unable to process password reset right now" },
        { status: 500, headers: ipLimit.headers }
      );
    }

    try {
      await sendResetEmail(normalizedEmail, token);
    } catch (emailErr) {
      console.error("Failed to send reset email:", emailErr);
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "If an account exists for that email, we sent a password reset link. Check your inbox.",
      },
      { headers: ipLimit.headers }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
