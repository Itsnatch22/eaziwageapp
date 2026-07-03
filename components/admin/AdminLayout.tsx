"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronRight,
  Shield,
  CheckCircle2,
  Search,
  Wallet,
  AlertTriangle,
  Loader2,
  DollarSign,
  MessageSquare,
  HelpCircle,
  ClipboardCheck,
  Wifi,
  Landmark,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationDropdown } from "../layout/NotificationDropdown";
import { logout } from "@/actions/auth";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommandPalette } from "./CommandPalette";
import { useAuthStore } from "@/lib/stores/auth";

import { DashboardBreadcrumbs } from "../layout/DashboardBreadcrumbs";
import PushClient from '@/components/push/PushClient';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';



interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url?: string | null;
}



export const AdminBackground = () => (
  <>
    <div className="fixed inset-0 gradient-mesh pointer-events-none" />
    <div className="fixed inset-0 bg-grid pointer-events-none" />
    <div className="fixed top-0 right-0 w-150 h-150 bg-green-600/5 rounded-full blur-[150px] pointer-events-none" />
    <div className="fixed bottom-0 left-0 w-125 h-125 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
    <div className="fixed top-1/2 left-1/3 w-100 h-100 bg-blue-500/3 rounded-full blur-[100px] pointer-events-none" />
  </>
);



interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}

const AdminSidebarNav = ({ isOpen, onClose, userProfile }: SidebarNavProps) => {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let raf = 0;
    raf = (typeof window !== 'undefined' && 'requestAnimationFrame' in window)
      ? window.requestAnimationFrame(() => setMounted(true))
      : setTimeout(() => setMounted(true), 0) as unknown as number;
    return () => {
      if (typeof window !== 'undefined' && 'cancelAnimationFrame' in window) {
        cancelAnimationFrame(raf);
      } else {
        clearTimeout(raf);
      }
    };
  }, []);


  const userProfileAny = userProfile as UserProfile | null;

  const avatarUrl = userProfileAny?.avatar_url
    ? (() => {

        const timestamp = 1;
        return userProfileAny.avatar_url.includes("?")
          ? `${userProfileAny.avatar_url}&t=${timestamp}`
          : `${userProfileAny.avatar_url}?t=${timestamp}`;
      })()
    : undefined;

  const menuItems = [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Advances", href: "/admin/advances", icon: CreditCard },
    { label: "KYC Review", href: "/admin/kyc-review", icon: CheckCircle2 },
    { label: "Bank Verifications", href: "/admin/payment-verifications", icon: Landmark },
    { label: "Employers", href: "/admin/employers", icon: Building2 },
    { label: "Employees", href: "/admin/employees", icon: Users },
    { label: "Review Requests", href: "/admin/review-requests", icon: Shield },
    {
      label: "Risk Scoring",
      href: "/admin/risk-scoring",
      icon: ClipboardCheck,
    },
    { label: "Notifications", href: "/admin/notifications", icon: Bell },
    { label: "Support", href: "/admin/support", icon: MessageSquare },
    {
      label: "Fraud Detection",
      href: "/admin/fraud-detection",
      icon: AlertTriangle,
    },
    { label: "Reconciliation", href: "/admin/reconciliation", icon: BarChart3 },
    { label: "Payday Recoupments", href: "/admin/payday-recoupments", icon: CalendarClock },
    { label: "Billing & Revenue", href: "/admin/billing", icon: DollarSign },
    { label: "System Health", href: "/admin/api-health", icon: Wifi },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    return path === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(path);
  };

  const fullName = mounted
    ? userProfile?.full_name || userProfile?.email?.split("@")[0] || "Admin"
    : "Admin";
  const initials = mounted
    ? fullName
        .split(" ")
        .filter(Boolean)
        .map((n: string) => n[0])
        .join("")
        .toUpperCase() || "A"
    : "A";

  return (
    <>
      
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-72 z-50 transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50" />

        <div className="relative flex flex-col h-full overflow-hidden">
          
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="w-12 h-12 bg-linear-to-br from-emerald-500/20 to-green-500/20 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/10 border border-slate-100 dark:border-slate-800">
                <Wallet
                  className="h-8 w-8 text-emerald-700"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
              <div>
                <span className="font-heading font-bold text-xl text-slate-900 dark:text-white block">
                  EaziWage
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">
                  Admin Hub
                </span>
              </div>
            </Link>

            
            <button
              onClick={onClose}
              className="absolute top-6 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    active
                      ? "bg-green-600 text-white shadow-lg shadow-green-600/25"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                      active
                        ? "bg-white/20"
                        : "bg-linear-to-br from-green-600 to-emerald-600",
                    )}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}

            
            <div className="mt-6 bg-linear-to-br from-green-600/10 to-emerald-500/10 dark:from-green-600/20 dark:to-emerald-500/20 rounded-2xl p-4 border border-green-600/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-linear-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                  <HelpCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Admin Help
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Documentation
                  </p>
                </div>
              </div>
              <Link
                href="/admin/docs"
                className="w-full mt-2 px-4 py-2 bg-white dark:bg-slate-800 text-green-600 text-sm font-medium rounded-xl hover:shadow-md transition-all inline-block text-center"
              >
                View Docs
              </Link>
            </div>
          </nav>

          
          <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-11 h-11 rounded-xl shadow-md border border-slate-100 dark:border-slate-800">
                <AvatarImage src={avatarUrl} alt={fullName} />
                <AvatarFallback className="bg-linear-to-br from-green-600 to-emerald-600 text-white font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {fullName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {userProfile?.email || "No email"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => logout()}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};



