"use client";
import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft, PieChart, ShieldCheck, Wallet, Landmark, ShieldAlert,
  Smartphone, HandCoins, Target, PiggyBank, Users, AlertTriangle,
} from 'lucide-react';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { cn } from '@/lib/utils';

type ResourceColor = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'cyan';

interface Resource {
  title: string;
  desc: string;
  icon: React.ElementType;
  color: ResourceColor;
}

interface ResourceCategory {
  name: string;
  resources: Resource[];
}

const COLOR_CLASSES: Record<ResourceColor, string> = {
  blue:    "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  purple:  "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
  amber:   "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  rose:    "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  cyan:    "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400",
};

const CATEGORIES: ResourceCategory[] = [
  {
    name: 'Budgeting & Saving',
    resources: [
      {
        title: "The 50/30/20 Rule",
        desc: "Aim to spend 50% on needs, 30% on wants, and save 20% of your income. Use the budget planner to see where you stand.",
        icon: PieChart,
        color: 'blue',
      },
      {
        title: "Build an Emergency Fund",
        desc: "Try to keep at least 3 months of expenses in a separate account for unexpected events, so you're not relying on advances for emergencies.",
        icon: ShieldCheck,
        color: 'emerald',
      },
      {
        title: "Chama & SACCO Savings Groups",
        desc: "Group savings schemes (chamas, SACCOs) can help you save consistently and access affordable credit outside of EWA.",
        icon: Users,
        color: 'purple',
      },
      {
        title: "Automate Small, Regular Savings",
        desc: "Even KES 50–100 saved per payday adds up. Set aside a fixed amount automatically before spending the rest.",
        icon: PiggyBank,
        color: 'cyan',
      },
    ],
  },
  {
    name: 'Using EWA Wisely',
    resources: [
      {
        title: "EWA Best Practice",
        desc: "Only use earned wage access for essential, unplanned expenses to avoid affecting your main paycheck.",
        icon: Wallet,
        color: 'purple',
      },
      {
        title: "Understand the Fees",
        desc: "Every advance carries a small processing fee, deducted from your next payslip. Check your Transactions page to see exactly what you've been charged.",
        icon: Landmark,
        color: 'amber',
      },
      {
        title: "Watch Your Repeat Usage",
        desc: "Frequently requesting advances every pay cycle is a sign your budget needs attention — revisit the budget planner and look for expenses to trim.",
        icon: AlertTriangle,
        color: 'rose',
      },
    ],
  },
  {
    name: 'Debt & Credit Health',
    resources: [
      {
        title: "Avoid Predatory Loans",
        desc: "Unlicensed digital lenders can charge extremely high interest. EWA draws only from wages you've already earned — it isn't a loan.",
        icon: ShieldAlert,
        color: 'rose',
      },
      {
        title: "Know Your Credit Score",
        desc: "Timely repayments (including EWA deductions) can help build a healthy credit history with licensed lenders and banks.",
        icon: Target,
        color: 'blue',
      },
    ],
  },
  {
    name: 'Digital & Mobile Money Safety',
    resources: [
      {
        title: "Protect Your PIN",
        desc: "Never share your mobile money PIN or OTP codes, even with someone claiming to be from EaziWage or your mobile network.",
        icon: Smartphone,
        color: 'emerald',
      },
      {
        title: "Verify Before You Trust",
        desc: "EaziWage will never ask for your password or OTP over phone or SMS. If in doubt, contact Support directly from your dashboard.",
        icon: HandCoins,
        color: 'amber',
      },
    ],
  },
];

const ResourcesPage = () => {
  return (
    <EmployeePortalLayout>
      <div className="max-w-5xl mx-auto space-y-10">

        <div>
          <Link
            href="/dashboards/employee-dashboard/wellness"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-emerald-500 transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Financial Wellness
          </Link>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            Financial wellness resources
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Practical guidance on budgeting, saving, and using earned wage access responsibly —
            curated to help you make the most of every payday.
          </p>
        </div>

        {CATEGORIES.map((category) => (
          <div key={category.name} className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-1">
              {category.name}
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {category.resources.map((resource) => {
                const Icon = resource.icon;
                return (
                  <div
                    key={resource.title}
                    className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", COLOR_CLASSES[resource.color])}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{resource.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{resource.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      </div>
    </EmployeePortalLayout>
  );
};

export default ResourcesPage;
