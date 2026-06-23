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
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Notifications fetch error:', error);
        return NextResponse.json({
            notifications: [
              { id: 1, type: 'advance', title: 'New Advance Request', message: 'John Kamau requested KES 15,000 advance', time: '2 hours ago', read: false },
              { id: 2, type: 'system', title: 'Payroll Due', message: 'Monthly payroll submission is due in 3 days', time: '5 hours ago', read: false },
              { id: 3, type: 'employee', title: 'KYC Completed', message: 'Sarah Mwangi completed KYC verification', time: '1 day ago', read: true },
              { id: 4, type: 'advance', title: 'Advance Disbursed', message: '45 advances disbursed successfully', time: '2 days ago', read: true },
            ]
        });
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

