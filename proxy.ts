import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAppRole, resolveRoleFromTables } from "@/lib/server/resolve-user-role";
import type { AppRole } from "@/lib/server/resolve-user-role";
import { MFA_BACKUP_COOKIE, verifyMfaBackupCookie, DEVICE_TRUST_COOKIE, verifyDeviceTrustCookie } from "@/lib/mfa-handler";

function hasValidBackupCodeCookie(req: NextRequest, userId: string): boolean {
  return verifyMfaBackupCookie(req.cookies.get(MFA_BACKUP_COOKIE)?.value, userId);
}

// Set only after a real TOTP/backup-code verification (never from password-only
// login) — lets a recognized device skip re-challenging for 30 days, matching
// standard 2FA practice (re-verify on first login / a new device / sensitive
// changes, not on every fresh session from the same trusted browser).
function hasValidDeviceTrustCookie(req: NextRequest, userId: string): boolean {
  return verifyDeviceTrustCookie(req.cookies.get(DEVICE_TRUST_COOKIE)?.value, userId);
}

export async function proxy(req: NextRequest) {
  // Per-request nonce for CSP — prevents inline script injection attacks.
  // Removes the need for 'unsafe-inline' in script-src.
  const nonce = randomBytes(16).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const cspValue = [
    "default-src 'self'",
    // React dev mode uses eval() for call stack reconstruction; strip in production.
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''} https://www.google.com https://www.gstatic.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://etfytrhduspebpvybljq.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Forward nonce to server components via request headers (readable via headers() API)
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  let res = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          // Re-create requestHeaders to preserve x-nonce when Supabase refreshes session cookies
          const refreshedHeaders = new Headers(req.headers);
          refreshedHeaders.set('x-nonce', nonce);
          res = NextResponse.next({ request: { headers: refreshedHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  const isPublic =
    pathname === "/" ||
    pathname === "/register" ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/verify-email");

  // /console is founder-only (checked separately below, on top of the admin
  // role check) — deliberately not nested under /admin so it doesn't share a
  // route namespace or show up in the admin nav.
  const isConsole = pathname === "/console" || pathname.startsWith("/console/");

  const isDashboard =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboards/employer-dashboard") ||
    pathname.startsWith("/dashboards/employee-dashboard") ||
    isConsole;

  // API paths that require a logged-in session. /api/internal/* and /api/auth/* are excluded:
  // internal routes authenticate via CRON_SECRET bearer token (validated in the handler),
  // and auth routes must be reachable before login.
  const isProtectedApi =
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/employer-dashboard/") ||
    pathname.startsWith("/api/employee-dashboard/") ||
    pathname.startsWith("/api/console/");

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Defense-in-depth: stop anonymous requests to protected API paths at the edge.
  // Route handlers (requireAdmin / requireEmployee etc.) are still the primary auth
  // mechanism and perform role enforcement. This layer only blocks requests with no
  // session cookie AND no Authorization header. Requests bearing a CRON_SECRET
  // bearer token have no session but do have the header — they pass through and are
  // validated by the handler itself.
  if (!user && isProtectedApi) {
    const hasBearerToken = req.headers.get("authorization")?.startsWith("Bearer ");
    if (!hasBearerToken) {
      return NextResponse.json(
        { error: "Unauthorized", code: "NO_SESSION" },
        { status: 401 },
      );
    }
  }

  if (user) {
    let role: AppRole | null = null;
    let profileRow: { 
      role: string; 
      role_normalized: string | null; 
      is_admin: boolean;
      is_active: boolean;
      onboarding_complete: boolean;
    } | null = null;

    const { data: adminRow, error: adminError } = await supabase
      .from("system_admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle<{ id: string }>();

    if (adminError) {
      console.error(`[middleware] system_admins query error for ${user.id}:`, adminError);
    }

    if (adminRow) {
      role = "admin";
    } else {
      const { data: fetchedProfile, error: profileError } = await supabase
        .from("profiles")
        .select("role, role_normalized, is_admin, is_active, onboarding_complete")
        .eq("id", user.id)
        .maybeSingle<{ 
          role: string; 
          role_normalized: string | null; 
          is_admin: boolean;
          is_active: boolean;
          onboarding_complete: boolean;
        }>();
      
      profileRow = fetchedProfile;

      if (profileError) {
        console.error(`[middleware] profiles query error for ${user.id}:`, profileError);
      }

      if (profileRow) {
        role = profileRow.is_admin
          ? "admin"
          : normalizeAppRole(profileRow.role_normalized) ?? normalizeAppRole(profileRow.role);
      }

      if (!role) {
        role =
          await resolveRoleFromTables(supabase as SupabaseClient, user.id) ??
          normalizeAppRole(user.user_metadata?.role);
      }
    }

    if (!role) {
      console.warn(
        `[middleware] User ${user.email} (${user.id}) has no profile or system_admin record — signing out`
      );
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/", req.url));
    }

    // MFA enforcement: Supabase's nextLevel is only 'aal2' for users who have an
    // actually-verified TOTP factor, so this never affects users who haven't
    // opted into MFA. Users who have must complete a challenge (TOTP or backup
    // code) each fresh session before reaching any dashboard/API route — unless
    // this device already completed one within the last 30 days
    // (hasValidDeviceTrustCookie), matching standard practice of only
    // re-challenging on first login, a new/unrecognized device, or sensitive
    // account changes.
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfaRequired = aalData?.nextLevel === 'aal2'
      && aalData.currentLevel !== 'aal2'
      && !hasValidBackupCodeCookie(req, user.id)
      && !hasValidDeviceTrustCookie(req, user.id);

    if (mfaRequired) {
      if (isDashboard && pathname !== '/mfa-challenge') {
        return NextResponse.redirect(new URL('/mfa-challenge', req.url));
      }
      if (isProtectedApi) {
        return NextResponse.json({ error: 'MFA verification required', code: 'MFA_REQUIRED' }, { status: 403 });
      }
    } else if (pathname === '/mfa-challenge') {
      const dest = role === 'admin' ? '/admin' : role === 'employer' ? '/dashboards/employer-dashboard' : '/dashboards/employee-dashboard';
      return NextResponse.redirect(new URL(dest, req.url));
    }

    if (role !== 'admin' && isDashboard) {
      const isActive = profileRow?.is_active ?? false;
      const employerOnboardingPath = '/dashboards/employer-dashboard/onboarding';
      const employeeOnboardingPath = '/dashboards/employee-dashboard/onboarding';
      
      // Both employers and employees who have submitted their onboarding can reach the
      // dashboard even before admin approval. Only redirect if they haven't submitted yet.
      let submittedOnboarding = false;
      if (!isActive) {
        if (role === 'employer') {
          const { data: eoRow } = await supabase
            .from('employer_onboarding')
            .select('status')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle<{ status: string }>();
          submittedOnboarding = !!eoRow?.status && eoRow.status !== 'draft';
        } else if (role === 'employee') {
          const { data: empRow } = await supabase
            .from('employee_onboarding')
            .select('status')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle<{ status: string }>();
          // 'pending' = submitted awaiting approval, 'approved' = approved (is_active may lag)
          submittedOnboarding = !!empRow?.status && empRow.status !== 'draft';
        }
      }

      if (!isActive && !submittedOnboarding) {
        const targetOnboardingPath = role === 'employer' ? employerOnboardingPath : employeeOnboardingPath;
        if (pathname !== targetOnboardingPath) {
          console.log(`[middleware] Redirecting inactive ${role} ${user.id} to ${targetOnboardingPath}`);
          return NextResponse.redirect(new URL(targetOnboardingPath, req.url));
        }
      }
    }

    console.log(`[middleware] Path: ${pathname}, Role: ${role}, User: ${user.id}`);

    if (isPublic && pathname !== "/verify-email") {
      let dest: string;
      if (role === "admin")         dest = "/admin";
      else if (role === "employer") dest = "/dashboards/employer-dashboard";
      else if (role === "employee") dest = "/dashboards/employee-dashboard";
      else {
        console.warn(`[middleware] Unknown role "${role}" for user ${user.id} — signing out`);
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/", req.url));
      }

      if (dest !== pathname) {
        return NextResponse.redirect(new URL(dest, req.url));
      }
    }

    if (pathname.startsWith("/admin") && role !== "admin") {
      const dest = role === "employer"
        ? "/dashboards/employer-dashboard"
        : "/dashboards/employee-dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    if (isConsole && role !== "admin") {
      const dest = role === "employer" ? "/dashboards/employer-dashboard" : "/dashboards/employee-dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    // Founder-only, on top of the admin check above — the console spec is
    // explicit that this is not a general-admin surface. A boolean flag, not
    // an email match, so it can't be spoofed via user_metadata/app_metadata.
    if (isConsole) {
      const { data: founderRow } = await supabase
        .from("system_admins")
        .select("is_founder")
        .eq("id", user.id)
        .maybeSingle<{ is_founder: boolean }>();

      if (founderRow?.is_founder !== true) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }

    if (
      pathname.startsWith("/dashboards/employer-dashboard") &&
      role !== "employer"
    ) {
      const dest = role === "admin" ? "/admin" : "/dashboards/employee-dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    if (
      pathname.startsWith("/dashboards/employee-dashboard") &&
      role !== "employee"
    ) {
      const dest = role === "admin" ? "/admin" : "/dashboards/employer-dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    // API path role enforcement — mirrors the page-level redirects above.
    // Returns JSON 403 instead of redirecting because API clients don't follow HTML redirects.
    // Individual route handlers (requireAdmin etc.) remain the primary auth gate.
    if (pathname.startsWith("/api/admin/") && role !== "admin") {
      return NextResponse.json({ error: "Forbidden", code: "WRONG_ROLE" }, { status: 403 });
    }
    if (pathname.startsWith("/api/employer-dashboard/") && role !== "employer") {
      return NextResponse.json({ error: "Forbidden", code: "WRONG_ROLE" }, { status: 403 });
    }
    if (pathname.startsWith("/api/employee-dashboard/") && role !== "employee") {
      return NextResponse.json({ error: "Forbidden", code: "WRONG_ROLE" }, { status: 403 });
    }
    if (pathname.startsWith("/api/console/")) {
      if (role !== "admin") {
        return NextResponse.json({ error: "Forbidden", code: "WRONG_ROLE" }, { status: 403 });
      }
      const { data: founderRow } = await supabase
        .from("system_admins")
        .select("is_founder")
        .eq("id", user.id)
        .maybeSingle<{ is_founder: boolean }>();
      if (founderRow?.is_founder !== true) {
        return NextResponse.json({ error: "Forbidden", code: "NOT_FOUNDER" }, { status: 403 });
      }
    }
  }

  res.headers.set('Content-Security-Policy', cspValue);
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
