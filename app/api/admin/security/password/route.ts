import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { checkRateLimit, mfaActionLimiter } from "@/lib/rate-limit";
import { CurrentPasswordChangeSchema } from "@/lib/validations/route-schemas";
import { dbErrorResponse } from "@/lib/api-errors";
import { finishPasswordChange, verifyCurrentPassword } from "@/lib/security-password";

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
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many password change attempts. Please wait." },
        { status: 429, headers: rate.headers },
      );
    }

    const pwParsed = CurrentPasswordChangeSchema.safeParse(await req.json().catch(() => null));
    if (!pwParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: pwParsed.error.issues },
        { status: 422 },
      );
    }
    const { currentPassword, newPassword } = pwParsed.data;

    if (!user.email || !(await verifyCurrentPassword(user.email, currentPassword))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
    });

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const followUp = await finishPasswordChange(supabase, user);
    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
      ...followUp,
    });

  } catch (error: unknown) {
    return dbErrorResponse("admin/security/password", error);
  }
}
