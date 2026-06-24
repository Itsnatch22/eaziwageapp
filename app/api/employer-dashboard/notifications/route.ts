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

    
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, read, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('[employer/notifications] Fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error: unknown) {
    console.error("Notifications error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function markRead(req: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        // Hook sends { notification_ids: [...] }, legacy callers send { id: string }
        const ids: string[] = body.notification_ids ?? (body.id ? [body.id] : []);

        if (ids.length > 0) {
            await supabase.from('notifications').update({ read: true }).in('id', ids).eq('user_id', user.id);
        } else {
            await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Notifications update error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error updating notifications';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export const PUT = markRead;
export const POST = markRead;

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: "Missing notification ID" }, { status: 400 });

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;


        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Notification delete error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error deleting notification';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

