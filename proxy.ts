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
          res = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Secure check
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

  // Block unauthenticated from dashboards
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (user) {
  // First check profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .single();

  // If no profile, check system_admins table
  let role: string;
  let isAdmin = false;

  if (!profile) {
    const { data: adminProfile } = await supabase
      .from("system_admins")
      .select("email")
      .eq("id", user.email)
      .maybeSingle();

    if (!adminProfile) {
      // Neither table has this user - orphaned auth user
      console.warn(`[middleware] User ${user.email} has no profile or system_admin record - signing out`);
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/", req.url));
    }

    // User exists in system_admins
    role = "admin";
    isAdmin = true;
  } else {
    // User exists in profiles
    role = profile.is_admin ? "admin" : profile.role;
    isAdmin = profile.is_admin;
  }

  // Log for debug
  console.log(`[middleware] Path: ${pathname}, Role: ${role}`);

  // Redirect away from login/register if already logged in
  if (isPublic && pathname !== "/verify-email") {
    let dest = "/";
    if (role === "admin") dest = "/admin";
    else if (role === "employer") dest = "/dashboards/employer-dashboard";
    else if (role === "employee") dest = "/dashboards/employee-dashboard";
    else {
      console.warn(`[middleware] Unknown role ${role} - signing out`);
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Prevent self-redirect loop
    if (dest !== pathname) {
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  // Protect admin routes
  if (pathname.startsWith("/admin") && role !== "admin") {
    let dest = "/";
    if (role === "employer") dest = "/dashboards/employer-dashboard";
    else if (role === "employee") dest = "/dashboards/employee-dashboard";
    if (dest !== pathname) {
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  // Protect employer dashboard
  if (pathname.startsWith("/dashboards/employer-dashboard") && role !== "employer") {
    let dest = role === "admin" ? "/admin" : "/dashboards/employee-dashboard";
    if (dest !== pathname) {
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  // Protect employee dashboard
  if (pathname.startsWith("/dashboards/employee-dashboard") && role !== "employee") {
    let dest = role === "admin" ? "/admin" : "/dashboards/employer-dashboard";
    if (dest !== pathname) {
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }
}

  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};