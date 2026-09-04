"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, ClipboardCheck, Loader2, Mail, Send, User, Wallet } from "lucide-react";
import { betaDisbursementSchema, type BetaDisbursementFormData } from "@/lib/validations/beta-disbursement";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type Choice = { value: string; label: string };
type Question = { key: keyof BetaDisbursementFormData["answers"]; title: string; help: string; choices: Choice[] };

const pagesToReview = [
  { value: "Request advance", href: "/dashboards/employee-dashboard/request-advance" },
  { value: "Payment methods", href: "/dashboards/employee-dashboard/payment-methods" },
  { value: "Transactions", href: "/dashboards/employee-dashboard/transactions" },
];

const choices = (values: [string, string][]) => values.map(([value, label]) => ({ value, label }));
const questions: Question[] = [
  { key: "q1", title: "How easy was it to start a disbursement request?", help: "Consider the request advance page and the first step.", choices: choices([["very_easy", "Very easy"], ["easy", "Easy"], ["neutral", "Neutral"], ["difficult", "Difficult"], ["very_difficult", "Very difficult"]]) },
  { key: "q2", title: "How clear were the instructions?", help: "Include the amount, fee, and payment-method guidance.", choices: choices([["very_clear", "Very clear"], ["clear", "Clear"], ["neutral", "Neutral"], ["unclear", "Unclear"], ["very_unclear", "Very unclear"]]) },
  { key: "q3", title: "Were you able to complete the expected steps?", help: "Answer based on the full request-to-status journey.", choices: choices([["completely", "Completely"], ["mostly", "Mostly"], ["somewhat", "Somewhat"], ["not_really", "Not really"], ["no", "No"]]) },
  { key: "q4", title: "How confident did you feel selecting a payment method?", help: "Consider mobile money or bank transfer details.", choices: choices([["very_confident", "Very confident"], ["confident", "Confident"], ["neutral", "Neutral"], ["not_confident", "Not confident"], ["not_at_all_confident", "Not at all confident"]]) },
  { key: "q5", title: "How clear were the amount and fees?", help: "Consider what you receive and what must be repaid.", choices: choices([["very_clear", "Very clear"], ["clear", "Clear"], ["neutral", "Neutral"], ["unclear", "Unclear"], ["very_unclear", "Very unclear"]]) },
  { key: "q6", title: "How clear were the disbursement status updates?", help: "Consider processing, completed, and failed states.", choices: choices([["very_clear", "Very clear"], ["clear", "Clear"], ["neutral", "Neutral"], ["unclear", "Unclear"], ["very_unclear", "Very unclear"]]) },
  { key: "q7", title: "How did the disbursement speed feel?", help: "Base this on the time from submission to receiving funds.", choices: choices([["very_fast", "Very fast"], ["fast", "Fast"], ["about_right", "About right"], ["slow", "Slow"], ["very_slow", "Very slow"]]) },
  { key: "q9", title: "How comfortable were you sharing information for payment?", help: "Consider the security and privacy of the flow.", choices: choices([["very_comfortable", "Very comfortable"], ["comfortable", "Comfortable"], ["neutral", "Neutral"], ["uncomfortable", "Uncomfortable"], ["very_uncomfortable", "Very uncomfortable"]]) },
  { key: "q10", title: "How would you rate the overall disbursement experience?", help: "Give your overall impression after reviewing the flow.", choices: choices([["excellent", "Excellent"], ["good", "Good"], ["fair", "Fair"], ["poor", "Poor"], ["very_poor", "Very poor"]]) },
];

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs font-medium text-red-500">{message}</p> : null;
}

