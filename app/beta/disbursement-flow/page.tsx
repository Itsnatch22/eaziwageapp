"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, Mail, User, Wallet } from "lucide-react";
import { betaDisbursementSchema, type BetaDisbursementFormData } from "@/lib/validations/beta-disbursement";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type Choice = { value: string; label: string };
type Question = { key: keyof BetaDisbursementFormData["answers"]; title: string; help: string; choices: Choice[] };

const pagesToReview = [
  { value: "Request advance", href: "/dashboards/employee-dashboard/request-advance" },
  { value: "Payment methods", href: "/dashboards/employee-dashboard/payment-methods" },
  { value: "Transactions", href: "/dashboards/employee-dashboard/transactions" },
];

const questions: Question[] = [
  { key: "q1", title: "How easy was it to start a disbursement request?", help: "Consider the request advance page and the first step.", choices: [["very_easy", "Very easy"], ["easy", "Easy"], ["neutral", "Neutral"], ["difficult", "Difficult"], ["very_difficult", "Very difficult"]].map(([value, label]) => ({ value, label })) },
  { key: "q2", title: "How clear were the instructions?", help: "Include the amount, fee, and payment-method guidance.", choices: [["very_clear", "Very clear"], ["clear", "Clear"], ["neutral", "Neutral"], ["unclear", "Unclear"], ["very_unclear", "Very unclear"]].map(([value, label]) => ({ value, label })) },
  { key: "q3", title: "Were you able to complete the expected steps?", help: "Answer based on the full request-to-status journey.", choices: [["completely", "Completely"], ["mostly", "Mostly"], ["somewhat", "Somewhat"], ["not_really", "Not really"], ["no", "No"]].map(([value, label]) => ({ value, label })) },
  { key: "q4", title: "How confident did you feel selecting a payment method?", help: "Consider mobile money or bank transfer details.", choices: [["very_confident", "Very confident"], ["confident", "Confident"], ["neutral", "Neutral"], ["not_confident", "Not confident"], ["not_at_all_confident", "Not at all confident"]].map(([value, label]) => ({ value, label })) },
  { key: "q5", title: "How clear were the amount and fees?", help: "Consider what you receive and what must be repaid.", choices: [["very_clear", "Very clear"], ["clear", "Clear"], ["neutral", "Neutral"], ["unclear", "Unclear"], ["very_unclear", "Very unclear"]].map(([value, label]) => ({ value, label })) },
  { key: "q6", title: "How clear were the disbursement status updates?", help: "Consider processing, completed, and failed states.", choices: [["very_clear", "Very clear"], ["clear", "Clear"], ["neutral", "Neutral"], ["unclear", "Unclear"], ["very_unclear", "Very unclear"]].map(([value, label]) => ({ value, label })) },
  { key: "q7", title: "How did the disbursement speed feel?", help: "Base this on the time from submission to receiving funds.", choices: [["very_fast", "Very fast"], ["fast", "Fast"], ["about_right", "About right"], ["slow", "Slow"], ["very_slow", "Very slow"]].map(([value, label]) => ({ value, label })) },
  { key: "q9", title: "How comfortable were you sharing information for payment?", help: "Consider the security and privacy of the flow.", choices: [["very_comfortable", "Very comfortable"], ["comfortable", "Comfortable"], ["neutral", "Neutral"], ["uncomfortable", "Uncomfortable"], ["very_uncomfortable", "Very uncomfortable"]].map(([value, label]) => ({ value, label })) },
  { key: "q10", title: "How would you rate the overall disbursement experience?", help: "Give your overall impression after reviewing the flow.", choices: [["excellent", "Excellent"], ["good", "Good"], ["fair", "Fair"], ["poor", "Poor"], ["very_poor", "Very poor"]].map(([value, label]) => ({ value, label })) },
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
  const answered = useMemo(() => questions.filter((q) => typeof watched.answers?.[q.key] === "string" && watched.answers?.[q.key]).length, [watched.answers]);

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

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Link href="/" className="inline-flex items-center gap-3 text-xl font-bold"><Wallet className="h-7 w-7 text-emerald-600" />EaziWage</Link>
          <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Beta feedback</p><h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Review the disbursement journey.</h1></div>
          <p className="leading-7 text-slate-600 dark:text-slate-400">Try the employee advance request, payment method, and transaction status pages, then tell us what worked and what needs attention.</p>
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><p className="mb-3 text-sm font-bold">Pages to review</p>{pagesToReview.map((page) => <div key={page.value} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0 dark:border-slate-800"><span className="text-sm text-slate-600 dark:text-slate-400">{page.value}</span><Link href={page.href} className="text-sm font-semibold text-emerald-600">Open <ArrowRight className="inline h-3 w-3" /></Link></div>)}</div>
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><div className="flex justify-between text-sm font-semibold"><span>Required progress</span><span className="text-emerald-600">{answered}/{questions.length}</span></div><div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} /></div></div>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10 dark:border-slate-800 dark:bg-slate-900">
          {submitted ? <div className="py-16 text-center"><CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" /><h2 className="mt-6 text-3xl font-bold">Feedback received</h2><p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-400">Thank you for helping us improve the disbursement experience.</p><Button variant="outline" className="mt-8" onClick={() => setSubmitted(false)}>Submit another response</Button></div> : <form onSubmit={handleSubmit(onSubmit)} className="space-y-7"><input className="sr-only" tabIndex={-1} {...register("honeypot")} /><div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="name">Full name</Label><div className="relative mt-2"><Input id="name" {...register("name")} placeholder="Your name" className="pr-10" /><User className="absolute right-3 top-3 h-5 w-5 text-slate-400" /></div><FieldError message={errors.name?.message} /></div><div><Label htmlFor="email">Email address</Label><div className="relative mt-2"><Input id="email" type="email" {...register("email")} placeholder="you@company.com" className="pr-10" /><Mail className="absolute right-3 top-3 h-5 w-5 text-slate-400" /></div><FieldError message={errors.email?.message} /></div></div><div className="space-y-5">{questions.map((question, index) => <div key={question.key} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><Label className="text-base font-bold">{index + 1}. {question.title}</Label><p className="mt-1 text-sm text-slate-500">{question.help}</p><Controller control={control} name={`answers.${question.key}`} render={({ field }) => <RadioGroup value={typeof field.value === "string" ? field.value : ""} onValueChange={field.onChange} className="mt-4 grid gap-2 sm:grid-cols-2">{question.choices.map((choice) => <label key={choice.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><RadioGroupItem value={choice.value} />{choice.label}</label>)}</RadioGroup>} /><FieldError message={errors.answers?.[question.key]?.message as string | undefined} /></div>)}<div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><Label>Did you encounter a bug or unexpected state?</Label><Controller control={control} name="answers.q8.value" render={({ field }) => <RadioGroup value={field.value ? "yes" : "no"} onValueChange={(value) => field.onChange(value === "yes")} className="mt-4 flex gap-5"><label className="flex items-center gap-2"><RadioGroupItem value="yes" />Yes</label><label className="flex items-center gap-2"><RadioGroupItem value="no" />No</label></RadioGroup>} />{watched.answers?.q8?.value && <Textarea className="mt-4" placeholder="What happened?" {...register("answers.q8.details")} />}<FieldError message={errors.answers?.q8?.details?.message} /></div><div className="grid gap-5 sm:grid-cols-2"><div><Label>What felt most helpful? <span className="text-slate-400">(optional)</span></Label><Textarea className="mt-2" {...register("answers.q11")} /></div><div><Label>What should we improve first? <span className="text-slate-400">(optional)</span></Label><Textarea className="mt-2" {...register("answers.q12")} /></div></div></div><Button type="submit" disabled={submitting} className="w-full">{submitting && <Loader2 className="animate-spin" />}Submit feedback</Button></form>}
        </section>
      </div>
    </main>
  );
}
