"use client"
import {
  LayoutDashboard, Users, CreditCard, BarChart3, Settings, LogOut,
  Menu, X, ChevronRight, Upload, HelpCircle, Shield, Wallet, MessageSquare, Search
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import Link from 'next/link';
import { logout } from '@/actions/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { NotificationDropdown } from '../layout/NotificationDropdown';
import { DashboardBreadcrumbs } from '../layout/DashboardBreadcrumbs';
import PushClient from '@/components/push/PushClient';
import { PaydayRecoupmentModal } from './PaydayRecoupmentModal';
import { useSidebarPanel } from '@/hooks/useSidebarPanel';
import { SidebarResizeControls } from '../layout/SidebarResizeControls';
import { CommandPalette } from './CommandPalette';
import { SatisfactionPromptMount } from '@/components/shared/SatisfactionPrompt';


export const EmployerBackground = () => (
  <>
    <div className="fixed inset-0 gradient-mesh pointer-events-none" />
    <div className="fixed inset-0 bg-grid pointer-events-none" />
    <div className="fixed top-0 right-0 w-150 h-150 bg-primary/8 rounded-full blur-[150px] pointer-events-none" />
    <div className="fixed bottom-0 left-0 w-125 h-125 bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none" />
    <div className="fixed top-1/2 left-1/3 w-100 h-100 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
  </>
);

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EmployerUser {
  id?: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
}

const ContactSupportModal = ({ isOpen, onClose }: ContactSupportModalProps) => {
  const [formData, setFormData] = useState({ subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ subject: '', message: '' });
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-primary to-emerald-600 p-6">
          <h2 className="text-xl font-bold text-white">Contact Support</h2>
          <p className="text-white/80 text-sm mt-1">We&apos;re here to help 24/7</p>
        </div>
        
        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Message Sent!</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Our team will respond within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Subject</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief description of your issue"
                required
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Message</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Describe your issue in detail..."
                rows={4}
                required
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                className="flex-1 bg-linear-to-r from-primary to-emerald-600 text-white"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

interface SidebarNavProps {
    isOpen: boolean;
    onClose: () => void;
    width: number;
    collapsed: boolean;
    onToggleCollapse: () => void;
    onStartResize: (e: React.MouseEvent) => void;
    isResizing: boolean;
}
const SidebarNav = ({ isOpen, onClose, width, collapsed, onToggleCollapse, onStartResize, isResizing }: SidebarNavProps) => {
  const location = usePathname();
  const user = useAuthStore((state) => state.user as EmployerUser | null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const avatarUrl = user?.avatar_url;

  const fullName = mounted ? (user?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Employer') : 'Employer';
  const userEmail = mounted ? (user?.email || 'No email') : 'No email';
  const initials = mounted ? (fullName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'E') : 'E';

  const navItems = [
    { href: '/dashboards/employer-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboards/employer-dashboard/employees', label: 'Employees', icon: Users },
    { href: '/dashboards/employer-dashboard/payroll', label: 'Payroll', icon: Upload },
    { href: '/dashboards/employer-dashboard/wallet', label: 'Wallet & Funding', icon: Wallet },
    { href: '/dashboards/employer-dashboard/messages', label: 'Communication', icon: MessageSquare },
    { href: '/dashboards/employer-dashboard/advances', label: 'Advances', icon: CreditCard },
    { href: '/dashboards/employer-dashboard/reports', label: 'Reports', icon: BarChart3 },
    { href: '/dashboards/employer-dashboard/risk-insights', label: 'Risk Insights', icon: Shield },
    { href: '/dashboards/employer-dashboard/settings', label: 'Settings', icon: Settings },
  ];
  
  const isActive = (path: string) => {
    return location === path;
  }

  return (
    <>
      
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      
      <aside
        style={{ width }}
        className={cn(
          "fixed left-0 top-0 h-screen z-50 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isResizing ? "" : "transition-[transform,width] duration-300",
        )}
      >

        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50" />

        <SidebarResizeControls
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          onStartResize={onStartResize}
          hoverLineClassName="group-hover:bg-primary/60"
        />

        <div className="relative flex flex-col h-full overflow-hidden">

          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <Link href="/" className="flex items-center gap-3" data-testid="sidebar-logo">
              <div className="w-12 h-12 shrink-0 bg-linear-to-br from-emerald-500/20 to-green-500/20 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10 border border-slate-100 dark:border-slate-800">
                <Wallet
                  className="h-8 w-8 text-emerald-700"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <span className="font-heading font-bold text-xl text-slate-900 dark:text-white block">EaziWage</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                    Employer
                  </span>
                </div>
              )}
            </Link>


            <button
              onClick={onClose}
              className="absolute top-6 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-primary text-white shadow-lg shadow-primary/25"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <div className={cn(
                    "w-9 h-9 shrink-0 rounded-xl flex items-center justify-center transition-all",
                    active
                      ? "bg-white/20"
                      : "bg-linear-to-br from-primary to-emerald-600"
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                  {!collapsed && active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}

            {!collapsed && (
              <div className="mt-6 bg-linear-to-br from-primary/10 to-emerald-500/10 dark:from-primary/20 dark:to-emerald-500/20 rounded-2xl p-4 border border-primary/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                    <HelpCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Need Help?</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">We&apos;re here 24/7</p>
                  </div>
                </div>
                <button
                  onClick={() => window.location.href = "https://app.eaziwage.com/contact"}
                  className="w-full mt-2 px-4 py-2 bg-white dark:bg-slate-800 text-primary text-sm font-medium rounded-xl hover:shadow-md transition-all"
                  data-testid="contact-support-btn"
                >
                  Contact Support
                </button>
              </div>
            )}
          </nav>


          <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <div className={cn("flex items-center gap-3 mb-4", collapsed && "justify-center")}>
              <Avatar className="w-11 h-11 rounded-xl shadow-md border border-slate-100 dark:border-slate-800 shrink-0">
                <AvatarImage src={avatarUrl} alt={fullName} />
                <AvatarFallback className="bg-linear-to-br from-primary to-emerald-600 text-white font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {userEmail}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={logout}
                title={collapsed ? 'Sign Out' : undefined}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                data-testid="sidebar-logout-btn"
              >
                <LogOut className="w-4 h-4" />
                {!collapsed && 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      
      <ContactSupportModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </>
  );
};
interface TopHeaderProps {
    onMenuClick: () => void;
    employer: {
        company_name: string;
    } | null;
}
const TopHeader = ({ onMenuClick, employer }: TopHeaderProps) => {
  const user = useAuthStore((state) => state.user as EmployerUser | null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const hour = mounted ? new Date().getHours() : 9;
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (

    <header className="sticky top-0 z-30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
      <div className="px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              data-testid="mobile-menu-btn"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{greeting}</p>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {employer?.company_name || 'Company Portal'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
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

            {user?.id && (
              <NotificationDropdown
                role="employer"
                userId={user.id}
                apiPath="/api/employer-dashboard/notifications"
                viewAllHref="/dashboards/employer-dashboard/notifications"
                primaryColor="blue-600"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

interface EmployerPortalLayoutProps {
  children: React.ReactNode;
  employer?: {
    company_name: string;
  } | null;
}
export const EmployerPortalLayout = ({ children, employer = null }: EmployerPortalLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebar = useSidebarPanel({ storageKey: 'employer' });
  const user = useAuthStore((state) => state.user as EmployerUser | null);
  const pathname = usePathname();
  const router = useRouter();
  const isEmployerDashboardHome = pathname === '/dashboards/employer-dashboard';

  const checkAccess = useCallback(async () => {
    if (!user?.id) return;
    if (pathname === '/dashboards/employer-dashboard/onboarding') return;

    try {
      const res = await fetch('/api/employer-dashboard/status');

      if (!res.ok) {
        router.push('/dashboards/employer-dashboard/onboarding');
        return;
      }

      const data = await res.json();

      switch (data.status) {
        case 'active':
          return;

        case 'terminated':
          router.push('/');
          return;

        case 'not_onboarded':
        case 'pending':
        case 'submitted':
        case 'risk_review_in_progress':
        case 'rejected':
          if (isEmployerDashboardHome) return;
          router.push('/dashboards/employer-dashboard');
          return;

        case 'draft':
        default:
          router.push('/dashboards/employer-dashboard/onboarding');
          return;
      }
    } catch (err) {
      console.error('Access check failed', err);
    }
  }, [user?.id, pathname, router, isEmployerDashboardHome]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`realtime:employer-status:${user.id}`)
      // Watch employer's own onboarding record — fires when admin changes status
      .on('postgres_changes' as const, {
        event: 'UPDATE',
        schema: 'public',
        table: 'employer_onboarding',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newStatus = (payload.new as { status?: string })?.status;
        if (newStatus === 'approved') {
          toast.success('Your account has been approved!', {
            description: 'You now have full access to your employer dashboard.',
          });
        } else if (newStatus && newStatus !== 'draft') {
          toast.info(`Account status updated to: ${newStatus.replace(/_/g, ' ')}`, {
            description: 'Your employer profile status has changed.',
          });
        }
        void checkAccess();
      })
      // Watch employers table sync — fires after admin approval completes
      .on('postgres_changes' as const, {
        event: '*',
        schema: 'public',
        table: 'employers',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        void checkAccess();
      })
      // Keep original listener for org settings changes
      .on('postgres_changes' as const, {
        event: 'UPDATE',
        schema: 'public',
        table: 'employee_onboarding',
      }, () => {
        toast.success('Organization settings updated', {
          description: 'Your organization settings have been updated by an administrator.',
          icon: <Settings className="w-5 h-5 text-blue-600" />,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, checkAccess]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300" data-testid="employer-dashboard">
      <EmployerBackground />
      <PushClient />
      <PaydayRecoupmentModal />
      <CommandPalette />
      <SatisfactionPromptMount />

      <SidebarNav
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={sidebar.effectiveWidth}
        collapsed={sidebar.isDesktop && sidebar.collapsed}
        onToggleCollapse={sidebar.toggleCollapsed}
        onStartResize={sidebar.startResize}
        isResizing={sidebar.isResizing}
      />

      <div className="relative" style={{ marginLeft: sidebar.contentMarginLeft, transition: sidebar.isResizing ? undefined : 'margin-left 300ms' }}>
        <TopHeader onMenuClick={() => setSidebarOpen(true)} employer={employer} />
        
        <main className="p-4 lg:p-8">
          <DashboardBreadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
};

export default EmployerPortalLayout;
