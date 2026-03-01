"use client";

import { 
  Home, Wallet, History, User, LogOut, Sun, Moon, Bell, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../lib/ThemeContext';
import React from 'react'
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { logout } from '@/actions/auth';

export const FloatingNav  = ({className}: {className?: string}) => {
    const location = usePathname();
    const router = useRouter();

    const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/dashboards/employee-dashboard' },
    { id: 'advance', icon: Wallet, label: 'Advance', path: '/dashboards/employee-dashboard/request-advance' },
    { id: 'history', icon: History, label: 'History', path: '/dashboards/employee-dashboard/transactions' },
    { id: 'profile', icon: User, label: 'Profile', path: '/dashboards/employee-dashboard/settings' },
  ];

  const isActive = (path: string) => {
    return location === path;
  }

  return (
    <nav className={cn("fixed bottom-0 left-0 right-0 z-50 px-4 pb-4", className)}>
      <div className="max-w-md mx-auto">
        <div className="bg-linear-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl shadow-slate-900/50 border border-slate-700/50">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.path)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-xl transition-all duration-300",
                    active 
                      ? "text-white" 
                      : "text-slate-400 hover:text-slate-300"
                  )}
                  data-testid={`nav-${item.id}`}
                >
                  {active && (
                    <div className="absolute inset-x-2 -top-px h-0.5 bg-linear-to-r from-primary to-emerald-400 rounded-full" />
                  )}
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
                    active && "bg-linear-to-br from-primary/20 to-emerald-500/20"
                  )}>
                    <item.icon className={cn(
                      "w-5 h-5 transition-transform duration-300",
                      active && "text-primary scale-110"
                    )} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium transition-colors",
                    active && "text-primary"
                  )}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

interface EmployeeHeaderProps {
    title?: string;
    showBack?: boolean;
    onBack?: () => void;
    rightContent?: React.ReactNode;
    user?: {
        full_name?: string;
        email?: string;
        profile_picture_url?: string;
    };
    employee?: {
        full_name?: string;
        email?: string;
        profile_picture_url?: string;
    };
}


export const EmployeeHeader = ({
    title,
    showBack = true,
    onBack,
    rightContent,
    user,
    employee
}: EmployeeHeaderProps) => {
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();

    const resolvedName =
      employee?.full_name?.trim() ||
      user?.full_name?.trim() ||
      employee?.email?.split('@')[0] ||
      user?.email?.split('@')[0] ||
      'User';

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    }
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    }

    return (
    <header className="relative z-10 max-w-md mx-auto px-4 py-3">
      <div className="flex items-center justify-between">
        {showBack ? (
          <button 
            onClick={handleBack}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
            data-testid="back-btn"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        ) : (
          <div className="flex items-center gap-3">
	            <Link href="/dashboards/employee-dashboard/settings" className="shrink-0">
	              {user?.profile_picture_url ? (
                <img 
                  src={`${process.env.BASE_URL}${user.profile_picture_url}`} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-primary/20"
                />
	              ) : (
	                <div className="w-10 h-10 bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
	                  <span className="text-white font-bold text-sm">{resolvedName[0]?.toUpperCase() || 'U'}</span>
	                </div>
	              )}
	            </Link>
	            <div className="min-w-0">
	              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{getGreeting()}</p>
	              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
	                {resolvedName.split(' ')[0]}
	              </h2>
	            </div>
	          </div>
        )}
        
        {title && (
          <h1 className="text-base font-bold text-slate-900 dark:text-white">{title}</h1>
        )}
        
        <div className="flex items-center gap-1">
          {rightContent || (
            <>
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button 
                className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                data-testid="notifications-btn"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
              </button>
              <button 
                onClick={logout}
                className="p-2 rounded-xl text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export const EmployeeBackground = () => (
  <>
    <div className="absolute inset-0 gradient-mesh" />
    <div className="absolute inset-0 bg-grid" />
    <div className="absolute top-0 right-0 w-125 h-125 bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
    <div className="absolute bottom-0 left-0 w-100 h-100 bg-emerald-500/8 rounded-full blur-[100px] pointer-events-none" />
  </>
);

interface EmployeePageLayoutProps {
    children: React.ReactNode;
    className?: string;
}

export const EmployeePageLayout = ({ children, className }: EmployeePageLayoutProps) => (
  <div className={cn(
    "min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden",
    className
  )}>
    <EmployeeBackground />
    {children}
    <FloatingNav />
  </div>
);

interface EmployeePageLayoutBaseProps {
    children: React.ReactNode;
    className?: string;
}

export const EmployeePageLayoutBase = ({ children, className }: EmployeePageLayoutBaseProps) => (
  <div className={cn(
    "min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden",
    className
  )}>
    <EmployeeBackground />
    {children}
  </div>
);

export default EmployeePageLayout;

