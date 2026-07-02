import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { mfaActionLimiter, checkRateLimit } from "@/lib/rate-limit";
import { PasswordChangeSchema } from "@/lib/validations/route-schemas";
import { dbErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = await checkRateLimit(mfaActionLimiter, `password-change:${user.id}`);
    if (!rate.success) return NextResponse.json({ error: "Too many password change attempts. Please wait." }, { status: 429 });

    const pwParsed = PasswordChangeSchema.safeParse(await req.json().catch(() => null));
    if (!pwParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: pwParsed.error.issues },
        { status: 422 },
      );
    }
    const { newPassword } = pwParsed.data;

    const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
    });

    if (updateError) {
        console.error("[password-change] updateUser error:", { userId: user.id, message: updateError.message });
        return NextResponse.json({ error: "Failed to update password" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" });

  } catch (error: unknown) {
    return dbErrorResponse('employee-dashboard/security/password', error);
  }
}
