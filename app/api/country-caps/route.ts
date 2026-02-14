import { db } from "@/lib/database/schema/db";
import { countryCaps } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  const caps = await db.select().from(countryCaps);
  return NextResponse.json(caps);
}

export async function POST(req: Request) {
  const body = await req.json();
  const cap = await db.insert(countryCaps).values(body).returning();
  return NextResponse.json(cap);
}