'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Eye, Wallet, CreditCard, Settings, ArrowLeft } from 'lucide-react';

interface EmployerDetailNavProps {
  employerId: string;
  companyName?: string;
}

const tabs = [
  { segment: '',          label: 'Overview',  icon: Eye },
  { segment: 'wallet',    label: 'Wallet',    icon: Wallet },
  { segment: 'advances',  label: 'Advances',  icon: CreditCard },
  { segment: 'settings',  label: 'Settings',  icon: Settings },
];

export default function EmployerDetailNav({ employerId, companyName }: EmployerDetailNavProps) {
  const pathname = usePathname();
  const base = `/admin/employers/${employerId}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/employers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            All Employers
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{companyName || 'Employer Detail'}</h1>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 dark:border-slate-700/50 pb-px">
        {tabs.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const isActive = pathname === href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.segment || 'overview'}
              href={href}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
