import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import pusherServer from "@/lib/pusher-server";

export const runtime = "nodejs";

/**
 * GET /api/messages?with=USER_ID
 * Fetch conversation with a specific user
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const otherUserId = searchParams.get('with');

        if (!otherUserId) {
            return NextResponse.json({ error: "Missing other user ID" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (err) {
        console.error('[GET /api/messages]', err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

/**
 * POST /api/messages
 * Send a message
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { receiver_id, content, metadata } = body;

        if (!receiver_id || !content) {
            return NextResponse.json({ error: "Receiver and content required" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('messages')
            .insert({
                sender_id: user.id,
                receiver_id,
                content,
                metadata: metadata || {},
                is_read: false
            })
            .select()
            .single();

        if (error) throw error;

        // Trigger Pusher for receiver
        await pusherServer.trigger(`user-${receiver_id}-messages`, 'new-message', data);
        // Trigger Pusher for sender (to sync multiple tabs)
        await pusherServer.trigger(`user-${user.id}-messages`, 'new-message', data);

        return NextResponse.json(data);
    } catch (err) {
        console.error('[POST /api/messages]', err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

/**
 * DELETE /api/messages/:id
 * Delete a message (implementation usually handles via params if folder structure used, 
 * but for this shared route let's handle via body or searchParams for simplicity if needed)
 */
export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: "Missing message ID" }, { status: 400 });

        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', id)
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

        if (error) throw error;

        // Trigger real-time deletion
        // We need metadata to know who to notify about deletion
        // For simplicity, usually we just notify the requester
        
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
