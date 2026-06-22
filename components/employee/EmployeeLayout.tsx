"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Home, Wallet, History, User, LogOut, ChevronRight,
  Loader2, Menu, X, Shield, Sparkles,
  HelpCircle, Landmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/actions/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/stores/auth';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/realtime-js';
import { ChatWindow } from '../layout/ChatWindow';
import { NotificationDropdown } from '../layout/NotificationDropdown';
import { DashboardBreadcrumbs } from '../layout/DashboardBreadcrumbs';
import PushClient from '@/components/push/PushClient';

interface EmployeeUser {
  id?: string;
  email?: string;
  user_metadata?: { full_name?: string };
  avatar_url?: string;
}



export const EmployeeBackground = () => (
  <>
    <div className="fixed inset-0 pointer-events-none bg-slate-50 dark:bg-slate-950" />
    <div className="fixed top-0 right-0 w-150 h-150 rounded-full blur-[150px] pointer-events-none opacity-30"
      style={{ background: 'radial-gradient(circle, #10b98120, transparent)' }} />
    <div className="fixed bottom-0 left-0 w-125 h-125 rounded-full blur-[120px] pointer-events-none opacity-20"
      style={{ background: 'radial-gradient(circle, #10b98115, transparent)' }} />
  </>
);



interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  user: EmployeeUser | null;
}

const EmployeeSidebarNav = ({ isOpen, onClose, user }: SidebarNavProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {

    setMounted(true);
  }, []);

  const menuItems = [
    { label: 'Home',             href: '/dashboards/employee-dashboard',                 icon: Home },
    { label: 'Request Advance',  href: '/dashboards/employee-dashboard/request-advance', icon: Wallet },
    { label: 'Transactions',     href: '/dashboards/employee-dashboard/transactions',    icon: History },
    { label: 'Employment',       href: '/dashboards/employee-dashboard/employment',      icon: Shield },
    { label: 'Payment Methods',  href: '/dashboards/employee-dashboard/payment-methods', icon: Landmark },
    { label: 'Wellness Tools',   href: '/dashboards/employee-dashboard/wellness',         icon: Sparkles },
    { label: 'Help Center',      href: '/dashboards/employee-dashboard/support',          icon: HelpCircle },
    { label: 'Profile Settings', href: '/dashboards/employee-dashboard/settings',        icon: User },
  ];

  const isActive = useCallback((path: string) => {
    if (!pathname) return false;
    return path === '/dashboards/employee-dashboard' ? pathname === path : pathname.startsWith(path);
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/');
    } catch {
      toast.error('Failed to logout. Please try again.');
    }
  }, [router]);

  const fullName = mounted ? (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User') : 'User';
  const initials = mounted
    ? (fullName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U')
    : 'U';
  
  const avatarUrl = user?.avatar_url;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-72 z-50 transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Employee navigation sidebar"
      >
        
        <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/50 dark:border-white/10" />

        <div className="relative flex flex-col h-full overflow-hidden">

          
          <div className="p-6 border-b border-slate-100 dark:border-white/10 shrink-0">
            <Link href="/dashboards/employee-dashboard" className="flex items-center gap-3" onClick={onClose}>
              <div className="w-11 h-11 bg-linear-to-br from-emerald-500/20 to-green-500/20 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-emerald-500/20 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-white/10">
                <Wallet
                  className="h-8 w-8 text-emerald-700"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 dark:text-white block leading-tight">EaziWage</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-600 dark:text-emerald-400"
                  style={{ background: '#10b98115', border: '1px solid #10b98125' }}>
                  Employee
                </span>
              </div>
            </Link>

            <button
              onClick={onClose}
              className="absolute top-6 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-colors"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                    active
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                    active
                      ? "bg-white/15 dark:bg-black/15"
                      : "bg-slate-100 dark:bg-white/5"
                  )}>
                    <Icon className={cn("w-4 h-4", active ? "text-white dark:text-slate-900" : "text-slate-400")} />
                  </div>
                  <span className="text-sm font-semibold">{item.label}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />}
                </Link>
              );
            })}

            
            <div className="mt-4 rounded-2xl p-4 border"
              style={{ background: '#10b98108', borderColor: '#10b98120' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: '#10b98118', border: '1px solid #10b98130' }}>
                  <HelpCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Need help?</p>
                  <p className="text-[10px] text-slate-400">Support Center</p>
                </div>
              </div>
              <button
                className="w-full py-2 bg-white dark:bg-white/5 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-slate-100 dark:border-white/10 hover:shadow-sm transition-all"
                onClick={() => toast.info('Support feature coming soon!')}
              >
                Contact Us
              </button>
            </div>
          </nav>

          
          <div className="p-4 border-t border-slate-100 dark:border-white/10 shrink-0 mb-20 lg:mb-0">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="w-10 h-10 rounded-xl border border-slate-100 dark:border-white/10">
                <AvatarImage src={avatarUrl} alt={fullName} />
                <AvatarFallback className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{fullName}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-sm font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>

        </div>
      </aside>
    </>
  );
};



interface TopHeaderProps {
  onMenuClick: () => void;
  user: EmployeeUser | null;
  title?: string;
}

