"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home, Wallet, History, User, LogOut, Bell, ChevronRight,
  Trash2, Loader2, Menu, X, Shield,
  HelpCircle, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/actions/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/stores/auth';
import pusherClient from '@/lib/pusher-client';
import { toast } from 'sonner';
import { ChatWindow } from '../layout/ChatWindow';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: 'advance_approval' | 'kyc_update' | 'system_alert' | 'repayment_reminder';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface EmployeeUser {
  id?: string;
  email?: string;
  user_metadata?: { full_name?: string };
  avatar_url?: string;
}

// ─── Background ───────────────────────────────────────────────────────────────

export const EmployeeBackground = () => (
  <>
    <div className="fixed inset-0 pointer-events-none bg-slate-50 dark:bg-slate-950" />
    <div className="fixed top-0 right-0 w-150 h-150 rounded-full blur-[150px] pointer-events-none opacity-30"
      style={{ background: 'radial-gradient(circle, #10b98120, transparent)' }} />
    <div className="fixed bottom-0 left-0 w-125 h-125 rounded-full blur-[120px] pointer-events-none opacity-20"
      style={{ background: 'radial-gradient(circle, #10b98115, transparent)' }} />
  </>
);

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  user: EmployeeUser | null;
}

const EmployeeSidebarNav = ({ isOpen, onClose, user }: SidebarNavProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const menuItems = [
    { label: 'Home',             href: '/dashboards/employee-dashboard',                 icon: Home },
    { label: 'Request Advance',  href: '/dashboards/employee-dashboard/request-advance', icon: Wallet },
    { label: 'Transactions',     href: '/dashboards/employee-dashboard/transactions',    icon: History },
    { label: 'KYC Verification', href: '/dashboards/employee-dashboard/onboarding',      icon: Shield },
    { label: 'Profile Settings', href: '/dashboards/employee-dashboard/settings',        icon: User },
  ];

  const isActive = useCallback((path: string) => {
    if (!pathname) return false;
    return path === '/dashboards/employee-dashboard' ? pathname === path : pathname.startsWith(path);
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/login');
    } catch {
      toast.error('Failed to logout. Please try again.');
    }
  }, [router]);

  const fullName = mounted ? (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User') : 'User';
  const initials = mounted
    ? (fullName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U')
    : 'U';

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
        {/* Glass panel */}
        <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/50 dark:border-white/10" />

        <div className="relative flex flex-col h-full overflow-hidden">

          {/* Logo */}
          <div className="p-6 border-b border-slate-100 dark:border-white/10 shrink-0">
            <Link href="/dashboards/employee-dashboard" className="flex items-center gap-3" onClick={onClose}>
              <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-white/10">
                <Image src="/logo.png" alt="EaziWage" width={28} height={28} className="object-contain" priority />
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

          {/* Nav */}
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

            {/* Help card */}
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

          {/* User section */}
          <div className="p-4 border-t border-slate-100 dark:border-white/10 shrink-0 mb-20 lg:mb-0">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="w-10 h-10 rounded-xl border border-slate-100 dark:border-white/10">
                <AvatarImage src={user?.avatar_url} alt={fullName} />
                <AvatarFallback className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{fullName}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email || 'No email'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/15 transition-all text-xs font-bold border border-red-100 dark:border-red-500/20"
              aria-label="Logout from account"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// ─── Top Header ───────────────────────────────────────────────────────────────

interface TopHeaderProps {
  onMenuClick: () => void;
  user: EmployeeUser | null;
  title?: string;
}

const EmployeeTopHeader = ({ onMenuClick, user, title }: TopHeaderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeChat, setActiveChat] = useState<{ id: string; name: string } | null>(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoadingNotifications(true);
    try {
      const res = await fetch('/api/employee-dashboard/notifications', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      } else if (res.status !== 401) {
        // silent fail for 401, log others
        console.warn('Notifications fetch failed:', res.status);
      }
    } catch {
      // silent
    } finally {
      isLoadingRef.current = false;
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id || !pusherClient) return;
    const channel = pusherClient.subscribe(`user-${user.id}`);

    const handleNew = (data: Notification) => {
      setNotifications(prev => {
        if (prev.some(n => n.id === data.id)) return prev;
        return [data, ...prev].slice(0, 20);
      });
      toast(data.title, { description: data.message, icon: <Bell className="w-4 h-4 text-emerald-500" /> });
    };

    const handleDeleted = (data: { id: string }) => {
      setNotifications(prev => prev.filter(n => n.id !== data.id));
    };

    channel.bind('new-notification', handleNew);
    channel.bind('notification-deleted', handleDeleted);

    return () => {
      channel.unbind('new-notification', handleNew);
      channel.unbind('notification-deleted', handleDeleted);
      pusherClient!.unsubscribe(`user-${user.id}`);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications]);

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      const res = await fetch(`/api/employee-dashboard/notifications?id=${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) {
        await loadNotifications();
        toast.error('Failed to delete notification');
      }
    } catch {
      await loadNotifications();
      toast.error('Failed to delete notification');
    }
  }, [loadNotifications]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await fetch(`/api/employee-dashboard/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH', credentials: 'include',
      });
    } catch { /* silent */ }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationStyle = (type: Notification['type']) => {
    switch (type) {
      case 'advance_approval': return { bg: '#10b98112', border: '#10b98125', color: '#10b981', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
      case 'kyc_update':       return { bg: '#1e293b12', border: '#1e293b25', color: '#475569', icon: <Shield className="w-3.5 h-3.5" /> };
      default:                 return { bg: '#10b98108', border: '#10b98115', color: '#64748b', icon: <Bell className="w-3.5 h-3.5" /> };
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-white/10">
        <div className="px-4 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onMenuClick}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="w-4 h-4" />
              </button>

              {title && (
                <div>
                  <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{title}</h1>
                  <p className="text-[10px] text-slate-400 font-medium">Employee Portal</p>
                </div>
              )}
            </div>

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-88 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden animate-in slide-in-from-top-2 fade-in">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Notifications</p>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full"
                        style={{ background: '#10b98112', border: '1px solid #10b98120' }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {isLoadingNotifications && notifications.length === 0 ? (
                      <div className="py-12 text-center">
                        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Loading…</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-12 text-center">
                        <Bell className="w-10 h-10 text-slate-200 dark:text-white/10 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map(notif => {
                        const style = getNotificationStyle(notif.type);
                        return (
                          <div
                            key={notif.id}
                            className={cn(
                              "px-4 py-3 border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors relative group cursor-pointer",
                              !notif.read && "bg-emerald-50/30 dark:bg-emerald-500/5"
                            )}
                            onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                          >
                            <div className="flex items-start gap-3 pr-6">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.color }}>
                                {style.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-xs font-semibold", notif.read ? "text-slate-500" : "text-slate-900 dark:text-white")}>
                                  {notif.title}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                                <p className="text-[9px] text-slate-300 dark:text-white/20 mt-1 font-medium">
                                  {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {!notif.read && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />}
                            </div>
                            <button
                              onClick={(e) => handleDelete(e, notif.id)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                              aria-label="Delete notification"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/10">
                    <Link
                      href="/dashboards/employee-dashboard/notifications"
                      className="block w-full text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-colors"
                      onClick={() => setShowNotifications(false)}
                    >
                      View All
                    </Link>
                  </div>
                </div>
              )}
            </div>
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

// ─── Floating Nav ─────────────────────────────────────────────────────────────

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

// ─── Main Layout ──────────────────────────────────────────────────────────────

interface EmployeePortalLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function EmployeePortalLayout({ children, title }: EmployeePortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [directSessionValid, setDirectSessionValid] = useState<boolean | null>(null);
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    let timeout: NodeJS.Timeout;

    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { user: directUser }, error } = await supabase.auth.getUser();
        if (!mounted) return;
        setDirectSessionValid(error ? false : !!directUser);
      } catch {
        if (mounted) setDirectSessionValid(false);
      } finally {
        if (mounted) setSessionChecked(true);
      }
    };

    if (!loading) {
      timeout = setTimeout(() => { if (mounted) checkSession(); }, 100);
    }

    return () => { mounted = false; clearTimeout(timeout); };
  }, [loading]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (loading || !sessionChecked) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading dashboard…</p>
      </div>
    </div>
  );

  if (!user && !directSessionValid) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: '#ef444412', border: '1px solid #ef444425' }}>
          <Shield className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Session Unavailable</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Your session could not be verified. Please refresh or log in again.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:scale-105 transition-all"
        >
          Go to Login
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <EmployeeBackground />

      <EmployeeSidebarNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

      <div className="lg:ml-72 relative flex flex-col min-h-screen">
        <EmployeeTopHeader onMenuClick={() => setSidebarOpen(true)} user={user} title={title} />
        <main className="p-4 lg:p-8 flex-1 pb-32 lg:pb-8">
          {children}
        </main>
        <FloatingNav />
      </div>
    </div>
  );
}

// ─── Compatibility Exports ────────────────────────────────────────────────────

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