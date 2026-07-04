import { NextResponse } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    if (!isValidCronAuth(req.headers.get("authorization"))) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/check-api-health`, {
        method: "POST",
    });

    const data = await res.json();
    return NextResponse.json(data);
}