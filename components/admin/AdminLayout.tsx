'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link          from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient }    from '@supabase/ssr';
import {
  LayoutDashboard, Users, Building2, CreditCard, BarChart3, Settings, LogOut,
  Sun, Moon, Bell, Menu, X, ChevronRight, Shield, CheckCircle2, Wifi,
  AlertTriangle, HelpCircle,
} from 'lucide-react';
import { cn }        from '@/lib/utils';
import { useTheme }  from '@/lib/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
}

interface Notification {
  id:      string;
  type:    'review_request' | 'employer_kyc' | 'flagged_advance';
  title:   string;
  message: string;
  read:    boolean;
}

interface AdminUser {
  id:        string;
  full_name: string;
  email:     string;
  role:      string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ─── Background Component ─────────────────────────────────────────────────────

function AdminBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-linear-to-br from-slate-50 via-slate-100 to-green-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div className="absolute inset-0 opacity-30 dark:opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="admin-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M0 32V0h32" fill="none" stroke="currentColor" strokeOpacity="0.1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#admin-grid)" className="text-slate-900 dark:text-white" />
        </svg>
      </div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-br from-green-500/8 to-green-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-linear-to-tr from-green-600/8 to-green-500/10 rounded-full blur-3xl" />
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen:  boolean;
  onClose: () => void;
  user:    AdminUser | null;
}

function AdminSidebar({ isOpen, onClose, user }: SidebarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const navItems: NavItem[] = [
    { href: '/admin',                   label: 'Dashboard',        icon: LayoutDashboard },
    { href: '/admin/employers',         label: 'Employers',        icon: Building2       },
    { href: '/admin/employees',         label: 'Employees',        icon: Users           },
    { href: '/admin/advances',          label: 'Advances',         icon: CreditCard      },
    { href: '/admin/reconciliation',    label: 'Reconciliation',   icon: BarChart3       },
    { href: '/admin/kyc-review',        label: 'KYC Review',       icon: CheckCircle2    },
    { href: '/admin/risk-scoring',      label: 'Risk Scoring',     icon: Shield          },
    { href: '/admin/fraud-detection',   label: 'Fraud Detection',  icon: AlertTriangle   },
    { href: '/admin/review-management', label: 'Review Requests',  icon: HelpCircle      },
    { href: '/admin/api-health',        label: 'API Health',       icon: Wifi            },
  ];

  const isActive = (href: string): boolean => {
    if (href === '/admin') return pathname === '/admin';
    return pathname?.startsWith(href) ?? false;
  };

  const handleLogout = async () => {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
    await supabase.auth.signOut();
    router.replace('/');
  };

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? 'A';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 border-r border-slate-200/50 dark:border-slate-700/50',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50">
          <Link href="/admin" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-11 h-11 bg-linear-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center shadow-lg shadow-green-600/25">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 dark:text-white block tracking-tight">
                EaziWage
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                Admin Portal
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="absolute top-6 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon   = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                    active
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50',
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                      active ? 'bg-white/20' : 'bg-linear-to-br from-green-600 to-green-700',
                    )}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-linear-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {user?.full_name ?? 'Admin'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={handleLogout}
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
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  onMenuClick: () => void;
  user:    AdminUser | null;
}

function AdminHeader({ onMenuClick, user }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications,      setNotifications]     = useState<Notification[]>([]);

  const notificationsRef = useRef<HTMLDivElement>(null);

  // Fetch notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/admin/notifications');
        if (res.ok) {
          const data: Notification[] = await res.json();
          setNotifications(data.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };
    fetchNotifications();
  }, []);

  // Click-outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12)  return 'Good Morning';
    if (hour < 17)  return 'Good Afternoon';
    return 'Good Evening';
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
      <div className="px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">

          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{getGreeting()}</p>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{user?.role || 'Admin Portal'}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:flex"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="relative p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-medium px-2 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={cn(
                            'p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors',
                            !notif.read && 'bg-green-50/30 dark:bg-green-900/10',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                notif.type === 'review_request'  && 'bg-green-100 dark:bg-green-900/30',
                                notif.type === 'employer_kyc'    && 'bg-amber-100 dark:bg-amber-500/20',
                                notif.type === 'flagged_advance' && 'bg-red-100   dark:bg-red-500/20',
                              )}
                            >
                              {notif.type === 'review_request'  && <Shield        className="w-4 h-4 text-green-600 dark:text-green-400" />}
                              {notif.type === 'employer_kyc'    && <Building2     className="w-4 h-4 text-amber-600" />}
                              {notif.type === 'flagged_advance' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {notif.title}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{notif.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export interface AdminPortalLayoutProps {
  children: React.ReactNode;
}

export function AdminPortalLayout({ children }: AdminPortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user,        setUser]        = useState<AdminUser | null>(null);

  // Fetch current user from Supabase session
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const fallbackName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Admin';
        const fallbackEmail = user.email || '';
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('id', user.id)
          .single<AdminUser>();

        if (profile) {
          setUser({
            ...profile,
            full_name: profile.full_name || fallbackName,
            email: profile.email || fallbackEmail,
          });
          return;
        }

        setUser({
          id: user.id,
          full_name: fallbackName,
          email: fallbackEmail,
          role: (user.user_metadata?.role as string) || 'admin',
        });
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="min-h-screen">
      <AdminBackground />
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

      <div className="lg:ml-72 min-h-screen flex flex-col">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} user={user} />
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default AdminPortalLayout;
