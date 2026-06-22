"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Heart, RefreshCcw, CheckCircle2, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion';

const TERMINATION_REASONS = [
  "Switching to another provider",
  "Service is too expensive",
  "Not enough employee participation",
  "Internal payroll changes",
  "Closing business operations",
  "Other"
];

export default function TerminatedPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    setSubmitting(true);
    try {
      await fetch('/api/employer-dashboard/termination/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          other_reason: otherReason,
          additional_comments: comments
        })
      });
      setStep(2);
    } catch {
      toast.error("Failed to send feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreAccount = async () => {
    setRestoring(true);
    try {
      const res = await fetch('/api/employer-dashboard/termination/restore', {
        method: 'POST'
      });
      if (res.ok) {
        toast.success("Account restored successfully!");
        router.push('/dashboards/employer-dashboard');
      }
    } catch {
      toast.error("Failed to restore account");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      
      <div className="absolute top-0 right-0 p-20 opacity-5 dark:opacity-10 pointer-events-none">
         <Heart className="w-96 h-96 text-red-500" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10"
      >
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8 md:p-12 space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                   <Heart className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">We&apos;re sorry to see you go.</h1>
                <p className="text-slate-500 dark:text-slate-400">Your account termination has been initiated. You have <strong>30 days</strong> to restore your data before it&apos;s permanently deleted.</p>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Quick Survey</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">Why did you decide to leave? *</label>
                      <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger className="rounded-xl h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {TERMINATION_REASONS.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {reason === "Other" && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-slate-500">Please specify</label>
                        <Textarea 
                          placeholder="Tell us more..."
                          value={otherReason}
                          onChange={e => setOtherReason(e.target.value)}
                          className="rounded-xl bg-white dark:bg-slate-900 min-h-[80px]"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">Additional comments (Optional)</label>
                      <Textarea 
                        placeholder="Any final thoughts for our team?"
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                        className="rounded-xl bg-white dark:bg-slate-900 min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={handleSubmitFeedback}
                    disabled={submitting}
                    className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white h-14 rounded-2xl font-black uppercase tracking-widest"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit & Log Out"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={handleRestoreAccount}
                    disabled={restoring}
                    className="w-full h-14 rounded-2xl font-bold text-primary gap-2"
                  >
                    <RefreshCcw className={cn("w-4 h-4", restoring && "animate-spin")} /> I changed my mind, restore account
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center space-y-8"
            >
              <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/10">
                 <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Thank you for the feedback.</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  We value your input and will use it to improve EaziWage. Your account is now in the 30-day grace period.
                </p>
              </div>
              
              <div className="pt-8 flex flex-col gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                   Check your email for a confirmation of this request.
                </div>
                <Button 
                  onClick={() => router.push('/')}
                  className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white h-14 rounded-2xl font-black uppercase tracking-widest"
                >
                  Return to Home
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
