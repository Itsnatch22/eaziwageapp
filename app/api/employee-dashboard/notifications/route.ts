import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import pusherServer from "@/lib/pusher-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[notifications GET] Auth error:', authError);
      return NextResponse.json({ error: "Authentication error" }, { status: 401 });
    }
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
      console.error('[notifications GET] Database error:', error);
      return NextResponse.json({ error: "Failed to fetch notifications", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error: unknown) {
    console.error('[notifications GET] Unexpected error:', error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('[notifications PUT] Auth error:', authError);
          return NextResponse.json({ error: "Authentication error" }, { status: 401 });
        }
        
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        
        let body: { id?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        const { id } = body;

        if (id) {
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id)
                .eq('user_id', user.id);
            
            if (updateError) {
                console.error('[notifications PUT] Update error:', updateError);
                return NextResponse.json({ error: "Failed to update notification", details: updateError.message }, { status: 500 });
            }
        } else {
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);
            
            if (updateError) {
                console.error('[notifications PUT] Bulk update error:', updateError);
                return NextResponse.json({ error: "Failed to mark all as read", details: updateError.message }, { status: 500 });
            }
        }
        
        return NextResponse.json({ success: true });
    } catch(err: unknown) {
        console.error('[notifications PUT] Unexpected error:', err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: "Error updating notifications", details: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('[notifications DELETE] Auth error:', authError);
          return NextResponse.json({ error: "Authentication error" }, { status: 401 });
        }
        
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('[notifications DELETE] Delete error:', error);
            return NextResponse.json({ error: "Failed to delete notification", details: error.message }, { status: 500 });
        }

        try {
            await pusherServer.trigger(`user-${user.id}`, 'notification-deleted', { id });
        } catch (pusherErr) {
            console.error('[notifications DELETE] Pusher error:', pusherErr);
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('[notifications DELETE] Unexpected error:', err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: "Error deleting notification", details: message }, { status: 500 });
    }
}
