import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";

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

    // Get user's notification preferences from profiles table or a dedicated preferences table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // Return default preferences if none exist
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
    console.error("Get notification preferences error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
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

    const { emailAlerts, pushNotifications } = await req.json();

    // Validate input
    if (typeof emailAlerts !== 'boolean' || typeof pushNotifications !== 'boolean') {
      return NextResponse.json({ error: "Invalid preferences format" }, { status: 400 });
    }

    const preferences = {
      emailAlerts,
      pushNotifications
    };

    // Update user's notification preferences
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
    console.error("Update notification preferences error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
