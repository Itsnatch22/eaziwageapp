import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, apiLimiter } from "@/lib/rate-limit";
import { hashToken, isTokenExpired, isValidTokenFormat } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEnv } from "@/env";

const env = getEnv();

const schema = z.object({
  token: z
    .string()
    .min(1, "Token is required")
    .refine(isValidTokenFormat, "Invalid token format"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
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
    const rateLimit = await checkRateLimit(apiLimiter, `reset:${ip}`);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many reset attempts. Try again later." },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message ?? "Invalid request", field: issue?.path.join(".") },
        { status: 400, headers: rateLimit.headers }
      );
    }

    const { token, newPassword, recaptchaToken } = parsed.data;

    if (recaptchaToken) {
      const validCaptcha = await verifyRecaptcha(recaptchaToken, ip);
      if (!validCaptcha) {
        return NextResponse.json(
          { error: "Security verification failed" },
          { status: 400, headers: rateLimit.headers }
        );
      }
    }

    const tokenHash = hashToken(token);
    const { data: resetRow, error: resetLookupError } = await supabaseAdmin
      .from("password_resets")
      .select("user_id, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (resetLookupError || !resetRow) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400, headers: rateLimit.headers }
      );
    }

    if (isTokenExpired(resetRow.expires_at)) {
      await supabaseAdmin.from("password_resets").delete().eq("token_hash", tokenHash);
      return NextResponse.json(
        { error: "Reset token has expired. Please request a new one." },
        { status: 400, headers: rateLimit.headers }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      resetRow.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return NextResponse.json(
        { error: "Failed to reset password" },
        { status: 500, headers: rateLimit.headers }
      );
    }

    await supabaseAdmin.from("password_resets").delete().eq("token_hash", tokenHash);

    return NextResponse.json(
      { success: true, message: "Password reset successful." },
      { headers: rateLimit.headers }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