export default function BetaDisbursementFlowPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { control, register, handleSubmit, reset, setValue, formState: { errors } } = useForm<BetaDisbursementFormData>({
    resolver: zodResolver(betaDisbursementSchema),
    defaultValues: { name: "", email: "", reviewedPages: [], honeypot: "", answers: { q8: { value: false, details: "" }, q11: "", q12: "" } },
  });
  const watched = useWatch({ control });
  const reviewedPages = useWatch({ control, name: "reviewedPages" }) ?? [];
  const answered = useMemo(() => questions.filter((question) => typeof watched.answers?.[question.key] === "string" && watched.answers?.[question.key]).length, [watched.answers]);

  useEffect(() => {
    let mounted = true;
    createClient().auth.getUser().then(({ data }) => {
      if (!mounted || !data.user) return;
      setValue("userId", data.user.id);
      if (data.user.email) setValue("email", data.user.email, { shouldValidate: true });
      const name = data.user.user_metadata?.full_name;
      if (typeof name === "string" && name.trim()) setValue("name", name, { shouldValidate: true });
    });
    return () => { mounted = false; };
  }, [setValue]);

  const onSubmit = async (data: BetaDisbursementFormData) => {
    if (data.honeypot) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/beta/disbursement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || "Failed to submit feedback. Please try again.");
        return;
      }
      setSubmitted(true);
      reset();
      toast.success("Feedback submitted successfully.");
    } catch {
      toast.error("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = submitted ? (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="py-12 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-green-500"><CheckCircle2 className="h-10 w-10" /></div>
      <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">Feedback Received</h2>
      <p className="mx-auto max-w-sm text-slate-600 dark:text-slate-400">Thank you for helping us tighten the disbursement experience before launch.</p>
      <Button variant="outline" className="mt-8 border-slate-200 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800" onClick={() => setSubmitted(false)}>Submit another response</Button>
    </motion.div>
  ) : (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="mb-10"><h2 className="text-2xl font-bold text-slate-900 dark:text-white">Beta disbursement survey</h2><p className="mt-2 text-slate-600 dark:text-slate-400">Share what worked, what slowed you down, and what needs fixing.</p></div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <input type="text" className="sr-only" tabIndex={-1} {...register("honeypot")} />
        <div className="grid gap-6 sm:grid-cols-2">
          {[{ id: "name", label: "Full Name", type: "text", icon: User, placeholder: "Your name" }, { id: "email", label: "Email Address", type: "email", icon: Mail, placeholder: "you@company.com" }].map(({ id, label, type, icon: Icon, placeholder }) => <div key={id} className="space-y-2"><Label htmlFor={id} className="text-slate-700 dark:text-slate-300">{label}</Label><div className="relative"><Input id={id} type={type} placeholder={placeholder} {...register(id as "name" | "email")} className="h-14 border-slate-200 bg-white pr-12 text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500" /><Icon className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /></div><FieldError message={errors[id as "name" | "email"]?.message} /></div>)}
        </div>
        <div className="space-y-5">{questions.map((question, index) => <div key={question.key} className="rounded-3xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-950/30"><div className="mb-4"><div className="flex items-start justify-between gap-4"><Label className="text-base font-bold leading-snug text-slate-900 dark:text-white">{index + 1}. {question.title}</Label><span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Required</span></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{question.help}</p></div><Controller control={control} name={`answers.${question.key}`} render={({ field }) => <RadioGroup value={typeof field.value === "string" ? field.value : ""} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2">{question.choices.map((choice) => <label key={choice.value} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:border-green-300 hover:bg-green-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-green-800 dark:hover:bg-green-900/10", field.value === choice.value && "border-green-500 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400")}><RadioGroupItem value={choice.value} /><span>{choice.label}</span></label>)}</RadioGroup>} /><FieldError message={errors.answers?.[question.key]?.message} /></div>)}</div>
        <Button type="submit" disabled={submitting} className="h-14 w-full bg-linear-to-r from-green-600 to-green-500 text-lg font-bold text-white shadow-lg shadow-green-600/25 transition-all duration-200 hover:from-green-700 hover:to-green-600">{submitting ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Submitting...</span> : <span className="flex items-center gap-2"><Send className="h-5 w-5" />Submit Feedback</span>}</Button>
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400"><span>{reviewedPages.length} pages marked reviewed</span><ArrowRight className="h-3.5 w-3.5" /><span>{questions.length} required questions</span></div>
      </form>
    </motion.div>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-white transition-colors duration-500 dark:bg-slate-950">
      <div className="fixed inset-0 pointer-events-none"><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)]" /><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.06)_0%,transparent_60%)]" /><div className="absolute top-20 right-0 h-150 w-150 rounded-full bg-green-500/8 blur-[150px]" /><div className="absolute bottom-0 left-0 h-125 w-125 rounded-full bg-slate-900/5 blur-[150px] dark:bg-green-900/10" /></div>
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28"><div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="lg:sticky lg:top-24"><Link href="/" className="group mb-10 inline-flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-linear-to-br from-emerald-500/20 to-green-500/20 shadow-lg shadow-green-600/10 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:shadow-emerald-500/20 dark:border-slate-800"><Wallet className="h-6 w-6 text-emerald-700 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" /></div><span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">EaziWage</span></Link><div className="space-y-6"><motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Beta Feedback</motion.div><h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl dark:text-white">Review the disbursement journey.</h1><p className="max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">Try the employee advance request, payment method, and transaction status pages, then tell us what worked and what needs attention.</p><div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/80"><div className="mb-4 flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"><ClipboardCheck className="h-5 w-5" /></div><div><p className="text-sm font-bold text-slate-900 dark:text-white">Pages to review</p><p className="text-xs text-slate-500 dark:text-slate-400">Open what applies, then tick what you checked.</p></div></div><div className="space-y-3">{pagesToReview.map((page) => <div key={page.value} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40"><Controller control={control} name="reviewedPages" render={({ field }) => { const selected = field.value ?? []; return <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300"><Checkbox checked={selected.includes(page.value)} onCheckedChange={(checked) => field.onChange(checked ? [...selected, page.value] : selected.filter((value) => value !== page.value))} /><span className="truncate">{page.value}</span></label>; }} /><Link href={page.href} className="text-sm font-semibold text-green-600 hover:underline dark:text-green-400">Open</Link></div>)}</div></div><div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/80"><div className="mb-3 flex items-center justify-between gap-4"><p className="text-sm font-bold text-slate-900 dark:text-white">Required progress</p><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{answered}/{questions.length}</p></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-green-600 transition-all duration-300" style={{ width: `${(answered / questions.length) * 100}%` }} /></div></div></div></motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative"><div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:p-10 dark:border-slate-700/80 dark:bg-slate-900/80"><AnimatePresence mode="wait">{content}</AnimatePresence></div></motion.div>
      </div></div>
    </main>
  );
}
