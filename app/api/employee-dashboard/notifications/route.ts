import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { dbErrorResponse } from "@/lib/api-errors";

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
        .select('id, user_id, title, message, type, read, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
      return dbErrorResponse('employee-dashboard/notifications', error, "Failed to fetch notifications");
    }

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error: unknown) {
    return dbErrorResponse('employee-dashboard/notifications', error);
  }
}

async function markRead(req: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
          console.error('[notifications] Auth error:', authError);
          return NextResponse.json({ error: "Authentication error" }, { status: 401 });
        }

        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json().catch(() => ({}));
        // Hook sends { notification_ids: [...] }, legacy callers send { id: string }
        const ids: string[] = body.notification_ids ?? (body.id ? [body.id] : []);

        if (ids.length > 0) {
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ read: true })
                .in('id', ids)
                .eq('user_id', user.id);

            if (updateError) {
                return dbErrorResponse('employee-dashboard/notifications/markRead', updateError, "Failed to update notification");
            }
        } else {
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);

            if (updateError) {
                return dbErrorResponse('employee-dashboard/notifications/markRead', updateError, "Failed to mark all as read");
            }
        }

        return NextResponse.json({ success: true });
    } catch(err: unknown) {
        return dbErrorResponse('employee-dashboard/notifications/markRead', err, "Error updating notifications");
    }
}

export const PUT = markRead;
export const POST = markRead;

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
        const all = searchParams.get('all') === 'true';

        if (!id && !all) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const query = all
            ? supabase.from('notifications').delete().eq('user_id', user.id)
            : supabase.from('notifications').delete().eq('id', id!).eq('user_id', user.id);

        const { error } = await query;

        if (error) {
            return dbErrorResponse('employee-dashboard/notifications/delete', error, "Failed to delete notification");
        }



        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return dbErrorResponse('employee-dashboard/notifications/delete', err, "Error deleting notification");
    }
}
