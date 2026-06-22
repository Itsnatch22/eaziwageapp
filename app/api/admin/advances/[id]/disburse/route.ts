import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Deprecated: use /api/admin/advances/[id]/[action] instead' }, { status: 410 });
}
