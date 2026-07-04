"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone, Landmark, Plus, Trash2,
  AlertCircle, Loader2, CreditCard, Star, ShieldCheck, Upload, Clock, XCircle
} from 'lucide-react';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type BankVerificationStatus = 'unverified' | 'pending_review' | 'approved' | 'rejected';

interface PaymentMethod {
  id: string;
  method_type: 'mobile_money' | 'bank_account';
  provider_name: string;
  account_number?: string | null;
  account_name?: string | null;
  phone_number?: string | null;
  country_code?: string | null;
  is_default?: boolean;
  is_verified?: boolean;
  verification_status?: BankVerificationStatus;
  verification_notes?: string | null;
}

const PaymentMethods = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);


  const [verifyingMethodId, setVerifyingMethodId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  const [uploadingDocForId, setUploadingDocForId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newMethod, setNewMethod] = useState({
    method_type: 'mobile_money' as 'mobile_money' | 'bank_account',
    provider_name: '',
    account_number: '',
    account_name: '',
    phone_number: '',
    country_code: 'KE',
    is_default: false
  });

  const fetchMethods = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch('/api/employee-dashboard/payment-methods');
      if (res.ok) {
        const data = await res.json();

        const employeeCountry = data.country_code || 'KE';
        setNewMethod(prev => ({ ...prev, country_code: employeeCountry }));

        const adapted = (data.methods || []).map((m: {
          id: string;
          method_type?: string;
          type?: string;
          provider_name?: string;
          provider?: string;
          account_number?: string;
          account_name?: string;
          phone_number?: string;
          country_code?: string;
          is_default?: boolean;
          is_verified?: boolean;
          verification_status?: BankVerificationStatus;
          verification_notes?: string | null;
        }) => ({
          id: m.id,
          method_type: (m.method_type || m.type) as 'mobile_money' | 'bank_account',
          provider_name: (m.provider_name || m.provider) as string,
          account_number: m.account_number || null,
          account_name: m.account_name || null,
          phone_number: m.phone_number || null,
          country_code: m.country_code || null,
          is_default: m.is_default || false,
          is_verified: m.is_verified || false,
          verification_status: m.verification_status || 'unverified',
          verification_notes: m.verification_notes || null,
        }));
        setMethods(adapted);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMethods({ silent: true });
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const payload = {
        country_code: newMethod.country_code || 'KE',
        method_type: newMethod.method_type,
        provider_name: newMethod.provider_name,
        account_number: newMethod.account_number || null,
        account_name: newMethod.account_name || null,
        phone_number: newMethod.phone_number || (newMethod.method_type === 'mobile_money' ? newMethod.account_number : null),
        is_default: !!newMethod.is_default,
      };

      const res = await fetch('/api/employee-dashboard/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('Payment method added. Verify it to enable withdrawals.');
        setShowAddModal(false);
        setNewMethod({ method_type: 'mobile_money', provider_name: '', account_number: '', account_name: '', phone_number: '', country_code: 'KE', is_default: false });
        fetchMethods();
      } else {
        const err = await res.json().catch(() => null);
        console.error('Add error', err);
        throw new Error('Failed to add');
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not add payment method');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;
    try {
      const res = await fetch(`/api/employee-dashboard/payment-methods?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Method removed');
        fetchMethods();
      } else {
        const err = await res.json().catch(() => null);
        console.error('Delete failed', err);
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const requestVerification = async (id: string) => {
    setOtpSending(true);
    try {
      const res = await fetch('/api/employee-dashboard/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_verification', id }),
      });
      if (res.ok) {
        toast.success('Verification code sent. Check your phone.');
        setOtpInput('');
        setVerifyingMethodId(id);
      } else {
        const err = await res.json().catch(() => null);
        console.error('OTP request failed', err);
        toast.error(err?.error || 'Failed to send verification code');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to send verification code');
    } finally {
      setOtpSending(false);
    }
  };

  const submitOtp = async () => {
    if (!verifyingMethodId) return;
    setOtpSubmitting(true);
    try {
      const res = await fetch('/api/employee-dashboard/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_verification', id: verifyingMethodId, otp: otpInput }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast.success('Payment method verified');
        setVerifyingMethodId(null);
        setOtpInput('');
        fetchMethods();
      } else {
        console.error('OTP confirm failed', json);
        toast.error(json?.error || 'Failed to confirm code');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to confirm code');
    } finally {
      setOtpSubmitting(false);
    }
  };

  const startDocumentUpload = (id: string) => {
    setUploadingDocForId(id);
    fileInputRef.current?.click();
  };

  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadingDocForId;
    e.target.value = '';
    if (!file || !id) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/employee-dashboard/payment-methods/${id}/document`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast.success('Document submitted. An admin will review it shortly.');
        fetchMethods();
      } else {
        toast.error(json?.error || 'Failed to upload document');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document');
    } finally {
      setUploadingDocForId(null);
    }
  };

  const closeVerifyModal = () => {
    setVerifyingMethodId(null);
    setOtpInput('');
  };

  return (
    <EmployeePortalLayout>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={handleDocumentSelected}
      />
      <div className="max-w-4xl mx-auto space-y-8">


        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Withdrawal Targets</h1>
            <p className="text-sm text-slate-500 mt-1">Where would you like your funds to be sent?</p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl h-12 px-6 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4 mr-2" /> Add New Method
          </Button>
        </div>

        
        <div className="grid gap-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
          ) : methods.length === 0 ? (
            <div className="bg-white/50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-[2rem] p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No payment methods added yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add a mobile money number or bank account to start.</p>
            </div>
          ) : (
            methods.map((m) => (
              <div key={m.id} className={cn(
                "group relative bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border transition-all duration-300",
                m.is_default ? "border-emerald-500/50 shadow-lg shadow-emerald-500/5" : "border-white/60 dark:border-white/10"
              )}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0",
                      m.method_type === 'mobile_money' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100"
                    )}>
                      {m.method_type === 'mobile_money' ? <Smartphone className="w-7 h-7" /> : <Landmark className="w-7 h-7" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-white capitalize">{m.provider_name}</h3>
                        {m.is_default && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[9px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/20">
                            <Star className="w-2 h-2 fill-current" /> Primary
                          </span>
                        )}
                        {!m.is_verified && m.method_type === 'mobile_money' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[9px] font-bold uppercase tracking-wider rounded-full border border-amber-500/20">
                            Unverified
                          </span>
                        )}
                        {!m.is_verified && m.method_type === 'bank_account' && m.verification_status === 'unverified' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[9px] font-bold uppercase tracking-wider rounded-full border border-amber-500/20">
                            Unverified
                          </span>
                        )}
                        {m.method_type === 'bank_account' && m.verification_status === 'pending_review' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-600 text-[9px] font-bold uppercase tracking-wider rounded-full border border-blue-500/20">
                            <Clock className="w-2 h-2" /> Pending Review
                          </span>
                        )}
                        {m.method_type === 'bank_account' && m.verification_status === 'rejected' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-600 text-[9px] font-bold uppercase tracking-wider rounded-full border border-red-500/20">
                            <XCircle className="w-2 h-2" /> Rejected
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-mono text-slate-500 mt-0.5">{m.account_number || m.phone_number}</p>
                      {(m.account_name) && <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">{m.account_name}</p>}
                      {m.method_type === 'bank_account' && m.verification_status === 'rejected' && m.verification_notes && (
                        <p className="text-[10px] text-red-500 font-medium mt-1">Reason: {m.verification_notes}</p>
                      )}
                    </div>
                  </div>

                  
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {!m.is_verified && m.method_type === 'mobile_money' && (
                      <button
                        onClick={() => requestVerification(m.id)}
                        disabled={otpSending}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {otpSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        Verify
                      </button>
                    )}
                    {!m.is_verified && m.method_type === 'bank_account' &&
                      (m.verification_status === 'unverified' || m.verification_status === 'rejected') && (
                      <button
                        onClick={() => startDocumentUpload(m.id)}
                        disabled={uploadingDocForId === m.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {uploadingDocForId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {m.verification_status === 'rejected' ? 'Re-upload' : 'Upload Proof'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-[2rem] p-6 flex gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Security Note</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
              For your security, changes to payment methods may trigger a 24-hour verification period before they can be used for withdrawals.
              Bank accounts are verified by uploading a bank statement or similar proof of ownership — an admin will review it before your account can be used for withdrawals.
            </p>
          </div>
        </div>

        
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-emerald-500 p-8 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-20">
                  <CreditCard className="w-24 h-24" />
                </div>
                <h2 className="text-2xl font-bold relative z-10">Add Payment Method</h2>
                <p className="text-white/80 relative z-10">Enter your disbursement details below.</p>
              </div>

              <form onSubmit={handleAdd} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Method Type</Label>
                    <Select value={newMethod.method_type} onValueChange={(v: 'mobile_money' | 'bank_account') => setNewMethod({ ...newMethod, method_type: v, provider_name: '' })}>
                      <SelectTrigger className="rounded-xl h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="bank_account">Bank Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{newMethod.method_type === 'mobile_money' ? 'Provider' : 'Bank Name'}</Label>
                    <Input
                      placeholder={newMethod.method_type === 'mobile_money' ? "e.g. M-Pesa, Airtel" : "e.g. Stanbic, KCB"}
                      value={newMethod.provider_name}
                      onChange={e => setNewMethod({ ...newMethod, provider_name: e.target.value })}
                      className="rounded-xl h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{newMethod.method_type === 'mobile_money' ? 'Phone Number' : 'Account Number'}</Label>
                    <Input
                      placeholder={newMethod.method_type === 'mobile_money' ? "07XXXXXXXX" : "0100XXXXXXX"}
                      value={newMethod.account_number}
                      onChange={e => setNewMethod({ ...newMethod, account_number: e.target.value })}
                      className="rounded-xl h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Account Holder Name</Label>
                    <Input
                      placeholder="Your full name as it appears"
                      value={newMethod.account_name}
                      onChange={e => setNewMethod({ ...newMethod, account_name: e.target.value })}
                      className="rounded-xl h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="flex-1 rounded-xl h-12">Cancel</Button>
                  <Button type="submit" disabled={adding} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 font-bold uppercase tracking-widest">
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Method'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        
        {verifyingMethodId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeVerifyModal}>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verify payment method</h3>
              <p className="text-sm text-slate-500 mt-2 mb-4">
                Enter the 6-digit code we just texted to your phone. It expires in 10 minutes.
              </p>
              <div className="space-y-3">
                <Label>Verification Code</Label>
                <Input
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  className="rounded-xl h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-center text-lg font-mono tracking-widest"
                  autoFocus
                />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={closeVerifyModal} className="flex-1 rounded-xl h-12">Cancel</Button>
                  <Button
                    type="button"
                    onClick={submitOtp}
                    disabled={otpSubmitting || otpInput.length !== 6}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 font-bold uppercase tracking-widest"
                  >
                    {otpSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => verifyingMethodId && requestVerification(verifyingMethodId)}
                  disabled={otpSending}
                  className="w-full text-center text-xs font-medium text-emerald-600 hover:text-emerald-700 mt-2 disabled:opacity-50"
                >
                  {otpSending ? 'Resending...' : "Didn't get a code? Resend"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </EmployeePortalLayout>
  );
};

export default PaymentMethods;