import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next();

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
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Secure check — always use getUser(), never trust the session alone
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

  const isDashboard =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboards/employer-dashboard") ||
    pathname.startsWith("/dashboards/employee-dashboard");

  // Block unauthenticated users from protected routes
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (user) {
    // ── Role resolution ──────────────────────────────────────────────────────
    //
    // Strategy (avoids RLS recursion):
    //   1. Check system_admins first — admins skip the profiles table entirely.
    //   2. Fall back to profiles for employers/employees.
    //   3. If neither table has a record, the auth user is orphaned — sign out.
    //
    // Using the anon client here is safe because:
    //   • system_admins RLS: "SELECT allowed for own row" (id = auth.uid())
    //   • profiles RLS must NOT reference profiles itself — see SQL migration below
    //
    // The service-role client is intentionally NOT used in middleware because
    // middleware runs on every request and we want RLS as a second layer.

    let role: string | null = null;

    // 1. Check system_admins
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
      // 2. Check profiles
      // NOTE: profiles RLS must use a simple policy (e.g. id = auth.uid())
      // without any sub-SELECT on profiles itself — otherwise infinite recursion occurs.
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("role, role_normalized, is_admin")
        .eq("id", user.id)
        .maybeSingle<{ role: string; role_normalized: string | null; is_admin: boolean }>();

      if (profileError) {
        console.error(`[middleware] profiles query error for ${user.id}:`, profileError);
      }

      if (profileRow) {
        role = profileRow.is_admin
          ? "admin"
          : (profileRow.role_normalized || profileRow.role);
      }
    }

    // 3. Orphaned auth user — no record in either table
    if (!role) {
      console.warn(
        `[middleware] User ${user.email} (${user.id}) has no profile or system_admin record — signing out`
      );
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/", req.url));
    }

    console.log(`[middleware] Path: ${pathname}, Role: ${role}, User: ${user.id}`);

    // ── Redirect logged-in users away from public pages ──────────────────────
    if (isPublic && pathname !== "/verify-email") {
      let dest: string;
      if (role === "admin")         dest = "/admin";
      else if (role === "employer") dest = "/dashboards/employer-dashboard";
      else if (role === "employee") dest = "/dashboards/employee-dashboard";
      else {
        // Unknown role — sign out to prevent an infinite redirect loop
        console.warn(`[middleware] Unknown role "${role}" for user ${user.id} — signing out`);
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/", req.url));
      }

      if (dest !== pathname) {
        return NextResponse.redirect(new URL(dest, req.url));
      }
    }

    // ── Protect admin routes ─────────────────────────────────────────────────
    if (pathname.startsWith("/admin") && role !== "admin") {
      const dest = role === "employer"
        ? "/dashboards/employer-dashboard"
        : "/dashboards/employee-dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    // ── Protect employer dashboard ───────────────────────────────────────────
    if (
      pathname.startsWith("/dashboards/employer-dashboard") &&
      role !== "employer"
    ) {
      const dest = role === "admin" ? "/admin" : "/dashboards/employee-dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    // ── Protect employee dashboard ───────────────────────────────────────────
    if (
      pathname.startsWith("/dashboards/employee-dashboard") &&
      role !== "employee"
    ) {
      const dest = role === "admin" ? "/admin" : "/dashboards/employer-dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};