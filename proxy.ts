import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type UserRole = 'employer' | 'employee' | 'admin';

interface Profile {
  role_normalized: UserRole;
  is_admin?: boolean;
  email_verified: boolean;
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

// ─── Helper Functions ─────────────────────────────────────────────────────────

// Check if path should skip middleware (API or static assets)
function isSkippedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    /\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|eot)$/.test(pathname)
  );
}

// Categorize the pathname
function categorizePath(pathname: string) {
  return {
    isPublic: PUBLIC_PATHS.has(pathname),
    isAdmin: pathname.startsWith('/admin') && 
             pathname !== '/admin/admin-login' && 
             pathname !== '/admin/admin-signup',
    isEmployerDashboard: pathname.startsWith('/dashboards/employer-dashboard'),
    isEmployeeDashboard: pathname.startsWith('/dashboards/employee-dashboard'),
  };
}

// Create Supabase SSR client
function createSupabaseClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
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
}

// Create Supabase admin client
function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Fetch user profile from appropriate table
async function fetchUserProfile(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  isAdminPath: boolean
): Promise<Profile | null> {
  const table = isAdminPath ? 'system_admins' : 'profiles';
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('role_normalized, is_admin, email_verified') // Added email_verified to select
    .eq('id', userId)
    .single<Profile>();

  if (error) {
    console.error('[Middleware] Profile lookup error:', {
      userId,
      error: error.message,
      table,
    });
    return null;
  }

  return data;
}

// Determine redirect URL based on role and admin status
function getDashboardRedirectUrl(userRole: UserRole, isAdmin: boolean): string {
  if (isAdmin) return '/admin';
  return userRole === 'employer'
    ? '/dashboards/employer-dashboard'
    : '/dashboards/employee-dashboard';
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Early return for skipped paths
  if (isSkippedPath(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create Supabase clients
  const supabase = createSupabaseClient(request, response);
  const supabaseAdmin = createSupabaseAdminClient();

  // Get user session
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  const isAuthenticated = !sessionError && !!user;

  // Path categorization
  const { isPublic, isAdmin, isEmployerDashboard, isEmployeeDashboard } = categorizePath(pathname);
  const isDashboard = isEmployerDashboard || isEmployeeDashboard;

  // ─── Unauthenticated User Handling ────────────────────────────────────────────
  if (!isAuthenticated) {
    if (isPublic) {
      return response;
    }

    if (isDashboard || isAdmin) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // ─── Authenticated User - Fetch Profile ───────────────────────────────────────
  const profile = await fetchUserProfile(supabaseAdmin, user!.id, isAdmin);

  if (!profile) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const userRole = profile.role_normalized;
  const isAdminUser = profile.is_admin === true || userRole === 'admin';

  // ─── Email Verification Check ─────────────────────────────────────────────────
  if (!profile.email_verified && !pathname.startsWith('/verify-email')) {
    return NextResponse.redirect(new URL('/verify-email', request.url));
  }

  // ─── Admin Route Protection ───────────────────────────────────────────────────
  if (isAdmin) {
    if (!isAdminUser) {
      const dashboardUrl = getDashboardRedirectUrl(userRole, isAdminUser);
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }
    return response;
  }

  // ─── Redirect Authenticated Users from Public Paths ───────────────────────────
  if (isPublic) {
    const dashboardUrl = getDashboardRedirectUrl(userRole, isAdminUser);
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // ─── Role-Based Dashboard Access Control ──────────────────────────────────────
  if (isDashboard) {
    if (isEmployeeDashboard && userRole === 'employer') {
      return NextResponse.redirect(new URL('/dashboards/employer-dashboard', request.url));
    }

    if (isEmployerDashboard && userRole === 'employee') {
      return NextResponse.redirect(new URL('/dashboards/employee-dashboard', request.url));
    }

    if (isAdminUser && !pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // ─── All Checks Passed ────────────────────────────────────────────────────────
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