import { NextResponse } from 'next/server';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const env = getEnv();
    const publicKey = env.VAPID_PUBLIC_KEY || env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    if (!publicKey) {
      return NextResponse.json({ error: 'VAPID public key not configured' }, { status: 500 });
    }
    return NextResponse.json({ publicKey });
  } catch (err) {
    console.error('[push][vapid] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
