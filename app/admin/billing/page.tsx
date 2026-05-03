'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  DollarSign, TrendingUp, Wallet, ArrowRight, BarChart3, 
  CreditCard, Activity, Calendar, Download, Building2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, Legend 
} from 'recharts';
import { formatCurrency, cn, DEFAULT_ADMIN_CURRENCY } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BillingData {
  summary: {
    total_revenue: number;
    total_disbursed: number;
    total_wallet_balance: number;
    total_arrears: number;
  };
  monthlyTrends: Array<{
    label: string;
    revenue: number;
    disbursed: number;
    count: number;
  }>;
  topRevenueGenerators: Array<{
    id: string;
    company_name: string;
    revenue: number;
  }>;
}

interface Employer {
  id:                  string;
  company_name:        string;
  employer_code:       string;
  industry:            string;
  country:             string;
  registration_number: string | null;
  tax_id:              string | null;
  address:             string | null;
  contact_person:      string | null;
  contact_email:       string;
  contact_phone:       string | null;
  payroll_cycle:       'weekly' | 'biweekly' | 'monthly' | null;
  status:              'approved' | 'pending' | 'rejected' | 'suspended';
  employee_count:      number;
  total_advances:      number;
  monthly_payroll:     number;
  risk_score:          number | null;
  deleted_at:          string | null;
  created_at:          string;
  updated_at:          string;
}

const MetricCard = ({ icon: Icon, label, value, subtext, variant = 'purple' }: any) => {
  const variants: any = {
    purple: 'from-purple-600 to-indigo-600 shadow-purple-500/25',
    green: 'from-emerald-600 to-green-600 shadow-emerald-500/25',
    blue: 'from-blue-600 to-cyan-600 shadow-blue-500/25',
    amber: 'from-amber-500 to-orange-500 shadow-amber-500/25',
  };

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center gap-4 mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-linear-to-br shadow-lg", variants[variant])}>
          <Icon className="text-white w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
      {subtext && <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>}
    </div>
  );
};

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [billingRes, employersRes] = await Promise.all([
          fetch('/api/admin/billing'),
          fetch('/api/admin/employers')
        ]);
        
        if (billingRes.ok) {
          const billingJson = await billingRes.json();
          setData(billingJson);
        }
        
        if (employersRes.ok) {
          const employersPayload = await employersRes.json();
          const employersData = Array.isArray(employersPayload) ? employersPayload : (employersPayload.data ?? []);
          setEmployers(employersData);
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Activity className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!data) return <div>Failed to load billing information.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Billing & Revenue</h1>
          <p className="text-slate-500 dark:text-slate-400">Platform-wide financial health and revenue analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 mr-2" />
            Last 6 Months
          </Button>
          {/*Report button functionality to be implemented*/}
          <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg shadow-purple-600/20">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          icon={DollarSign} 
          label="Total Revenue" 
          value={formatCurrency(data.summary.total_revenue, DEFAULT_ADMIN_CURRENCY)} 
          variant="purple"
          subtext="Cumulative platform fees earned"
        />
        <MetricCard 
          icon={CreditCard} 
          label="Total Disbursed" 
          value={formatCurrency(data.summary.total_disbursed, DEFAULT_ADMIN_CURRENCY)} 
          variant="blue"
          subtext="All-time advances processed"
        />
        <MetricCard 
          icon={Wallet} 
          label="Wallet Balances" 
          value={formatCurrency(data.summary.total_wallet_balance, DEFAULT_ADMIN_CURRENCY)} 
          variant="green"
          subtext="Total employer funds on platform"
        />
        <MetricCard 
          icon={BarChart3} 
          label="Arrears" 
          value={formatCurrency(data.summary.total_arrears, DEFAULT_ADMIN_CURRENCY)} 
          variant="amber"
          subtext="Outstanding repayments due"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Revenue Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyTrends}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Disbursement Volume</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="disbursed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Employer Wallet Health</h3>
          <Link href="/admin/employers">
            <Button variant="ghost" size="sm" className="text-purple-600 font-medium">
              View All Employers <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Employer</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Balance</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Arrears</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Utilization</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {employers.slice(0, 10).map((employer) => (
                <tr key={employer.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">{employer.company_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                    {formatCurrency(employer.monthly_payroll, DEFAULT_ADMIN_CURRENCY)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium",
                      "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    )}>
                      {formatCurrency(0, DEFAULT_ADMIN_CURRENCY)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden min-w-[60px]">
                        <div 
                          className="h-full bg-purple-600 rounded-full" 
                          style={{ width: `${Math.min(employer.employee_count > 0 ? (employer.total_advances / employer.employee_count) * 20 : 0, 100)}%` }} 
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        {employer.employee_count > 0 ? Math.round((employer.total_advances / employer.employee_count) * 20) : 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <TrendingUp className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Revenue Generators */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Top Revenue Generators</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Company</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Revenue Contribution</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {data.topRevenueGenerators?.map((gen) => (
                <tr key={gen.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-900 dark:text-white">{gen.company_name}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                    {formatCurrency(gen.revenue, DEFAULT_ADMIN_CURRENCY)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xs font-bold text-purple-600">
                      {data.summary.total_revenue > 0 
                        ? ((gen.revenue / data.summary.total_revenue) * 100).toFixed(1) 
                        : 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
