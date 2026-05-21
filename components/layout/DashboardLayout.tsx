"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Users, Building2, FileText, CreditCard, 
  Settings, LogOut, Shield, ChevronRight, Bell, Home,
  Wallet, History, Upload, BarChart3, CheckCircle2, HelpCircle
} from 'lucide-react';
import { cn, generateInitials } from '../../lib/utils';
import { logout } from '@/actions/auth';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';

const employeeLinks = [
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/advances', label: 'Request Advance', icon: Wallet },
  { href: '/employee/transactions', label: 'Transactions', icon: History },
  { href: '/employee/kyc', label: 'KYC Documents', icon: FileText },
  { href: '/employee/profile', label: 'Profile', icon: Settings },
];

const employerLinks = [
  { href: '/employer', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employer/employees', label: 'Employees', icon: Users },
  { href: '/employer/payroll', label: 'Payroll', icon: Upload },
  { href: '/employer/advances', label: 'Advances', icon: CreditCard },
  { href: '/employer/reports', label: 'Reports', icon: BarChart3 },
  { href: '/employer/settings', label: 'Settings', icon: Settings },
];

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/employers', label: 'Employers', icon: Building2 },
  { href: '/admin/employees', label: 'Employees', icon: Users },
  { href: '/admin/advances', label: 'Advances', icon: CreditCard },
  { href: '/admin/reconciliation', label: 'Reconciliation', icon: BarChart3 },
  { href: '/admin/kyc-review', label: 'KYC Review', icon: CheckCircle2 },
  { href: '/admin/risk-scoring', label: 'Risk Scoring', icon: Shield },
  { href: '/admin/api-health', label: 'API Health', icon: HelpCircle },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'admin' | 'employer' | 'employee';
}

export const DashboardLayout = ({ children, role }: DashboardLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ full_name?: string; email?: string }>({});

  useEffect(() => {
    try {
      const storedUser = window.localStorage.getItem('eaziwage_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        // Use a microtask to avoid synchronous setState during effect execution
        Promise.resolve().then(() => {
          setUser(parsed);
        });
      }
    } catch {
      Promise.resolve().then(() => {
        setUser({});
      });
    }
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const links = role === 'admin' ? adminLinks : role === 'employer' ? employerLinks : employeeLinks;
  const roleColor = role === 'admin' ? 'bg-purple-500' : role === 'employer' ? 'bg-blue-500' : 'bg-primary';

  return (
    <div className="min-h-screen bg-slate-50" data-testid={`${role}-dashboard`}>
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 flex flex-col z-40">
        {/* Logo */}
        <div className="p-6">
          <Link href="/" className="flex items-center gap-3" data-testid="sidebar-logo">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <div>
              <span className="font-heading font-bold text-lg text-white block">EaziWage</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full text-white", roleColor)}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
                data-testid={`nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <Icon className={cn("w-5 h-5", isActive && "text-white")} />
                <span className="font-medium">{link.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Help & Support */}
        <div className="px-4 mb-4">
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Need Help?</p>
                <p className="text-xs text-slate-400">Contact support</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 border-2 border-slate-700">
                <AvatarFallback className="bg-primary text-white font-semibold">
                  {generateInitials({ name: user.full_name || '' })}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.full_name || 'User'}</p>
                <p className="text-xs text-slate-400 truncate">{user.email || ''}</p>
              </div>
            </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors duration-200"
            data-testid="sidebar-logout-btn"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-500 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <Home className="w-5 h-5" />
              </Link>
              <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" data-testid="notifications-btn">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;

