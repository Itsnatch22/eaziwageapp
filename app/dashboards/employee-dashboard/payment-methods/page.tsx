"use client";
import React, { useState, useEffect } from 'react';
import { 
  Smartphone, Landmark, Plus, Trash2, CheckCircle2, 
  AlertCircle, Loader2, CreditCard, ChevronRight, Star
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

interface PaymentMethod {
  id: string;
  type: 'mobile_money' | 'bank';
  provider: string;
  account_number: string;
  account_name?: string;
  is_primary: boolean;
}

const PaymentMethods = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);

  const [newMethod, setNewMethod] = useState({
    type: 'mobile_money',
    provider: '',
    account_number: '',
    account_name: '',
    is_primary: false
  });

  const fetchMethods = async () => {
    try {
      const res = await fetch('/api/employee-dashboard/payment-methods');
      if (res.ok) {
        const data = await res.json();
        setMethods(data.methods || []);
      }
    } catch (err) {
      toast.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMethods(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch('/api/employee-dashboard/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: newMethod })
      });
      if (res.ok) {
        toast.success('Payment method added');
        setShowAddModal(false);
        setNewMethod({ type: 'mobile_money', provider: '', account_number: '', account_name: '', is_primary: false });
        fetchMethods();
      } else {
        throw new Error('Failed to add');
      }
    } catch (err) {
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
      }
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <EmployeePortalLayout title="Payment Methods">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
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

        {/* Methods List */}
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
                m.is_primary ? "border-emerald-500/50 shadow-lg shadow-emerald-500/5" : "border-white/60 dark:border-white/10"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center border",
                      m.type === 'mobile_money' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100"
                    )}>
                      {m.type === 'mobile_money' ? <Smartphone className="w-7 h-7" /> : <Landmark className="w-7 h-7" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white capitalize">{m.provider}</h3>
                        {m.is_primary && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[9px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/20">
                            <Star className="w-2 h-2 fill-current" /> Primary
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-mono text-slate-500 mt-0.5">{m.account_number}</p>
                      {m.account_name && <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">{m.account_name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
              </p>
           </div>
        </div>

        {/* Add Modal */}
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
                    <Select value={newMethod.type} onValueChange={(v: any) => setNewMethod({ ...newMethod, type: v, provider: '' })}>
                      <SelectTrigger className="rounded-xl h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="bank">Bank Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{newMethod.type === 'mobile_money' ? 'Provider' : 'Bank Name'}</Label>
                    <Input 
                      placeholder={newMethod.type === 'mobile_money' ? "e.g. M-Pesa, Airtel" : "e.g. Stanbic, KCB"}
                      value={newMethod.provider}
                      onChange={e => setNewMethod({ ...newMethod, provider: e.target.value })}
                      className="rounded-xl h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{newMethod.type === 'mobile_money' ? 'Phone Number' : 'Account Number'}</Label>
                    <Input 
                      placeholder={newMethod.type === 'mobile_money' ? "2547XXXXXXXX" : "0100XXXXXXX"}
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

      </div>
    </EmployeePortalLayout>
  );
};

export default PaymentMethods;
