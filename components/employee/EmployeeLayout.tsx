"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  user_metadata?: {
    full_name?: string;
  };
}

// ─── Background Component ─────────────────────────────────────────────────────

export const EmployeeBackground = () => (
  <>
    <div className="fixed inset-0 gradient-mesh pointer-events-none" />
    <div className="fixed inset-0 bg-grid pointer-events-none opacity-[0.05]" />
    <div className="fixed top-0 right-0 w-150 h-150 bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
    <div className="fixed bottom-0 left-0 w-125 h-125 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
  </>
);

// ─── Sidebar Component ────────────────────────────────────────────────────────

interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  user: EmployeeUser | null;
}

const EmployeeSidebarNav = ({ isOpen, onClose, user }: SidebarNavProps) => {
  const pathname = usePathname();

  const menuItems = [
    { label: 'Home',            href: '/dashboards/employee-dashboard',              icon: Home },
    { label: 'Request Advance', href: '/dashboards/employee-dashboard/request-advance', icon: Wallet },
    { label: 'Transactions',    href: '/dashboards/employee-dashboard/transactions',    icon: History },
    { label: 'KYC Verification', href: '/dashboards/employee-dashboard/onboarding',      icon: Shield },
    { label: 'Profile Settings', href: '/dashboards/employee-dashboard/settings',        icon: User },
  ];

  const isActive = (path: string) => {
    return path === '/dashboards/employee-dashboard' ? pathname === path : pathname.startsWith(path);
  };

  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-screen w-72 z-50 transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Glass Background */}
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50" />
        
        <div className="relative flex flex-col h-full overflow-hidden">
          {/* Logo Section */}
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <Link href="/dashboards/employee-dashboard" className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10 border border-slate-100 dark:border-slate-800">
                <Image
                  src="/logo.png"
                  alt="EaziWage Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div>
                <span className="font-heading font-bold text-xl text-slate-900 dark:text-white block">EaziWage</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Employee
                </span>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-6 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation - Scrollable */}
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
                      ? "bg-primary text-white shadow-lg shadow-primary/25"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    active 
                      ? "bg-white/20" 
                      : "bg-linear-to-br from-primary to-indigo-600"
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}

            {/* Help Card */}
            <div className="mt-6 bg-linear-to-br from-primary/5 to-indigo-500/5 dark:from-primary/10 dark:to-indigo-500/10 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-linear-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <HelpCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Need help?</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Support Center</p>
                </div>
              </div>
              <button 
                className="w-full mt-2 px-4 py-2 bg-white dark:bg-slate-800 text-primary text-sm font-medium rounded-xl hover:shadow-md transition-all"
              >
                Contact Us
              </button>
            </div>
          </nav>

          {/* User Section - Fixed at bottom */}
          <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 shrink-0 mb-20 lg:mb-0">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-11 h-11 rounded-xl shadow-md border border-slate-100 dark:border-slate-800">
                <AvatarImage src={(user as any)?.avatar_url} alt={fullName} />
                <AvatarFallback className="bg-linear-to-br from-primary to-indigo-600 text-white font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {fullName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || 'No email'}
                </p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// ─── Top Header Component ─────────────────────────────────────────────────────

interface TopHeaderProps {
  onMenuClick: () => void;
  user: EmployeeUser | null;
  title?: string;
}

const EmployeeTopHeader = ({ onMenuClick, user, title }: TopHeaderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeChat, setActiveChat] = useState<{ id: string; name: string } | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await fetch('/api/employee-dashboard/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    };

    loadNotifications();

    if (user?.id && pusherClient) {
      const channel = pusherClient.subscribe(`user-${user.id}`);
      channel.bind('new-notification', (data: Notification) => {
        setNotifications(prev => [data, ...prev].slice(0, 10));
        toast(data.title, {
          description: data.message,
          icon: <Bell className="w-5 h-5 text-primary" />
        });
      });

      channel.bind('notification-deleted', (data: { id: string }) => {
        setNotifications(prev => prev.filter(n => String(n.id) !== String(data.id)));
      });

      return () => {
        pusherClient!.unsubscribe(`user-${user.id}`);
      };
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/employee-dashboard/notifications?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        toast.success('Notification deleted');
      }
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-700/30">
      <div className="px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {title && (
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Employee</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-14 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-top-2 fade-in">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center">
                        <Bell className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          className={cn(
                            "p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all relative group",
                            !notif.read && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-3 pr-8">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              notif.type === 'advance_approval' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" :
                              notif.type === 'kyc_update' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                              "bg-primary/10 text-primary"
                            )}>
                              {notif.type === 'advance_approval' ? <CheckCircle2 className="w-4 h-4" /> :
                               notif.type === 'kyc_update' ? <Shield className="w-4 h-4" /> :
                               <Bell className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-medium",
                                notif.read ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"
                              )}>
                                {notif.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 truncate">{notif.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {!notif.read && (
                              <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />
                            )}
                          </div>
                          <button 
                            onClick={(e) => handleDelete(e, notif.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/30">
                    <Link 
                      href="/dashboards/employee-dashboard/notifications"
                      className="block w-full text-center text-sm font-medium text-primary hover:text-primary/80 py-2 rounded-xl hover:bg-primary/5 transition-colors"
                      onClick={() => setShowNotifications(false)}
                    >
                      View All Notifications
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeChat && user && (
        <ChatWindow 
          currentUserId={user.id ?? 'unknown-user'}
          otherUserId={activeChat.id}
          otherUserName={activeChat.name}
          onClose={() => setActiveChat(null)}
        />
      )}
    </header>
  );
};

