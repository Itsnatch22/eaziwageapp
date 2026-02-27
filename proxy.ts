// proxy.ts  (or rename to middleware.ts)
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type UserRole = 'employer' | 'employee' | 'admin';

interface Profile {
  role_normalized: UserRole;
  is_admin?: boolean;
}

// ─── Route Groups ─────────────────────────────────────────────────────────────
const PUBLIC_PATHS = new Set([
  '/',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/admin/admin-login',
  '/admin/admin-signup',
]);

// API routes should not trigger redirects
const isApiRoute = (pathname: string) => pathname.startsWith('/api/');

// Static assets and Next.js internals
const isStaticAsset = (pathname: string) => {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    /\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|eot)$/.test(pathname)
  );
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes and static assets
  if (isApiRoute(pathname) || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // ─── Supabase SSR Client ──────────────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  const isAuthenticated = !sessionError && !!user;

  // ─── Path Categorization ──────────────────────────────────────────────────────
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const isAdminRoute = pathname.startsWith('/admin') && 
                       pathname !== '/admin/admin-login' && 
                       pathname !== '/admin/admin-signup';
  const isEmployerDashboard = pathname.startsWith('/dashboards/employer-dashboard');
  const isEmployeeDashboard = pathname.startsWith('/dashboards/employee-dashboard');
  const isDashboardRoute = isEmployerDashboard || isEmployeeDashboard;
  const isCallbackRoute = pathname === '/callback' || pathname.startsWith('/callback');

  // ─── Case 1: Unauthenticated user trying to access protected route ───────────
  if (!isAuthenticated) {
    // Allow access to public paths
    if (isPublicPath || isCallbackRoute) {
      return response;
    }

    // Redirect to login with return URL for protected routes
    if (isDashboardRoute || isAdminRoute) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // ─── Case 2: Authenticated user - Get profile once ───────────────────────────
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role_normalized, is_admin, email_verified')
    .eq('id', user.id)
    .single<Profile & { email_verified: boolean }>();

  // ─── Case 3: Profile doesn't exist or error ──────────────────────────────────
  if (profileError || !profile) {
    console.error('[Middleware] Profile lookup error:', {
      userId: user.id,
      error: profileError?.message,
      pathname,
    });

    // Allow callback route to handle profile setup
    if (isCallbackRoute) {
      return response;
    }

    // Redirect to callback for profile setup
    const setupUrl = new URL('/callback', request.url);
    setupUrl.searchParams.set('setup', '1');
    setupUrl.searchParams.set('error', 'profile_not_found');
    return NextResponse.redirect(setupUrl);
  }

  const userRole = profile.role_normalized;
  const isAdmin = profile.is_admin === true || userRole === 'admin';

  // ─── Case 4: Email not verified ──────────────────────────────────────────────
  // Allow access to verification and logout routes
  if (!profile.email_verified && !pathname.startsWith('/verify-email') && !isCallbackRoute) {
    const verifyUrl = new URL('/verify-email', request.url);
    return NextResponse.redirect(verifyUrl);
  }

  // ─── Case 5: Admin route protection ──────────────────────────────────────────
  if (isAdminRoute) {
    if (!isAdmin) {
      // Non-admin trying to access admin route
      const dashboardUrl = userRole === 'employer'
        ? '/dashboards/employer-dashboard'
        : '/dashboards/employee-dashboard';
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }
    // Admin has access
    return response;
  }

  // ─── Case 6: Authenticated user on public paths (login/register) ─────────────
  if (isPublicPath && !isCallbackRoute) {
    // Redirect to appropriate dashboard based on role
    const dashboardUrl = isAdmin
      ? '/admin'
      : userRole === 'employer'
      ? '/dashboards/employer-dashboard'
      : '/dashboards/employee-dashboard';

    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // ─── Case 7: Role-based dashboard access control ─────────────────────────────
  if (isDashboardRoute) {
    // Employer trying to access employee dashboard
    if (isEmployeeDashboard && userRole === 'employer') {
      return NextResponse.redirect(
        new URL('/dashboards/employer-dashboard', request.url)
      );
    }

    // Employee trying to access employer dashboard
    if (isEmployerDashboard && userRole === 'employee') {
      return NextResponse.redirect(
        new URL('/dashboards/employee-dashboard', request.url)
      );
    }

    // Admin can access any dashboard, but redirect them to admin panel preferably
    if (isAdmin && !pathname.startsWith('/admin')) {
      // Allow admins to view dashboards for testing, but you could redirect:
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // ─── Case 8: All checks passed, allow access ─────────────────────────────────
  return response;
}

// ─── Matcher ──────────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, fonts, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};