import { NextResponse } from 'next/server';

export async function POST() {
  // Deprecated duplicate endpoint. Use /api/admin/advances/[id]/[action] instead.
  return NextResponse.json({ error: 'Deprecated: use /api/admin/advances/[id]/[action] instead' }, { status: 410 });
}
