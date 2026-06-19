import { NextResponse } from "next/server";

export async function PATCH() {
  // Deprecated endpoint — removed for security. Use authenticated admin routes instead.
  return NextResponse.json({ error: 'Deprecated endpoint. Use authenticated admin routes.' }, { status: 410 });
}
