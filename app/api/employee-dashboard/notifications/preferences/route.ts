import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { EmployeeNotificationPrefsSchema } from "@/lib/validations/route-schemas";
import { dbErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({
        emailAlerts: true,
        pushNotifications: true
      });
    }

    const preferences = profile.notification_preferences || {
      emailAlerts: true,
      pushNotifications: true
    };

    return NextResponse.json(preferences);

  } catch (error: unknown) {
    return dbErrorResponse('employee-dashboard/notifications/preferences', error);
  }
}

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

    const prefParsed = EmployeeNotificationPrefsSchema.safeParse(await req.json().catch(() => null));
    if (!prefParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: prefParsed.error.issues },
        { status: 422 },
      );
    }
    const { emailAlerts, pushNotifications } = prefParsed.data;

    if (typeof emailAlerts !== 'boolean' || typeof pushNotifications !== 'boolean') {
      return NextResponse.json({ error: "Invalid preferences format" }, { status: 400 });
    }

    const preferences = {
      emailAlerts,
      pushNotifications
    };
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        notification_preferences: preferences,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update preferences" }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Notification preferences updated successfully",
      preferences 
    });

  } catch (error: unknown) {
    return dbErrorResponse('employee-dashboard/notifications/preferences', error);
  }
}
