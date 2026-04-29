"use client";
import React, { useState, useEffect } from 'react';
import { 
  Building2, Briefcase, Calendar, DollarSign, Shield, 
  User, MapPin, BadgeCheck, Info, Loader2, Landmark
} from 'lucide-react';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface EmploymentData {
  employment: {
    full_name: string;
    employee_code: string;
    job_title: string;
    department: string;
    monthly_salary: number;
    employment_type: string;
    start_date: string;
    status: string;
    employer_onboarding: {
      company_name: string;
    };
  };
  policy: {
    withdrawal_limit_percent: number;
    auto_approval_threshold: number;
  };
}

const DetailCard = ({ icon: Icon, label, value, subValue, variant = 'blue' }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-100 dark:border-emerald-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-100 dark:border-purple-800',
  };

  return (
    <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/60 dark:border-white/10 flex items-start gap-4">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0", colors[variant])}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
        {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
      </div>
    </div>
  );
};

const EmploymentDetails = () => {
  const { currency } = useCurrency();
  const [data, setData] = useState<EmploymentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetails() {
      try {
        const res = await fetch('/api/employee-dashboard/employment');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to load employment details', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, []);

  if (loading) {
    return (
      <EmployeePortalLayout title="Loading...">
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fetching contract details...</p>
        </div>
      </EmployeePortalLayout>
    );
  }

  if (!data) return <div>Failed to load details.</div>;

  const { employment, policy } = data;

  const formatJoiningDate = (dateString: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    if (isNaN(date.getTime()) || date.getFullYear() <= 1970) return 'Not specified';
    
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <EmployeePortalLayout title="Employment Details">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Profile */}
        <div className="bg-linear-to-br from-slate-900 to-slate-800 dark:from-emerald-600 dark:to-emerald-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-12 opacity-10">
              <Landmark className="w-48 h-48" />
           </div>
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-3xl font-bold">
                 {employment.full_name?.charAt(0)}
              </div>
              <div className="text-center md:text-left">
                 <h2 className="text-3xl font-bold tracking-tight">{employment.full_name}</h2>
                 <p className="text-white/70 font-medium mt-1 flex items-center justify-center md:justify-start gap-2">
                    <Building2 className="w-4 h-4" /> {employment.employer_onboarding?.company_name}
                 </p>
                 <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/20">
                       ID: {employment.employee_code}
                    </span>
                    <span className="px-3 py-1 bg-emerald-400/20 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-400/30 text-emerald-300">
                       {employment.status}
                    </span>
                 </div>
              </div>
           </div>
        </div>

        {/* Info Grid */}
        <div className="grid md:grid-cols-2 gap-6">
           <DetailCard 
              icon={Briefcase} 
              label="Role & Department" 
              value={employment.job_title} 
              subValue={employment.department}
              variant="blue"
           />
           <DetailCard 
              icon={DollarSign} 
              label="Monthly Gross Salary" 
              value={formatCurrency(employment.monthly_salary, currency)} 
              subValue="Fixed Base Salary"
              variant="emerald"
           />
           <DetailCard 
              icon={Calendar} 
              label="Joining Date" 
              value={formatJoiningDate(employment.start_date)} 
              subValue={`Employment: ${employment.employment_type?.replace('_', ' ')}`}
              variant="purple"
           />
           <DetailCard 
              icon={Shield} 
              label="EWA Limit" 
              value={`${policy.withdrawal_limit_percent}%`} 
              subValue={`Max advance per cycle: ${formatCurrency(employment.monthly_salary * (policy.withdrawal_limit_percent / 100), currency)}`}
              variant="blue"
           />
        </div>

        {/* Policy Section */}
        <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 dark:border-white/10">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                 <BadgeCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Organization Policy</h3>
           </div>

           <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto-Approval Threshold</span>
                 </div>
                 <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(policy.auto_approval_threshold, currency)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Disbursement Speed</span>
                 </div>
                 <span className="text-sm font-bold text-emerald-500 uppercase tracking-widest">Instant</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Transaction Fee</span>
                 </div>
                 <span className="text-sm font-bold text-slate-900 dark:text-white">3.5% Flat</span>
              </div>
           </div>

           <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                 These details are synced directly from your employer&apos;s payroll system. If you notice any discrepancies, please contact your HR department.
              </p>
           </div>
        </div>

      </div>
    </EmployeePortalLayout>
  );
};

export default EmploymentDetails;
