import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  const pathname = req.nextUrl.pathname;

  const publicPaths = ["/", "/register", "/reset-password", "/forgot-password"];
  const isPublic = publicPaths.includes(pathname);

  const isEmployerDashboard = pathname.startsWith("/dashboard/employer-dashboard");
  const isEmployeeDashboard = pathname.startsWith("/dashboard/employee-dashboard");
  const isDashboard = isEmployerDashboard || isEmployeeDashboard;

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (user && isPublic && pathname !== "/") {
    // Add exceptions here to allow access even if logged in
    if (pathname === "/register" || pathname === "/forgot-password") { // Add more paths as needed
      return res; // Skip redirect, allow access
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const redirectTo =
      profile?.role === "employer"
        ? "/dashboard/employer-dashboard"
        : "/dashboard/employee-dashboard";

    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};