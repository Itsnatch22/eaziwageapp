"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  HelpCircle, MessageCircle, History, ExternalLink,
  ChevronDown, Loader2
} from 'lucide-react';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDateTime, cn } from '@/lib/utils';

const FAQS = [
  {
    q: "How much can I withdraw?",
    a: "You can typically withdraw up to 50% of your earned wages for the current month. The exact amount is updated daily based on your accrued salary."
  },
  {
    q: "How long does it take to receive funds?",
    a: "Disbursements are processed instantly via Mobile Money (M-Pesa/Airtel) or Bank Transfer, depending on your selected primary payment method."
  },
  {
    q: "Are there any hidden fees?",
    a: "No. EaziWage charges a transaction fee between 3.5% and 6.5% per advance, based on your risk assessment — you'll always see the exact fee before confirming a request. There are no interest rates or late payment penalties."
  },
  {
    q: "How do I repay my advance?",
    a: "Repayment is automatic. The amount you withdrew, plus the transaction fee, will be deducted from your next paycheck by your employer."
  }
];

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

const SupportPage = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [newTicket, setNewTicket] = useState({ subject: '', message: '', category: 'General' });

  useEffect(() => {
    let cancelled = false;

    async function fetchTickets(options?: { silent?: boolean }) {
      if (!options?.silent) setLoading(true);
      try {
        const res = await fetch('/api/employee-dashboard/support');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setTickets(data.tickets || []);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load support history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchTickets({ silent: true });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch('/api/employee-dashboard/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });
      if (res.ok) {
        toast.success('Support ticket opened!');
        setShowAddModal(false);
        setNewTicket({ subject: '', message: '', category: 'General' });

        const refreshRes = await fetch('/api/employee-dashboard/support');
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setTickets(data.tickets || []);
        }
      }
    } catch {
      toast.error('Failed to send ticket');
    } finally {
      setAdding(false);
    }
  };

  return (
    <EmployeePortalLayout title="Support & Help">
      <div className="max-w-4xl mx-auto space-y-12">
        
        
        <div className="grid md:grid-cols-2 gap-6">
           <div className="bg-linear-to-br from-emerald-500 to-emerald-600 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                 <MessageCircle className="w-32 h-32" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Need direct help?</h3>
              <p className="text-white/80 text-sm mb-6 leading-relaxed">Our support team is available 24/7 to assist with your account or transactions.</p>
              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-white text-emerald-600 hover:bg-slate-50 font-bold rounded-2xl h-12 px-6 shadow-lg shadow-black/5"
              >
                Open Support Ticket
              </Button>
           </div>

           <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 dark:border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Contact Page</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">Visit our main contact page for corporate inquiries or partnerships.</p>
              </div>
              <Link href="/contact" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="rounded-2xl h-12 px-6 border-slate-200 dark:border-white/10">
                  Go to contact <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </Link>
           </div>
        </div>

        
        <div className="space-y-6">
           <div className="flex items-center gap-3 px-1">
              <HelpCircle className="w-5 h-5 text-emerald-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Frequently Asked Questions</h3>
           </div>
           <div className="space-y-3">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 overflow-hidden">
                   <button 
                     onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                     className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-slate-50/50 dark:hover:bg-white/2"
                   >
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{faq.q}</span>
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300", openFaq === idx && "rotate-180")} />
                   </button>
                   {openFaq === idx && (
                     <div className="p-5 pt-0 text-sm text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-white/5 animate-in slide-in-from-top-2 duration-300">
                        {faq.a}
                     </div>
                   )}
                </div>
              ))}
           </div>
        </div>

        
        <div className="space-y-6">
           <div className="flex items-center gap-3 px-1">
              <History className="w-5 h-5 text-emerald-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Your Support Tickets</h3>
           </div>
           
           <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 overflow-hidden">
              {loading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
              ) : tickets.length === 0 ? (
                <div className="py-16 text-center">
                   <p className="text-slate-500 text-sm font-medium">No tickets found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {tickets.map((t) => (
                    <div key={t.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                       <div className="flex items-start justify-between gap-4 mb-2">
                          <h4 className="font-bold text-slate-900 dark:text-white">{t.subject}</h4>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                            t.status === 'open' ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          )}>
                             {t.status}
                          </span>
                       </div>
                       <p className="text-sm text-slate-500 line-clamp-2">{t.message}</p>
                       <p className="text-[10px] text-slate-400 mt-4 font-bold tracking-wider uppercase">{formatDateTime(t.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
           </div>
        </div>

        
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="bg-linear-to-br from-slate-900 to-slate-800 p-8 text-white relative">
                 <h2 className="text-2xl font-bold">New Support Ticket</h2>
                 <p className="text-white/60 text-sm mt-1">Briefly describe your issue and we&apos;ll get back to you.</p>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Subject</label>
                    <Input 
                      placeholder="e.g. Disbursement Issue"
                      value={newTicket.subject}
                      onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                      className="rounded-2xl h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 font-medium"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Message</label>
                    <Textarea 
                      placeholder="Details of your request..."
                      value={newTicket.message}
                      onChange={e => setNewTicket({ ...newTicket, message: e.target.value })}
                      className="rounded-2xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 font-medium min-h-30 resize-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="flex-1 rounded-2xl h-12">Cancel</Button>
                  <SubmitButton
                    isLoading={adding}
                    label="Open Ticket"
                    loadingLabel="Opening..."
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl h-12 font-bold uppercase tracking-widest"
                  />
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </EmployeePortalLayout>
  );
};

export default SupportPage;