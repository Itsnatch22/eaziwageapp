import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const auth = req.headers.get("authorization");

    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/check-api-health`, {
        method: "POST",
    });

    const data = await res.json();
    return NextResponse.json(data);
}