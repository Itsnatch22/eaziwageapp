import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL('/login', req.url));

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role ?? null;

    if (role === 'admin' || role === 'super_admin' || role === 'compliance' || role === 'employer_admin') {
      return NextResponse.redirect(new URL('/admin/settings', req.url));
    }

    if (role === 'employer') {
      return NextResponse.redirect(new URL('/dashboards/employer-dashboard/settings', req.url));
    }

    // default -> employee settings
    return NextResponse.redirect(new URL('/dashboards/employee-dashboard/settings', req.url));
  } catch (err) {
    console.error('[security route] redirect error', err);
    return NextResponse.redirect(new URL('/', req.url));
  }
}