const EmployeeTopHeader = ({ onMenuClick, user, title }: TopHeaderProps) => {
  const [activeChat, setActiveChat] = useState<{ id: string; name: string } | null>(null);
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {

    setMounted(true);
  }, []);

  const hour = mounted ? new Date().getHours() : 9;
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const isGenericTitle = (t?: string) => {
    if (!t) return false;
    const generic = ['overview', 'welcome', 'syncing...', 'loading...', 'dashboard'];
    return generic.includes(t.toLowerCase());
  };

  const getPageTitle = () => {

    if (title && isGenericTitle(title)) return fullName;
    if (title) return title;
    if (pathname === '/dashboards/employee-dashboard') return 'Dashboard';
    if (pathname?.includes('request-advance')) return 'Request Advance';
    if (pathname?.includes('transactions')) return 'Transactions';
    if (pathname?.includes('onboarding')) return 'KYC Verification';
    if (pathname?.includes('settings')) return 'Settings';
    return 'Employee Portal';
  };

  return (
    <>
      <header className="sticky top-0 z-30 px-4 lg:px-8 py-4 lg:py-6 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-white/10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-xl bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden transition-all border border-slate-200 dark:border-white/10"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {greeting}
              </p>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {getPageTitle()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.id && (
              <NotificationDropdown 
                role="employee"
                userId={user.id}
                apiPath="/api/employee-dashboard/notifications"
                pusherChannel={`user-${user.id}`}
                viewAllHref="/dashboards/employee-dashboard/notifications"
                primaryColor="primary"
              />
            )}
          </div>
        </div>
      </header>

      {activeChat && user?.id && (
        <ChatWindow
          currentUserId={user.id}
          otherUserId={activeChat.id}
          otherUserName={activeChat.name}
          onClose={() => setActiveChat(null)}
        />
      )}
    </>
  );
};



export const FloatingNav = () => {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { id: 'home',    icon: Home,    label: 'Home',    path: '/dashboards/employee-dashboard' },
    { id: 'advance', icon: Wallet,  label: 'Advance', path: '/dashboards/employee-dashboard/request-advance' },
    { id: 'history', icon: History, label: 'History', path: '/dashboards/employee-dashboard/transactions' },
    { id: 'profile', icon: User,    label: 'Profile', path: '/dashboards/employee-dashboard/settings' },
  ];

  const isActive = (path: string) => pathname === path;

  const handleNavigation = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  return (
    <nav className="fixed bottom-6 left-0 right-0 z-50 px-6 lg:hidden pointer-events-none">
      <div className="max-w-sm mx-auto pointer-events-auto">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-xl shadow-black/10 border border-slate-200/60 dark:border-white/10 p-1.5">
          <div className="flex items-center justify-between">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-2 flex-1 rounded-2xl transition-all duration-300",
                    active ? "text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <div className="absolute inset-0 bg-slate-900 dark:bg-white rounded-2xl" />
                  )}
                  <Icon className={cn(
                    "w-4 h-4 mb-1 relative z-10 transition-transform duration-300",
                    active ? "scale-110 text-white dark:text-slate-900" : ""
                  )} />
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-tighter relative z-10",
                    active ? "text-white dark:text-slate-900" : ""
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};



interface EmployeePortalLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function EmployeePortalLayout({ children, title }: EmployeePortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState<string | null>(null);
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const router = useRouter();
  const pathname = usePathname();

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (sidebarOpen) setSidebarOpen(false);
  }


  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();

    type SupabaseWithChannel = { channel: (name: string) => RealtimeChannel; removeChannel: (c: RealtimeChannel) => void };

    const channel = supabase
      .channel(`realtime:usersettings:user-${user.id}`)
      .on('postgres_changes' as const, {
        event: 'UPDATE',
        schema: 'public',
        table: 'employee_onboarding',

      }, () => {
        toast.success('Your account settings updated', {
          description: 'An administrator has updated your account configuration.',
          icon: <Shield className="w-5 h-5 text-emerald-500" />,
        });
      })
      .subscribe();

    return () => {
      (supabase as unknown as SupabaseWithChannel).removeChannel(channel);
    };
  }, [user?.id]);


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading dashboard</p>
        </div>
      </div>
    );
  }


  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: '#ef444412', border: '1px solid #ef444425' }}>
            <Shield className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Session Unavailable</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Your session could not be verified. Please log in again.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:scale-105 transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <EmployeeBackground />
      <PushClient />

      <EmployeeSidebarNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

      <div className="lg:ml-72 relative flex flex-col min-h-screen">
        <EmployeeTopHeader onMenuClick={() => setSidebarOpen(true)} user={user} title={title} />
        <main className="p-4 lg:p-8 flex-1 pb-32 lg:pb-8">
          <DashboardBreadcrumbs />
          {children}
        </main>
        <FloatingNav />
      </div>
    </div>
  );
}



export { EmployeePortalLayout as EmployeePageLayout };

export const EmployeeHeader = ({
  title,
  rightContent,
}: {
  title: string;
  rightContent?: React.ReactNode;
}) => (
  <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
    {rightContent && <div>{rightContent}</div>}
  </div>
);

export default EmployeePortalLayout;