'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Building2, CreditCard, BarChart3, Settings, LogOut,
  Bell, Menu, X, ChevronRight, Shield, CheckCircle2, Wifi,
  AlertTriangle, Loader2, Trash2, MessageSquare, HelpCircle, ClipboardCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import pusherClient from '@/lib/pusher-client';
import { toast } from 'sonner';
import { ChatWindow } from '../layout/ChatWindow';
import { logout } from '@/actions/auth';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/lib/stores/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface Notification {
  id: string;
  type: 'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// ─── Background Component ─────────────────────────────────────────────────────

export const AdminBackground = () => (
  <>
    <div className="fixed inset-0 gradient-mesh pointer-events-none" />
    <div className="fixed inset-0 bg-grid pointer-events-none" />
    <div className="fixed top-0 right-0 w-150 h-150 bg-green-600/5 rounded-full blur-[150px] pointer-events-none" />
    <div className="fixed bottom-0 left-0 w-125 h-125 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
    <div className="fixed top-1/2 left-1/3 w-100 h-100 bg-blue-500/3 rounded-full blur-[100px] pointer-events-none" />
  </>
);

// ─── Sidebar Component ────────────────────────────────────────────────────────

interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}

const AdminSidebarNav = ({ isOpen, onClose, userProfile }: SidebarNavProps) => {
  const pathname = usePathname();

  const menuItems = [
    { label: 'Overview',        href: '/admin',                  icon: LayoutDashboard },
    { label: 'Advances',        href: '/admin/advances',         icon: CreditCard },
    { label: 'KYC Review',      href: '/admin/kyc-review',       icon: CheckCircle2 },
    { label: 'Employers',       href: '/admin/employers',        icon: Building2 },
    { label: 'Employees',       href: '/admin/employees',        icon: Users },
    { label: 'Review Requests', href: '/admin/review-requests',  icon: Shield },
    { label: 'Risk Scoring', href: '/admin/risk-scoring',  icon: ClipboardCheck },
    { label: 'Notifications',   href: '/admin/notifications',    icon: Bell },
    { label: 'Fraud Detection', href: '/admin/fraud-detection',  icon: AlertTriangle },
    { label: 'Reconciliation',  href: '/admin/reconciliation',   icon: BarChart3 },
    { label: 'System Health',   href: '/admin/api-health',       icon: Wifi },
    { label: 'Settings',        href: '/admin/settings',         icon: Settings },
  ];

  const isActive = (path: string) => {
    return path === '/admin' ? pathname === '/admin' : pathname.startsWith(path);
  };

  const fullName = userProfile?.full_name || userProfile?.email?.split('@')[0] || 'Admin';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'A';

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
            <Link href="/admin" className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/10 border border-slate-100 dark:border-slate-800">
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
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">
                  Admin Hub
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
                      ? "bg-green-600 text-white shadow-lg shadow-green-600/25"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    active 
                      ? "bg-white/20" 
                      : "bg-linear-to-br from-green-600 to-emerald-600"
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}

            {/* Support/Help Card */}
            <div className="mt-6 bg-linear-to-br from-green-600/10 to-emerald-500/10 dark:from-green-600/20 dark:to-emerald-500/20 rounded-2xl p-4 border border-green-600/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-linear-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                  <HelpCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Admin Help</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Documentation</p>
                </div>
              </div>
              <button 
                className="w-full mt-2 px-4 py-2 bg-white dark:bg-slate-800 text-green-600 text-sm font-medium rounded-xl hover:shadow-md transition-all"
              >
                View Docs
              </button>
            </div>
          </nav>

          {/* User Section - Fixed at bottom */}
          <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-11 h-11 rounded-xl shadow-md border border-slate-100 dark:border-slate-800">
                <AvatarImage src={(userProfile as any)?.avatar_url} alt={fullName} />
                <AvatarFallback className="bg-linear-to-br from-green-600 to-emerald-600 text-white font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {fullName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {userProfile?.email || 'No email'}
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

// ─── Header Component ─────────────────────────────────────────────────────────

interface TopHeaderProps {
  onMenuClick: () => void;
  userProfile: UserProfile | null;
}

