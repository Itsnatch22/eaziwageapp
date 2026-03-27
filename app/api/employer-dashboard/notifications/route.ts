import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import pusherServer from "@/lib/pusher-server";


export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
        
        const { id } = await req.json();

        if (id) {
            await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id);
        } else {
            await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
        }
        
        return NextResponse.json({ success: true });
    } catch(err) {
        return NextResponse.json({ error: "Error updating notifications" }, { status: 500 });
    }
}

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

        await pusherServer.trigger(`employer-${user.id}`, 'notification-deleted', { id });

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: "Error deleting notification" }, { status: 500 });
    }
}

