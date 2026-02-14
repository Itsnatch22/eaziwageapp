import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, apiLimiter } from "@/lib/rate-limit";
import { hashToken, isTokenExpired, isValidTokenFormat } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  token: z
    .string()
    .min(1, "Token is required")
    .refine(isValidTokenFormat, "Invalid token format"),
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

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(apiLimiter, `verify:${ip}`);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Try again later." },
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

    const tokenHash = hashToken(parsed.data.token);
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from("email_verifications")
      .select("user_id, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (verifyError || !verification) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400, headers: rateLimit.headers }
      );
    }

    if (isTokenExpired(verification.expires_at)) {
      await supabaseAdmin.from("email_verifications").delete().eq("token_hash", tokenHash);
      return NextResponse.json(
        { error: "Verification token has expired. Please request a new one." },
        { status: 400, headers: rateLimit.headers }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", verification.user_id);

    if (profileError) {
      console.error("Failed to update profile verification status:", profileError);
      return NextResponse.json(
        { error: "Failed to verify email" },
        { status: 500, headers: rateLimit.headers }
      );
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      verification.user_id,
      { email_confirm: true }
    );

    if (authError) {
      console.error("Failed to mark auth email as confirmed:", authError);
    }

    await supabaseAdmin.from("email_verifications").delete().eq("token_hash", tokenHash);

    return NextResponse.json(
      { success: true, message: "Email verified successfully." },
      { headers: rateLimit.headers }
    );
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