interface TopHeaderProps {
  onMenuClick: () => void;
  userProfile: UserProfile | null;
}

const AdminTopHeader = ({ onMenuClick, userProfile }: TopHeaderProps) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let raf = 0;
    raf = (typeof window !== 'undefined' && 'requestAnimationFrame' in window)
      ? window.requestAnimationFrame(() => setMounted(true))
      : setTimeout(() => setMounted(true), 0) as unknown as number;
    return () => {
      if (typeof window !== 'undefined' && 'cancelAnimationFrame' in window) {
        cancelAnimationFrame(raf);
      } else {
        clearTimeout(raf);
      }
    };
  }, []);

  const hour = mounted ? new Date().getHours() : 9;
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <header className="sticky top-0 z-30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
      <div className="px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {greeting}
              </p>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {userProfile?.full_name || "Admin Portal"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true }),
                )
              }
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mr-2"
            >
              <Search className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Search
              </span>
              <kbd className="text-[10px] font-bold opacity-50 ml-1">⌘K</kbd>
            </button>

            {userProfile?.id && (
              <NotificationDropdown
                role="admin"
                userId={userProfile.id}
                apiPath="/api/admin/notifications"
                viewAllHref="/admin/notifications"
                primaryColor="purple-600"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};



interface AdminPortalLayoutProps {
  children: React.ReactNode;
}

export function AdminPortalLayout({ children }: AdminPortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const globalUser = useAuthStore((state) => state.user);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);
  const fetchInProgress = useRef(false);

  const router = useRouter();

  useEffect(() => {
    if (globalUser && userProfile && globalUser.id === userProfile.id) {
      if (globalUser.avatar_url !== userProfile.avatar_url) {

        Promise.resolve().then(() => {
          setUserProfile((prev) =>
            prev ? { ...prev, avatar_url: globalUser.avatar_url } : null,
          );
        });
      }
    }
  }, [globalUser, userProfile]);

  // Hidden founder-console trigger — no nav entry, no visible link. This is
  // UX convenience only; /console re-checks role + is_founder + AAL2 itself
  // regardless of how the navigation happened, so this shortcut grants
  // nothing on its own.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        router.push('/console');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  const handleAdminRealtimeEvent = useCallback((table: string) => {
    const messages: Record<string, { title: string; description: string }> = {
      advances:              { title: 'New advance activity',       description: 'An advance request was submitted or updated.' },
      employer_onboarding:   { title: 'Employer application update', description: 'An employer profile was submitted or changed.' },
      employee_kyc_documents:{ title: 'KYC document submitted',     description: 'A new KYC document is ready for review.' },
      fraud_flags:           { title: 'Fraud flag raised',          description: 'A transaction has been flagged for review.' },
      admin_wallets:         { title: 'Admin wallet updated',       description: 'The platform wallet balance has changed.' },
    };
    const msg = messages[table];
    if (msg) {
      toast.info(msg.title, {
        description: msg.description,
        icon: <Settings className="w-5 h-5 text-purple-600" />,
      });
    }
  }, []);

  // Watch tables that drive the admin's key workflows — new advances, employer
  // applications, KYC docs, fraud flags, and wallet changes.
  useRealtimeRefresh(
    userProfile?.id ? [
      { table: 'advances',               event: 'INSERT' },
      { table: 'employer_onboarding',    event: 'INSERT' },
      { table: 'employee_kyc_documents', event: 'INSERT' },
      { table: 'fraud_flags',            event: 'INSERT' },
      { table: 'admin_wallets',          event: 'UPDATE' },
    ] : [],
    handleAdminRealtimeEvent,
  );

  useEffect(() => {
    Promise.resolve().then(() => setIsHydrated(true));
  }, []);

  useEffect(() => {

    if (!isHydrated) return;


    if (isAuthorized !== null || fetchInProgress.current) return;

    async function fetchProfile() {
      if (fetchInProgress.current) return;
      fetchInProgress.current = true;

      try {
        console.log("[AdminLayout] Fetching admin profile");
        const res = await fetch("/api/admin/me", {
          credentials: "include",
        });

        if (res.status === 401) {
          console.warn("[AdminLayout] No active session");
          setSessionMissing(true);
          setIsAuthorized(false);
          return;
        }

        if (!res.ok) {
          const errorText = await res.text();
          console.error("[AdminLayout] API error:", res.status, errorText);
          setIsAuthorized(false);
          return;
        }

        const data = await res.json();

        if (data.error) {
          console.error("[AdminLayout] Admin profile data error:", data.error);
          if (data.code === "AUTH_REQUIRED") setSessionMissing(true);
          setIsAuthorized(false);
          return;
        }

        const allowedRoles = [
          "admin",
          "super_admin",
          "compliance",
          "employer_admin",
        ];


        const hasAdminRole =
          data.is_admin ||
          (data.role_candidates &&
            data.role_candidates.some((role: string) =>
              allowedRoles.includes(role.toLowerCase()),
            ));

        if (!hasAdminRole) {
          console.warn(
            "[AdminLayout] User does not have admin role. Candidates:",
            data.role_candidates,
          );
          setIsAuthorized(false);


          const role =
            data.profiles_role ||
            data.app_metadata_role ||
            data.user_metadata_role;
          if (role === "employer") {
            router.replace("/dashboards/employer-dashboard");
          } else if (role === "employee") {
            router.replace("/dashboards/employee-dashboard");
          }
          return;
        }

        console.log("[AdminLayout] Admin access granted for:", data.email);
        setSessionMissing(false);
        setUserProfile({
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          role: data.profiles_role || "admin",
          avatar_url: data.avatar_url,
        });
        setIsAuthorized(true);
      } catch (err) {
        console.error("[AdminLayout] Check failed:", err);
        setIsAuthorized(false);
      } finally {
        fetchInProgress.current = false;
      }
    }

    fetchProfile();
  }, [router, isHydrated, isAuthorized]);

  if (sessionMissing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Session Unavailable
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 text-center max-w-md">
          We couldn&apos;t verify your session. Please sign in again.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  if (!isHydrated || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">
            Verifying access...
          </p>
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Unauthorized Access
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 text-center max-w-md">
          Your account does not have the necessary permissions to access the
          Admin Hub.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <AdminBackground />
      <PushClient />
      <CommandPalette />

      <AdminSidebarNav
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userProfile={userProfile}
      />

      <div className="lg:ml-72 relative">
        <AdminTopHeader
          onMenuClick={() => setSidebarOpen(true)}
          userProfile={userProfile}
        />

        <main className="p-4 lg:p-8">
          <DashboardBreadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminPortalLayout;
