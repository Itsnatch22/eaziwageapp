'use client';

import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import EmployerDetailNav from '../EmployerDetailNav';

interface AdvanceRow {
  id: string;
  amount: number;
  fee_amount: number | null;
  net_amount: number | null;
  currency: string;
  status: string;
  disbursement_method: string | null;
  employee_name: string;
  created_at: string;
}

const statusStyles: Record<string, string> = {
  disbursed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  repaid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};

export default function EmployerAdvancesClient({ employerId }: { employerId: string }) {
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [companyName, setCompanyName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAdvances() {
      try {
        const [advancesRes, employerRes] = await Promise.all([
          fetch(`/api/admin/advances?employer_onboarding_id=${employerId}&limit=100`),
          fetch(`/api/admin/employers/${employerId}`),
        ]);

        if (!advancesRes.ok) {
          setError('Failed to load advances.');
          return;
        }
        const json = await advancesRes.json();
        setAdvances(json.advances ?? []);

        if (employerRes.ok) {
          const employerJson = await employerRes.json();
          setCompanyName(employerJson.company_name);
        }
      } catch {
        setError('Failed to load advances.');
      } finally {
        setLoading(false);
      }
    }
    fetchAdvances();
  }, [employerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Activity className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <EmployerDetailNav employerId={employerId} companyName={companyName} />

      {error && <div className="text-center py-4 text-red-600 text-sm">{error}</div>}

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Advance History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Employee</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Fee</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Method</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
              {advances.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No advances for this employer yet.</td></tr>
              )}
              {advances.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{a.employee_name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(Number(a.amount), a.currency)}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{formatCurrency(Number(a.fee_amount || 0), a.currency)}</td>
                  <td className="px-6 py-4 text-sm capitalize text-slate-700 dark:text-slate-300">{a.disbursement_method?.replace('_', ' ') || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium capitalize', statusStyles[a.status] ?? statusStyles.pending)}>
                      {a.status}
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