// ─── Enhanced Mobile Nav (The Dock) ───────────────────────────────────────────

export const FloatingNav = () => {
  const location = usePathname();
  const router = useRouter();

  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/dashboards/employee-dashboard' },
    { id: 'advance', icon: Wallet, label: 'Advance', path: '/dashboards/employee-dashboard/request-advance' },
    { id: 'history', icon: History, label: 'History', path: '/dashboards/employee-dashboard/transactions' },
    { id: 'profile', icon: User, label: 'Profile', path: '/dashboards/employee-dashboard/settings' },
  ];

  const isActive = (path: string) => location === path;

  return (
    <nav className="fixed bottom-6 left-0 right-0 z-50 px-6 lg:hidden">
      <div className="max-w-md mx-auto">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-primary/10 border border-white/20 dark:border-slate-800/50 p-2">
          <div className="flex items-center justify-between relative">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.path)}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-2.5 flex-1 rounded-2xl transition-all duration-500 group",
                    active ? "text-primary" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  )}
                >
                  {active && (
                    <div className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-2xl animate-in fade-in zoom-in duration-300" />
                  )}
                  <item.icon className={cn(
                    "w-5 h-5 mb-1 transition-all duration-300 relative z-10",
                    active ? "scale-110" : "group-hover:scale-110"
                  )} />
                  <span className="text-[10px] font-bold uppercase tracking-tighter relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

// ─── Main Portal Layout ───────────────────────────────────────────────────────

interface EmployeePortalLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function EmployeePortalLayout({ children, title }: EmployeePortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const router = useRouter();
  const isHydrated = true;
  const hasCheckedAuth = useRef(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [directSessionValid, setDirectSessionValid] = useState<boolean | null>(null);

  // 🔧 FIX: Check direct Supabase session as fallback when auth store might be out of sync
  useEffect(() => {
    const checkDirectSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        setDirectSessionValid(!!session);
        setSessionChecked(true);
      } catch (error) {
        console.error('Direct session check failed:', error);
        setDirectSessionValid(false);
        setSessionChecked(true);
      }
    };

    // Only check after hydration and when auth store loading is complete
    if (isHydrated && !loading) {
      checkDirectSession();
    }
  }, [isHydrated, loading]);

  // ✅ CRITICAL FIX: Use useRef to prevent multiple redirects + delay buffer
  useEffect(() => {
    // Wait for hydration
    if (!isHydrated) return;
    
    // Don't redirect if still loading from auth store
    if (loading) return;
    
    // Wait for direct session check to complete
    if (!sessionChecked) return;
    
    // Only check auth once per mount
    if (hasCheckedAuth.current) return;
    
    // Mark that we've checked
    hasCheckedAuth.current = true;
    
    // Check both auth store user AND direct session
    const hasUser = user || directSessionValid;
    
    if (!hasUser) {
      console.log('No user found (auth store:', user, ', direct session:', directSessionValid, '), redirecting to login');
      router.replace('/');
    }
  }, [user, loading, router, isHydrated, sessionChecked, directSessionValid]);

  // Show loading state - wait for both auth store AND direct session check
  if (!isHydrated || loading || !sessionChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Check both auth store user AND direct session for rendering
  const hasUser = user || directSessionValid;
  
  // Don't render if no user (will redirect)
  if (!hasUser) {
    return null;
  }

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

// Compatibility exports
export { EmployeePortalLayout as EmployeePageLayout };
export const EmployeeHeader = ({ title, rightContent }: { title: string; rightContent?: React.ReactNode }) => (
  <div className="mb-6 flex items-center justify-between gap-4">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
    {rightContent ? <div>{rightContent}</div> : null}
  </div>
);

export default EmployeePortalLayout;
