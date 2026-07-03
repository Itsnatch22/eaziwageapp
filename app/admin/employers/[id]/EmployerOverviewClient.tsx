'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Building2, Users, CreditCard, Landmark, Mail, Phone, MapPin } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import EmployerDetailNav from './EmployerDetailNav';

interface EmployerDetail {
  id: string;
  company_name: string;
  employer_code: string;
  industry: string;
  country: string;
  registration_number: string | null;
  tax_id: string | null;
  address: string | null;
  contact_person: string | null;
  contact_email: string;
  contact_phone: string | null;
  payroll_cycle: string | null;
  status: 'approved' | 'pending' | 'rejected' | 'suspended' | 'risk_review_in_progress';
  risk_score: number | null;
  bank_name: string | null;
  bank_account_number: string | null;
  employee_count: number;
  total_advances: number;
  monthly_payroll: number;
}

const statusStyles: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  suspended: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  risk_review_in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
};

export default function EmployerOverviewClient({ employerId }: { employerId: string }) {
  const [employer, setEmployer] = useState<EmployerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/employers/${employerId}`);
      if (!res.ok) {
        setError(res.status === 404 ? 'Employer not found.' : 'Failed to load employer.');
        return;
      }
      setEmployer(await res.json());
    } catch {
      setError('Failed to load employer.');
    } finally {
      setLoading(false);
    }
  }, [employerId]);

  useEffect(() => {
    Promise.resolve().then(() => void fetchDetail());
  }, [fetchDetail]);

  useRealtimeRefresh(
    [{ table: 'employer_onboarding', filter: `id=eq.${employerId}` }],
    () => fetchDetail(),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Activity className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (error || !employer) {
    return (
      <div className="space-y-6">
        <EmployerDetailNav employerId={employerId} />
        <div className="text-center py-12 text-slate-500">{error || 'Employer not found.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <EmployerDetailNav employerId={employerId} companyName={employer.company_name} />

      <div className="flex items-center gap-3">
        <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium capitalize', statusStyles[employer.status] ?? statusStyles.pending)}>
          {employer.status.replace(/_/g, ' ')}
        </span>
        <span className="text-sm text-slate-500">{employer.employer_code}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Employees</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{employer.employee_count}</p>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Advances This Month</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(employer.total_advances, 'USD')}</p>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-500">Monthly Payroll</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(employer.monthly_payroll, 'USD')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Company Details</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Industry</dt><dd className="text-slate-900 dark:text-white font-medium">{employer.industry || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Country</dt><dd className="text-slate-900 dark:text-white font-medium">{employer.country || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Registration No.</dt><dd className="text-slate-900 dark:text-white font-medium">{employer.registration_number || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Tax ID</dt><dd className="text-slate-900 dark:text-white font-medium">{employer.tax_id || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Payroll Cycle</dt><dd className="text-slate-900 dark:text-white font-medium capitalize">{employer.payroll_cycle || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Risk Score</dt><dd className="text-slate-900 dark:text-white font-medium">{employer.risk_score ?? '—'} / 5</dd></div>
          </dl>
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Contact & Banking</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /><dd className="text-slate-900 dark:text-white">{employer.contact_person || '—'}</dd></div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /><dd className="text-slate-900 dark:text-white">{employer.contact_email || '—'}</dd></div>
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /><dd className="text-slate-900 dark:text-white">{employer.contact_phone || '—'}</dd></div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><dd className="text-slate-900 dark:text-white">{employer.address || '—'}</dd></div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/30">
              <Landmark className="w-4 h-4 text-slate-400" />
              <dd className="text-slate-900 dark:text-white">
                {employer.bank_name ? `${employer.bank_name} · ${employer.bank_account_number || '—'}` : 'No bank details on file'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
