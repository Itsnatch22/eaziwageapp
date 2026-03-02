'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link          from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  LayoutDashboard, Users, Building2, CreditCard, BarChart3, Settings, LogOut,
  Sun, Moon, Bell, Menu, X, ChevronRight, Shield, CheckCircle2, Wifi,
  AlertTriangle, HelpCircle, Loader2, Trash2
} from 'lucide-react';
import { cn }        from '@/lib/utils';
import pusherClient from '@/lib/pusher-client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id:        string;
  email:     string;
  full_name: string | null;
  role:      string;
}

interface Notification {
  id:         string;
  type:       'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert';
  title:      string;
  message:    string;
  read:       boolean;
  created_at: string;
  metadata?:  Record<string, unknown>;
}

// ─── Header Component ─────────────────────────────────────────────────────────

interface HeaderProps {
  onMenuClick: () => void;
  user:        UserProfile | null;
  isLoadingUser: boolean;
}

function AdminHeader({ onMenuClick, user, isLoadingUser }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Failed to load admin notifications', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    if (pusherClient) {
      const channel = pusherClient.subscribe('admin-notifications');
      
      channel.bind('new-notification', (data: any) => {
        setNotifications(prev => [data, ...prev].slice(0, 50));
        toast(data.title, {
          description: data.message,
          icon: <Bell className="w-5 h-5 text-green-600" />
        });
      });

      channel.bind('notification-deleted', (data: { id: string }) => {
        setNotifications(prev => prev.filter(n => String(n.id) !== String(data.id)));
      });

      return () => {
        pusherClient.unsubscribe('admin-notifications');
      };
    }
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNotifications]);

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: unreadIds })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error('Failed to mark notifications as read', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
        const res = await fetch(`/api/admin/notifications?id=${id}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            setNotifications(prev => prev.filter(n => String(n.id) !== String(id)));
            toast.success('Notification deleted');
        }
    } catch (err) {
        toast.error('Failed to delete notification');
    }
  };

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
              {isLoadingUser ? (
                <>
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1" />
                  <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{getGreeting()}</p>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                    {user?.full_name || 'Admin Portal'}
                  </h1>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                        <button 
                            onClick={handleMarkAllRead}
                            className="text-[10px] uppercase tracking-wider font-bold text-green-600 hover:text-green-700 transition-colors"
                        >
                            Mark All Read
                        </button>
                        )}
                    </div>
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
                            'p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors relative group',
                            !notif.read && 'bg-green-50/30 dark:bg-green-900/10',
                          )}
                        >
                          <div className="flex items-start gap-3 pr-8">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                notif.type === 'review_request'  && 'bg-green-100 dark:bg-green-900/30',
                                notif.type === 'employer_kyc'    && 'bg-amber-100 dark:bg-amber-500/20',
                                notif.type === 'flagged_advance' && 'bg-red-100   dark:bg-red-500/20',
                                (notif.type as string) === 'new_employer' && 'bg-blue-100 dark:bg-blue-500/20',
                              )}
                            >
                              {notif.type === 'review_request'  && <Shield        className="w-4 h-4 text-green-600 dark:text-green-400" />}
                              {notif.type === 'employer_kyc'    && <Building2     className="w-4 h-4 text-amber-600" />}
                              {notif.type === 'flagged_advance' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                              {(notif.type as string) === 'new_employer' && <Users className="w-4 h-4 text-blue-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium", !notif.read ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>
                                {notif.title}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{notif.message}</p>
                            </div>
                          </div>

                          <button 
                                onClick={(e) => handleDelete(e, notif.id)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                                title="Delete notification"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    href="/admin/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="block py-3 text-center text-xs font-semibold text-green-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-t border-slate-200/50 dark:border-slate-700/30"
                  >
                    View All Notifications
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Sidebar Component ────────────────────────────────────────────────────────

function AdminSidebar({ isOpen, onClose, pathname }: { isOpen: boolean; onClose: () => void; pathname: string }) {
  const menuItems = [
    { label: 'Overview',       href: '/admin',                  icon: LayoutDashboard },
    { label: 'Review Requests', href: '/admin/review-requests',  icon: Shield },
    { label: 'Employers',      href: '/admin/employers',        icon: Building2 },
    { label: 'Employees',      href: '/admin/employees',        icon: Users },
    { label: 'Advances',       href: '/admin/advances',         icon: CreditCard },
    { label: 'KYC Review',     href: '/admin/kyc-review',       icon: CheckCircle2 },
    { label: 'Reconciliation', href: '/admin/reconciliation',   icon: BarChart3 },
    { label: 'Notifications',  href: '/admin/notifications',    icon: Bell },
    { label: 'System Health',  href: '/admin/api-health',       icon: Wifi },
    { label: 'Settings',       href: '/admin/settings',         icon: Settings },
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 z-50 transition-transform duration-300 transform bg-white dark:bg-slate-900 border-r border-slate-200/50 dark:border-slate-700/50',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-600/20">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="font-bold text-xl text-slate-900 dark:text-white">Admin Hub</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const active = pathname === item.href || (pathname === '/admin' && item.href === '/admin');
              const Icon   = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => onClose()}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all group',
                    active
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                  )}
                >
                  <Icon className={cn('w-5 h-5', !active && 'group-hover:scale-110 transition-transform')} />
                  <span className="font-medium">{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Main Portal Layout ───────────────────────────────────────────────────────

interface AdminPortalLayoutProps {
  children: React.ReactNode;
}

export function AdminPortalLayout({ children }: AdminPortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser]               = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  
  const pathname = usePathname();
  const router   = useRouter();

  // Load User & Check Auth
  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.replace('/');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .eq('id', session.user.id)
          .single();

        const role = profile?.role as any;
        if (!role || !['admin', 'super_admin', 'compliance', 'employer_admin'].includes(role)) {
          // Redirect to appropriate dashboard based on role
          if (role === 'employer') {
            router.replace('/dashboards/employer-dashboard');
          } else {
            router.replace('/dashboards/employee-dashboard');
          }
          return;
        }

        setUser(profile as UserProfile);
      } catch (err) {
        console.error('Failed to load user profile:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pathname={pathname}
      />

      {/* Main Content */}
      <div className="lg:ml-64 transition-all duration-300">
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
          isLoadingUser={isLoading}
        />

        <main className="p-4 lg:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminPortalLayout;
