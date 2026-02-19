"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HelpCircle, Info, ChevronDown, Clock,
  Building2, Smartphone, CheckCircle2, Zap, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, calculateFeePercentage, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EmployeePageLayout, EmployeeHeader } from '@/components/employee/EmployeeLayout';

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

interface CircularProgressProps {
    value: number;
    max: number;
}
const CircularProgress = ({ value, max }: CircularProgressProps) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200 dark:text-slate-800/60" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="url(#progressGradReq)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-500 ease-out" />
      <defs>
        <linearGradient id="progressGradReq" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0df259" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default function RequestAdvance() {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [amount, setAmount] = useState(100);
  const [disbursementMethod, setDisbursementMethod] = useState<DisbursementMethod>('mobile_money');

    useEffect(() => {
        const fetchEmployee = async () => {
            try {
                const res = await fetch('/api/employee/profile');
                const data = await res.json();
                const employeeData: EmployeeProfile = data?.employee || data?.data || data || {};
                setEmployee(employeeData);
                const available = Math.min(employeeData.advance_limit || 0, employeeData.earned_wages || 0);
                if (available > 0) setAmount(Math.min(100, available));
            } catch (error) {
                toast.error('Failed to load employee data');
            } finally {
                setLoading(false);
            }
        };
        fetchEmployee();
    }, []);

    const maxAmount = Math.min(employee?.advance_limit || 0, employee?.earned_wages || 0);
    const feePercentage = calculateFeePercentage({ crsTotal: employee?.risk_score || 3.0 });
    const feeAmount = amount * (feePercentage / 100);
    const netAmount = amount - feeAmount;
    const quickAmounts = [500, 1000, 2000, 5000];

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/employee/request-advance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, disbursement_method: disbursementMethod }),
            });
            if (res.ok) {
                toast.success('Advance requested successfully');
                router.push('/employee/transactions');
            } else {
                const errorData = await res.json();
                toast.error(errorData.message || 'Failed to request advance');
            }
        } catch (error) {
            toast.error('An error occurred while requesting advance');
        } finally {
            setSubmitting(false);
        }
    };

    const canRequest = employee?.status === 'approved' && employee?.kyc_status === 'approved';

    if (loading) {
        return (
        <EmployeePageLayout>
            <div className="flex items-center justify-center min-h-screen">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        </EmployeePageLayout>
        );
    }

    const kycInReview = employee?.kyc_status === 'submitted';

    if (!canRequest) {
    return (
      <EmployeePageLayout>
        <EmployeeHeader title="Request Advance" />
        <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-20">
          {kycInReview ? (
            // KYC Submitted - Under Review
            <>
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                <Clock className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 text-center">Verification in Progress</h1>
              <p className="text-slate-600 dark:text-slate-400 mb-4 text-center max-w-xs text-sm">Your documents are being reviewed by our team. This usually takes 1-2 business days.</p>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 max-w-xs text-center">
                <p className="text-xs text-slate-600 dark:text-slate-400">You'll receive a notification once your account is verified and ready to use.</p>
              </div>
            </>
          ) : (
            // KYC Not Started
            <>
              <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                <Info className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 text-center">Complete Verification</h1>
              <p className="text-slate-600 dark:text-slate-400 mb-8 text-center max-w-xs text-sm">Complete your KYC verification to start requesting advances.</p>
              <Button onClick={() => router.push('/employee/onboarding')} className="h-12 px-8 bg-linear-to-r from-primary to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25" data-testid="complete-verification-btn">
                Start Verification <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </EmployeePageLayout>
    );
  }

  return (
    <EmployeePageLayout>
      <EmployeeHeader 
        title="Request Advance" 
        rightContent={
          <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
            <HelpCircle className="w-5 h-5 text-slate-400" />
          </button>
        }
      />

      <main className="relative z-10 max-w-md mx-auto px-4 pb-32 space-y-5">
        {/* Amount Display Card */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-slate-200/50 dark:border-slate-700/30">
          <div className="relative w-48 h-48 mx-auto">
            <CircularProgress value={amount} max={maxAmount} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Amount</span>
              <span className="text-3xl font-bold text-slate-900 dark:text-white" data-testid="display-amount">{formatCurrency(amount)}</span>
              <span className="text-[11px] text-slate-400 mt-1">of {formatCurrency(maxAmount)}</span>
            </div>
          </div>

          {/* Slider */}
          <div className="mt-6 px-1">
            <input
              type="range" 
              min="0" 
              max={maxAmount} 
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
              style={{ 
                background: `linear-gradient(to right, #0df259 0%, #10b981 ${(amount / maxAmount) * 100}%, rgba(148, 163, 184, 0.2) ${(amount / maxAmount) * 100}%, rgba(148, 163, 184, 0.2) 100%)` 
              }}
              data-testid="amount-slider"
            />
            <div className="flex justify-between mt-2">
              <span className="text-[11px] text-slate-400 font-medium">KES 0</span>
              <span className="text-[11px] text-slate-400 font-medium">{formatCurrency(maxAmount)}</span>
            </div>
          </div>

          {/* Quick Amounts */}
          <div className="flex gap-2 justify-center flex-wrap mt-4">
            {quickAmounts.filter(a => a <= maxAmount).map((amt) => (
              <button 
                key={amt} 
                onClick={() => setAmount(amt)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                  amount === amt 
                    ? "bg-linear-to-r from-primary to-emerald-600 text-white shadow-lg shadow-primary/25" 
                    : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                )} 
                data-testid={`quick-amount-${amt}`}
              >
                {formatCurrency(amt)}
              </button>
            ))}
            <button 
              onClick={() => setAmount(maxAmount)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                amount === maxAmount 
                  ? "bg-linear-to-r from-primary to-emerald-600 text-white shadow-lg shadow-primary/25" 
                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              )} 
              data-testid="quick-amount-max"
            >
              Max
            </button>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/30">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2 text-sm">
            <Info className="w-4 h-4 text-primary" /> Transaction Summary
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Requested Amount</span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Service Fee ({feePercentage.toFixed(1)}%)</span>
              <span className="font-semibold text-red-500">-{formatCurrency(feeAmount)}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-700/50" />
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900 dark:text-white">You'll Receive</span>
              <span className="font-bold text-xl text-primary" data-testid="net-amount">{formatCurrency(netAmount)}</span>
            </div>
          </div>
        </div>

        {/* Disbursement Method */}
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-sm px-1">Transfer To</h3>
          <button 
            onClick={() => setShowMethodSelector(!showMethodSelector)}
            className="w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-between p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/30" 
            data-testid="disbursement-selector"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center",
                disbursementMethod === 'mobile_money' ? "bg-primary/10" : "bg-blue-100 dark:bg-blue-500/20"
              )}>
                {disbursementMethod === 'mobile_money' ? (
                  <Smartphone className="w-5 h-5 text-primary" />
                ) : (
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  {disbursementMethod === 'mobile_money' ? (employee?.mobile_money_provider || 'M-PESA') : (employee?.bank_name || 'Bank Account')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {disbursementMethod === 'mobile_money' ? employee?.mobile_money_number : `••••${employee?.bank_account?.slice(-4) || '••••'}`}
                </p>
              </div>
            </div>
            <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-200", showMethodSelector && "rotate-180")} />
          </button>
          
          {showMethodSelector && (
            <div className="mt-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/30">
              <button 
                onClick={() => { setDisbursementMethod('mobile_money'); setShowMethodSelector(false); }}
                className={cn(
                  "w-full flex items-center gap-3 p-4 border-b border-slate-200/50 dark:border-slate-700/30 transition-colors",
                  disbursementMethod === 'mobile_money' && "bg-primary/5"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-slate-900 dark:text-white text-sm">{employee?.mobile_money_provider || 'M-PESA'}</p>
                  <p className="text-xs text-slate-500">{employee?.mobile_money_number || 'Not configured'}</p>
                </div>
                {disbursementMethod === 'mobile_money' && <CheckCircle2 className="w-5 h-5 text-primary" />}
              </button>
              <button 
                onClick={() => { setDisbursementMethod('bank_transfer'); setShowMethodSelector(false); }}
                className={cn(
                  "w-full flex items-center gap-3 p-4 transition-colors",
                  disbursementMethod === 'bank_transfer' && "bg-primary/5"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-slate-900 dark:text-white text-sm">{employee?.bank_name || 'Bank Account'}</p>
                  <p className="text-xs text-slate-500">••••{employee?.bank_account?.slice(-4) || 'Not configured'}</p>
                </div>
                {disbursementMethod === 'bank_transfer' && <CheckCircle2 className="w-5 h-5 text-primary" />}
              </button>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || amount <= 0 || amount > maxAmount}
            className="w-full h-14 rounded-2xl bg-linear-to-r from-primary to-emerald-600 text-white font-bold text-base shadow-xl shadow-primary/30 btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="transfer-btn"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Transfer {formatCurrency(netAmount)} Now
              </span>
            )}
          </Button>
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-3">
            By tapping Transfer, you authorize repayment deduction from your next salary.
          </p>
        </div>
      </main>
    </EmployeePageLayout>
  );
}
