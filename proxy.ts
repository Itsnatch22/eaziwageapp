import { NextRequest, NextResponse } from 'next/server';
import { createServerClient }        from '@supabase/ssr';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'employer' | 'employee';

interface Profile {
  role: UserRole;
}

// ─── Route groups ─────────────────────────────────────────────────────────────

/** Routes accessible without authentication */
const PUBLIC_PATHS = new Set([
  '/',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  'https://eaziwage.com/terms.pdf',
  'https://eaziwage.com/data.pdf',
]);

/** Auth routes — redirect already-signed-in users away from these */
const AUTH_ONLY_PATHS = new Set(['/', '/register', '/forgot-password']);

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const res      = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Create SSR-aware Supabase client that reads/writes cookies correctly
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user    = session?.user ?? null;
  const isAuth  = user !== null;

  const isPublic           = PUBLIC_PATHS.has(pathname);
  const isAuthOnly         = AUTH_ONLY_PATHS.has(pathname);
  const isEmployerDashboard = pathname.startsWith('/dashboard/employer-dashboard');
  const isEmployeeDashboard = pathname.startsWith('/dashboard/employee-dashboard');
  const isDashboard         = isEmployerDashboard || isEmployeeDashboard;
  const isOnboarding        = pathname.startsWith('/dashboard/employer-dashboard/onboarding') ||
                              pathname.startsWith('/dashboard/employee-dashboard/onboarding');

  // ── Unauthenticated user tries to access a protected route ──────────────────
  if (!isAuth && (isDashboard || isOnboarding)) {
    const loginUrl = new URL('/', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Authenticated user tries to access an auth-only route ───────────────────
  // (e.g. hits /login after already being signed in)
  if (isAuth && isAuthOnly) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single<Profile>();

    const destination =
      profile?.role === 'employer'
        ? '/dashboard/employer-dashboard'
        : '/dashboard/employee-dashboard';

    return NextResponse.redirect(new URL(destination, req.url));
  }

  // ── Role-based dashboard guard ───────────────────────────────────────────────
  if (isAuth && isDashboard) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single<Profile>();

    const role = profile?.role;

    if (isEmployerDashboard && role !== 'employer') {
      return NextResponse.redirect(new URL('/dashboard/employee-dashboard', req.url));
    }

    if (isEmployeeDashboard && role !== 'employee') {
      return NextResponse.redirect(new URL('/dashboard/employer-dashboard', req.url));
    }
  }

  return res;
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - Public asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};