const AdminTopHeader = ({ onMenuClick, userProfile }: TopHeaderProps) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeChat, setActiveChat] = useState<{ id: string; name: string } | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

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
    const timer = setTimeout(() => {
      void fetchNotifications();
    }, 0);

    if (pusherClient) {
      const channel = pusherClient.subscribe('admin-notifications');
      
      channel.bind('new-notification', (data: Notification) => {
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
        clearTimeout(timer);
        pusherClient!.unsubscribe('admin-notifications');
      };
    }
    return () => clearTimeout(timer);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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
              <p className="text-sm text-slate-500 dark:text-slate-400">{greeting}</p>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {userProfile?.full_name || 'Admin Portal'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveChat({ id: 'system-support', name: 'Support Channel' })}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            <div className="relative" ref={notificationsRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-green-600 rounded-full ring-2 ring-white dark:ring-slate-900 text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-medium px-2 py-1 bg-green-600/10 text-green-600 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          className={cn(
                            "p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors relative group",
                            !notif.read && "bg-green-600/5"
                          )}
                        >
                          <div className="flex items-start gap-3 pr-8">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              notif.type === 'review_request' && "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
                              notif.type === 'employer_kyc' && "bg-purple-100 dark:bg-purple-900/30 text-purple-600",
                              notif.type === 'flagged_advance' && "bg-red-100 dark:bg-red-900/30 text-red-600",
                              notif.type === 'system_alert' && "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                            )}>
                              {notif.type === 'review_request' && <Shield className="w-4 h-4" />}
                              {notif.type === 'employer_kyc' && <Building2 className="w-4 h-4" />}
                              {notif.type === 'flagged_advance' && <AlertTriangle className="w-4 h-4" />}
                              {notif.type === 'system_alert' && <Bell className="w-4 h-4" />}
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
                              <div className="w-2 h-2 bg-green-600 rounded-full mt-2 shrink-0" />
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
                      href="/admin/notifications"
                      className="block w-full text-center text-sm font-medium text-green-600 hover:text-green-700 py-2 rounded-xl hover:bg-green-600/5 transition-colors"
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

      {activeChat && userProfile && (
        <ChatWindow 
          currentUserId={userProfile.id}
          otherUserId={activeChat.id}
          otherUserName={activeChat.name}
          onClose={() => setActiveChat(null)}
        />
      )}
    </header>
  );
};

// ─── Main Portal Layout ───────────────────────────────────────────────────────

interface AdminPortalLayoutProps {
  children: React.ReactNode;
}

export function AdminPortalLayout({ children }: AdminPortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const isHydrated = true;

  const authUser = useAuthStore(s => s.user);
  const authLoading = useAuthStore(s => s.loading);
  
  const router = useRouter();

  useEffect(() => {
    // Wait for hydration before checking auth
    if (!isHydrated) return;
    
    if (authLoading) return;

    if (!authUser) {
      router.replace('/');
      return;
    }

    async function fetchProfile() {
      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json();

        if (!res.ok || data.error) {
          console.error('Error fetching admin profile:', data.error);
          setIsAuthorized(false);
          return;
        }

        const allowedRoles = ['admin', 'super_admin', 'compliance', 'employer_admin'];
        
        // Check if user has an admin role
        const hasAdminRole = data.is_admin || 
          (data.role_candidates && data.role_candidates.some((role: string) => allowedRoles.includes(role)));

        if (!hasAdminRole) {
          // Try to determine where to redirect based on role
          const role = data.profiles_role || data.app_metadata_role || data.user_metadata_role;
          if (role === 'employer') {
            router.replace('/dashboards/employer-dashboard');
          } else {
            router.replace('/dashboards/employee-dashboard');
          }
          return;
        }

        setUserProfile({
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          role: data.profiles_role || 'admin',
        });
        setIsAuthorized(true);
      } catch (err) {
        console.error('Admin layout check failed:', err);
        setIsAuthorized(false);
      }
    }

    fetchProfile();
  }, [authUser, authLoading, router, isHydrated]);

  if (!isHydrated || authLoading || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Verifying access...</p>
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Unauthorized Access</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 text-center max-w-md">
          Your account does not have the necessary permissions to access the Admin Hub.
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
      
      <AdminSidebarNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userProfile={userProfile} />
      
      <div className="lg:ml-72 relative">
        <AdminTopHeader onMenuClick={() => setSidebarOpen(true)} userProfile={userProfile} />
        
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminPortalLayout;
