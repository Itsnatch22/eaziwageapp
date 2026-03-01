"use client"
import { 
  LayoutDashboard, Users, CreditCard, BarChart3, Settings, LogOut, 
  Sun, Moon, Bell, Menu, X, ChevronRight, Upload, HelpCircle, Shield
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../lib/ThemeContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import Link from 'next/link';
import { logout } from '@/actions/auth';
import React,{ useState, useRef, useEffect, useCallback }from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import pusherClient from '@/lib/pusher-client';
import { toast } from 'sonner';

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

const ContactSupportModal = ({ isOpen, onClose }: ContactSupportModalProps) => {
  const [formData, setFormData] = useState({ subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: any) => {
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
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-primary to-emerald-600 p-6">
          <h2 className="text-xl font-bold text-white">Contact Support</h2>
          <p className="text-white/80 text-sm mt-1">We're here to help 24/7</p>
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
}
const SidebarNav = ({ isOpen, onClose }: SidebarNavProps) => {
  const location = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const user = useAuthStore((state: { user: any; }) => state.user);
  const [isHydrated, setIsHydrated] = useState(false);
  const [profileIdentity, setProfileIdentity] = useState<{ full_name?: string; email?: string } | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const authName =
    user?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    '';
  const authEmail = user?.email || user?.user_metadata?.email || '';
  const fullName =
    authName?.trim() ||
    profileIdentity?.full_name?.trim() ||
    profileIdentity?.email?.split('@')[0] ||
    'User';
  const userEmail = authEmail || profileIdentity?.email || 'No email';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U';

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const fetchIdentity = async () => {
      try {
        const res = await fetch('/api/employer-dashboard/profile');
        const data = await res.json();
        if (!res.ok) return;
        const profile = data?.profile || {};
        setProfileIdentity({
          full_name: profile?.full_name || profile?.contact_person || '',
          email: profile?.email || profile?.contact_email || '',
        });
      } catch {
        // Non-fatal; auth store is primary source.
      }
    };
    fetchIdentity();
  }, []);

  const navItems = [
    { href: '/dashboards/employer-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboards/employer-dashboard/employees', label: 'Employees', icon: Users },
    { href: '/dashboards/employer-dashboard/payroll', label: 'Payroll', icon: Upload },
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
            <Link href="/" className="flex items-center gap-3" data-testid="sidebar-logo">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25">
                <span className="text-white font-bold text-xl">E</span>
              </div>
              <div>
                <span className="font-heading font-bold text-xl text-slate-900 dark:text-white block">EaziWage</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                  Employer
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
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
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
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    active 
                      ? "bg-white/20" 
                      : "bg-linear-to-br from-primary to-emerald-600"
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}

            {/* Help Card - Now inside scrollable area */}
            <div className="mt-6 bg-linear-to-br from-primary/10 to-emerald-500/10 dark:from-primary/20 dark:to-emerald-500/20 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                  <HelpCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Need Help?</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">We're here 24/7</p>
                </div>
              </div>
              <button 
                onClick={() => setShowContactModal(true)}
                className="w-full mt-2 px-4 py-2 bg-white dark:bg-slate-800 text-primary text-sm font-medium rounded-xl hover:shadow-md transition-all"
                data-testid="contact-support-btn"
              >
                Contact Support
              </button>
            </div>
          </nav>

          {/* User Section - Fixed at bottom */}
          <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">
                  {isHydrated ? initials : 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {isHydrated ? fullName : 'User'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isHydrated ? userEmail : 'No email'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={logout}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                data-testid="sidebar-logout-btn"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Contact Support Modal */}
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
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [greeting, setGreeting] = useState('Welcome');
  const [notifications, setNotifications] = useState<any[]>([]);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const user = useAuthStore((state: any) => state.user);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/employer-dashboard/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }, []);

  // Fetch real notifications
  useEffect(() => {
    fetchNotifications();

    if (user?.id && pusherClient) {
      const channel = pusherClient.subscribe(`employer-${user.id}`);
      channel.bind('new-notification', (data: any) => {
        toast(data.title, {
          description: data.message,
          icon: <Bell className="w-5 h-5 text-primary" />
        });
        fetchNotifications();
      });

      return () => {
        pusherClient!.unsubscribe(`employer-${user.id}`);
      };
    }
  }, [user?.id, fetchNotifications]);
  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: { target: any; }) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good Morning');
      return;
    }
    if (hour < 17) {
      setGreeting('Good Afternoon');
      return;
    }
    setGreeting('Good Evening');
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
      <div className="px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Menu + Greeting */}
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

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:flex"
              data-testid="header-theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {/* Notifications Bell with Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                data-testid="notifications-btn"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full ring-2 ring-white dark:ring-slate-900 text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={cn(
                          "p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors",
                          !notif.read && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            notif.type === 'advance' && "bg-primary/10",
                            notif.type === 'system' && "bg-amber-100 dark:bg-amber-500/20",
                            notif.type === 'employee' && "bg-blue-100 dark:bg-blue-500/20"
                          )}>
                            {notif.type === 'advance' && <CreditCard className="w-4 h-4 text-primary" />}
                            {notif.type === 'system' && <Bell className="w-4 h-4 text-amber-600" />}
                            {notif.type === 'employee' && <Users className="w-4 h-4 text-blue-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium",
                              notif.read ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"
                            )}>
                              {notif.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 truncate">{notif.message}</p>
                            <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
                          </div>
                          {!notif.read && (
                            <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/30">
                    <Link 
                      href="/dashboards/employer-dashboard/notifications"
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
    </header>
  );
};

interface EmployerPortalLayoutProps {
  children: React.ReactNode;
  employer: {
    company_name: string;
  } | null;
}
export const EmployerPortalLayout = ({ children, employer }: EmployerPortalLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300" data-testid="employer-dashboard">
      <EmployerBackground />
      
      <SidebarNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:ml-72 relative">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} employer={employer} />
        
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default EmployerPortalLayout;

