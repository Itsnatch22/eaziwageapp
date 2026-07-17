import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Server-side proxy for Nominatim reverse geocoding. Nominatim's public
// instance never sends an Access-Control-Allow-Origin header (confirmed by
// hand, with and without an Origin header present), so a direct client-side
// fetch() to it is silently blocked by the browser's CORS policy every
// time — that's why "Use my current location" (employer and employee
// onboarding) appeared to fail at detecting location: geolocation itself
// succeeds, but the address lookup that follows it never gets a readable
// response. A server-to-server request has no such restriction, and can
// also set a real User-Agent identifying the app, which Nominatim's usage
// policy asks for and which browser fetch() can never set (it's a
// forbidden header client-side).
export async function GET(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('cf-connecting-ip') ?? '0.0.0.0').trim();
  const rate = await checkRateLimit(apiLimiter, `geocode-reverse:${ip}`);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'Invalid lat/lon' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'EaziWage/1.0 (https://eaziwage.com; onboarding address lookup)',
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 502 });
    }

    const geo = await res.json() as { address?: Record<string, string> };
    return NextResponse.json({ address: geo.address ?? {} });
  } catch {
    return NextResponse.json({ error: 'Geocoding request failed' }, { status: 502 });
  }
}
