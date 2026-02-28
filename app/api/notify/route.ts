import { NextResponse } from "next/server";
import pusherServer from "@/lib/pusher-server";

export async function POST(request: Request) {
    const { channel, event, data } = await request.json();

    await pusherServer.trigger(channel, event, data);

    return NextResponse.json({ success: true });
}