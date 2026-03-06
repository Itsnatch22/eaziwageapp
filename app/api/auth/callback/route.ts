import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in search params, use it as the redirection URL
  const next = searchParams.get('next') ?? '/';
  const role = searchParams.get('role') ?? 'employee';

  if (code) {
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Check if user has a profile, if not create one as employee
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, role_normalized')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        // Create default profile for employee
        await supabaseAdmin
          .from('profiles')
          .insert({
            id: data.user.id,
            full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'User',
            email: data.user.email,
            role: role,
            role_normalized: role,
            email_verified: true,
            created_at: new Date().toISOString(),
          });
      }

      // Redirect to the appropriate dashboard
      const userRole = profile?.role_normalized || profile?.role || role;
      let destination = next;
      if (next === '/') {
        if (userRole === 'admin') destination = '/admin';
        else if (userRole === 'employer') destination = '/dashboards/employer-dashboard';
        else destination = '/dashboards/employee-dashboard';
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/?error=AuthCallbackError`);
}
