"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
   Info, ChevronDown, Clock,
   Smartphone, CheckCircle2, Zap, ArrowRight,
  Shield, Loader2, Landmark, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, calculateFeePercentage, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';

interface EmployeeProfile {
  status?: string;
  kyc_status?: string;
  advance_limit?: number;
  earned_wages?: number;
  risk_score?: number;
  mobile_money_provider?: string;
  mobile_money_number?: string;
  bank_name?: string;
  bank_account?: string;
}

type DisbursementMethod = 'mobile_money' | 'bank_transfer';

// ─── Circular Progress Component ──────────────────────────────────────────────

const CircularAmountSelector = ({ value, max }: { value: number; max: number }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-56 h-56 mx-auto group">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
      
      <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
        <circle 
          cx="50" cy="50" r="44" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="4" 
          className="text-slate-100 dark:text-slate-800/50" 
        />
        <circle 
          cx="50" cy="50" r="44" 
          fill="none" 
          stroke="url(#advanceGrad)" 
          strokeWidth="6" 
          strokeLinecap="round"
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          className="transition-all duration-700 ease-out shadow-lg" 
        />
        <defs>
          <linearGradient id="advanceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0df259" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1">Advance Amount</p>
        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter" data-testid="display-amount">
          {formatCurrency(value).split('.')[0]}
        </h2>
        <div className="flex items-center gap-1.5 mt-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Limit</span>
          <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{formatCurrency(max).split('.')[0]}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RequestAdvance() {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [amount, setAmount] = useState(0);
  const [disbursementMethod, setDisbursementMethod] = useState<DisbursementMethod>('mobile_money');

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await fetch('/api/employee-dashboard/overview');
        const data = await res.json();
        if (!res.ok) {
          toast.error('Failed to load portal data');
          return;
        }
        const profile = { ...(data?.employee || {}), ...(data?.stats || {}) };
        setEmployee(profile);
        const available = Math.min(profile.advance_limit || 0, profile.earned_wages || 0);
        if (available > 0) setAmount(Math.min(500, available));
      } catch (error) {
        toast.error('Connection error');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, []);

  const maxAmount = Math.min(employee?.advance_limit || 0, employee?.earned_wages || 0);
  const feePercentage = calculateFeePercentage(employee?.risk_score || 3.0);
  const feeAmount = amount * (feePercentage / 100);
  const netAmount = amount - feeAmount;
  const quickAmounts = [1000, 2000, 5000, 10000];

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/employee-dashboard/request-advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, disbursement_method: disbursementMethod }),
      });
      if (res.ok) {
        toast.success('Funds requested successfully!');
        router.push('/dashboards/employee-dashboard/transactions');
      } else {
        const d = await res.json();
        toast.error(d.message || 'Request failed');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const isVerified = employee?.status === 'approved' && employee?.kyc_status === 'approved';
  const isPending = employee?.kyc_status === 'submitted' || employee?.kyc_status === 'pending';

  if (loading) {
    return (
      <EmployeePortalLayout title="Withdrawal">
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Verifying Limit...</p>
        </div>
      </EmployeePortalLayout>
    );
  }

  // ── Locked State (KYC) ──────────────────────────────────────────────────────
  if (!isVerified) {
    return (
      <EmployeePortalLayout title="Access Locked">
        <div className="max-w-md mx-auto text-center py-12 space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl scale-150" />
            <div className="w-24 h-24 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl relative z-10">
              {isPending ? <Clock className="w-12 h-12 text-amber-500 animate-pulse" /> : <Shield className="w-12 h-12 text-primary" />}
            </div>
          </div>

          <div className="space-y-3 relative z-10">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {isPending ? 'Under Review' : 'Identity Required'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              {isPending 
                ? "Your verification documents are being processed by our compliance team. This usually takes 24-48 hours."
                : "To start accessing your earned wages, we need to verify your identity and employment status."
              }
            </p>
          </div>

          {!isPending ? (
            <Button 
              onClick={() => router.push('/dashboards/employee-dashboard/onboarding')} 
              className="h-14 px-10 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all w-full"
            >
              Start Verification <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] text-left">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Current Progress</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600"><Check className="w-4 h-4" /></div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Documents Uploaded</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600"><Clock className="w-4 h-4" /></div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Awaiting Admin Approval</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </EmployeePortalLayout>
    );
  }

  // ── Active State (Request Flow) ─────────────────────────────────────────────
  return (
    <EmployeePortalLayout title="Withdraw Wage">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* Main Selector Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[3rem] p-8 border border-white/40 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 text-center">
          <CircularAmountSelector value={amount} max={maxAmount} />

          {/* Precision Slider */}
          <div className="mt-10 px-2 space-y-4">
            <input
              type="range" 
              min="0" 
              max={maxAmount} 
              step="100"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-slate-100 dark:bg-slate-800"
              style={{ 
                background: `linear-gradient(to right, #0df259 0%, #10b981 ${(amount / maxAmount) * 100}%, transparent ${(amount / maxAmount) * 100}%)` 
              }}
            />
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Min: {formatCurrency(0).split('.')[0]}</span>
              <span>Max: {formatCurrency(maxAmount).split('.')[0]}</span>
            </div>
          </div>

          {/* Quick Selection */}
          <div className="grid grid-cols-3 gap-2 mt-8">
            {quickAmounts.filter(a => a <= maxAmount).slice(0, 2).map((amt) => (
              <button 
                key={amt} 
                onClick={() => setAmount(amt)}
                className={cn(
                  "py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border",
                  amount === amt 
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg" 
                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-primary/50"
                )} 
              >
                {formatCurrency(amt).split('.')[0].replace('KES', '')}
              </button>
            ))}
            <button 
              onClick={() => setAmount(maxAmount)}
              className={cn(
                "py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border",
                amount === maxAmount 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg" 
                  : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-primary/50"
              )} 
            >
              Max
            </button>
          </div>
        </div>

        {/* Breakdown & Disbursement */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white/40 dark:bg-white/2 border border-slate-100 dark:border-slate-800 p-6 rounded-[2.5rem]">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Info className="w-3.5 h-3.5" /> Breakdown
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Service Fee ({feePercentage.toFixed(1)}%)</span>
                <span className="text-red-500 font-bold">-{formatCurrency(feeAmount)}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-slate-900 dark:text-white font-black uppercase tracking-tight">Net Payout</span>
                <span className="text-2xl font-black text-primary tracking-tighter" data-testid="net-amount">
                  {formatCurrency(netAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Destination */}
          <div className="relative">
            <button 
              onClick={() => setShowMethodSelector(!showMethodSelector)}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-between p-5 rounded-[2rem] shadow-xl shadow-slate-200 dark:shadow-black/20 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-slate-900/5 flex items-center justify-center">
                  {disbursementMethod === 'mobile_money' ? <Smartphone className="w-6 h-6" /> : <Landmark className="w-6 h-6" />}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Disburse To</p>
                  <p className="font-bold text-sm">
                    {disbursementMethod === 'mobile_money' 
                      ? (employee?.mobile_money_provider || 'Mobile Money') 
                      : (employee?.bank_name || 'Bank Account')}
                  </p>
                </div>
              </div>
              <ChevronDown className={cn("w-5 h-5 opacity-60 transition-transform", showMethodSelector && "rotate-180")} />
            </button>

            {showMethodSelector && (
              <div className="absolute bottom-full left-0 right-0 mb-4 bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
                {[
                  { id: 'mobile_money', label: employee?.mobile_money_provider || 'Mobile Money', sub: employee?.mobile_money_number, icon: Smartphone },
                  { id: 'bank_transfer', label: employee?.bank_name || 'Bank Account', sub: `••••${employee?.bank_account?.slice(-4) || 'XXXX'}`, icon: Landmark }
                ].map((m) => (
                  <button 
                    key={m.id}
                    onClick={() => { setDisbursementMethod(m.id as DisbursementMethod); setShowMethodSelector(false); }}
                    className={cn(
                      "w-full flex items-center gap-4 p-5 transition-all hover:bg-slate-50 dark:hover:bg-white/2",
                      disbursementMethod === m.id && "bg-primary/5"
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <m.icon className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{m.label}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{m.sub}</p>
                    </div>
                    {disbursementMethod === m.id && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-4 space-y-4">
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || amount <= 0 || amount > maxAmount}
            className="w-full h-16 rounded-[2rem] bg-linear-to-r from-primary to-emerald-600 text-white font-black text-lg uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5 fill-current" />
                Request {formatCurrency(netAmount).split('.')[0]}
              </span>
            )}
          </Button>
          <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-60 mx-auto leading-relaxed">
            Funds typically arrive within <span className="text-slate-900 dark:text-white">60 seconds</span> after approval.
          </p>
        </div>
      </div>
    </EmployeePortalLayout>
  );
}
