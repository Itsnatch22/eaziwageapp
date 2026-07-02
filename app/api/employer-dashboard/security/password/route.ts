import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
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
        return dbErrorResponse('employer-dashboard/security/password', updateError, 'Failed to update password', 400);
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" });

  } catch (error: unknown) {
    return dbErrorResponse('employer-dashboard/security/password', error);
  }
}
