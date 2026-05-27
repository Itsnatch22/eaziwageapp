import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'monthly';

  const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const now = new Date();
  const data: Record<string, unknown>[] = [];

  if (period === 'weekly') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = d.toISOString().split('T')[0];
      const { data: day } = await supabase
        .from('advances')
        .select('amount')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'approved')
        .gte('requested_at', `${dayStart}T00:00:00`)
        .lte('requested_at', `${dayStart}T23:59:59`);
      data.push({ name: d.toLocaleDateString('en-US', { weekday: 'short' }), amount: day?.reduce((s: number, a: Record<string, unknown>) => s + Number(a.amount), 0) || 0 });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const { data: month } = await supabase
        .from('advances')
        .select('amount')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'approved')
        .gte('requested_at', m.toISOString())
        .lte('requested_at', end.toISOString());
      data.push({ name: m.toLocaleDateString('en-US', { month: 'short' }), amount: month?.reduce((s: number, a: Record<string, unknown>) => s + Number(a.amount), 0) || 0 });
    }
  }

  return NextResponse.json({ data });
}