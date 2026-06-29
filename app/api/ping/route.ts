import { NextResponse } from 'next/server';

// Public health-check endpoint — no auth required.
// Used by useNetworkStatus to verify server reachability without needing admin access.
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
