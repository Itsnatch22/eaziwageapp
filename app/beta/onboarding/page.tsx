"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Mail,
  Send,
  User,
  Wallet,
} from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { betaOnboardingSchema, type BetaOnboardingFormData } from "@/lib/validations/beta-onboarding";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AnswerKey = keyof BetaOnboardingFormData["answers"];

interface Choice {
  value: string;
  label: string;
}

interface Question {
  key: AnswerKey;
  title: string;
  help: string;
  required: boolean;
  choices?: Choice[];
}

const pagesToReview = [
  { value: "Register", label: "Register", href: "/register" },
  { value: "Login", label: "Login", href: "/" },
  { value: "Employee onboarding", label: "Employee onboarding", href: "/dashboards/employee-dashboard/onboarding" },
  { value: "Employer onboarding", label: "Employer onboarding", href: "/dashboards/employer-dashboard/onboarding" },
];

const questions: Question[] = [
  {
    key: "q1",
    title: "How easy was it to understand where to start?",
    help: "Think about the register page and first impression of the login page.",
    required: true,
    choices: [
      { value: "very_easy", label: "Very easy" },
      { value: "easy", label: "Easy" },
      { value: "neutral", label: "Neutral" },
      { value: "difficult", label: "Difficult" },
      { value: "very_difficult", label: "Very difficult" },
    ],
  },
  {
    key: "q2",
    title: "How clear were the instructions across the onboarding steps?",
    help: "Include both employee and employer onboarding if you reviewed both.",
    required: true,
    choices: [
      { value: "very_clear", label: "Very clear" },
      { value: "clear", label: "Clear" },
      { value: "neutral", label: "Neutral" },
      { value: "unclear", label: "Unclear" },
      { value: "very_unclear", label: "Very unclear" },
    ],
  },
  {
    key: "q3",
    title: "Were you able to complete the expected tasks?",
    help: "Base this on registration, login, and the onboarding pages you tested.",
    required: true,
    choices: [
      { value: "completely", label: "Completely" },
      { value: "mostly", label: "Mostly" },
      { value: "somewhat", label: "Somewhat" },
      { value: "not_really", label: "Not really" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "q4",
    title: "Did you get stuck at any step?",
    help: "If yes, tell us the step name or page section.",
    required: true,
  },
  {
    key: "q5",
    title: "How did the number of steps feel?",
    help: "Consider the overall amount of information requested.",
    required: true,
    choices: [
      { value: "too_few", label: "Too few" },
      { value: "just_right", label: "Just right" },
      { value: "slightly_too_many", label: "Slightly too many" },
      { value: "far_too_many", label: "Far too many" },
    ],
  },
  {
    key: "q6",
    title: "Was anything confusing?",
    help: "This can include copy, labels, required documents, or field names.",
    required: true,
  },
  {
    key: "q7",
    title: "How comfortable did you feel sharing the requested information?",
    help: "Think about identity, employment, payroll, and payment details.",
    required: true,
    choices: [
      { value: "very_comfortable", label: "Very comfortable" },
      { value: "comfortable", label: "Comfortable" },
      { value: "neutral", label: "Neutral" },
      { value: "uncomfortable", label: "Uncomfortable" },
      { value: "very_uncomfortable", label: "Very uncomfortable" },
    ],
  },
  {
    key: "q8",
    title: "How would you rate the overall onboarding experience?",
    help: "Your overall impression after reviewing the full flow.",
    required: true,
    choices: [
      { value: "excellent", label: "Excellent" },
      { value: "good", label: "Good" },
      { value: "fair", label: "Fair" },
      { value: "poor", label: "Poor" },
      { value: "very_poor", label: "Very poor" },
    ],
  },
  {
    key: "q9",
    title: "How easy was it to move between pages and steps?",
    help: "Include buttons, back actions, progress indicators, and redirects.",
    required: true,
    choices: [
      { value: "very_easy", label: "Very easy" },
      { value: "easy", label: "Easy" },
      { value: "neutral", label: "Neutral" },
      { value: "difficult", label: "Difficult" },
      { value: "very_difficult", label: "Very difficult" },
    ],
  },
  {
    key: "q10",
    title: "Did you notice a bug, broken state, or technical issue?",
    help: "Mention the page and what happened if you can.",
    required: true,
  },
  {
    key: "q11",
    title: "How did the pace of the experience feel?",
    help: "Optional, but helpful for tuning the flow.",
    required: false,
    choices: [
      { value: "too_slow", label: "Too slow" },
      { value: "slightly_slow", label: "Slightly slow" },
      { value: "about_right", label: "About right" },
      { value: "slightly_fast", label: "Slightly fast" },
      { value: "too_fast", label: "Too fast" },
    ],
  },
  {
    key: "q12",
    title: "Did you run into anything else we should investigate?",
    help: "Optional follow-up for anything not covered above.",
    required: false,
  },
  {
    key: "q13",
    title: "How confident would you feel using EaziWage after this flow?",
    help: "Optional signal for trust and readiness.",
    required: false,
    choices: [
      { value: "very_confident", label: "Very confident" },
      { value: "confident", label: "Confident" },
      { value: "neutral", label: "Neutral" },
      { value: "not_very_confident", label: "Not very confident" },
      { value: "not_at_all_confident", label: "Not at all confident" },
    ],
  },
  {
    key: "q14",
    title: "What felt most helpful?",
    help: "Optional short note.",
    required: false,
  },
  {
    key: "q15",
    title: "What should we improve first?",
    help: "Optional short note.",
    required: false,
  },
];

const requiredQuestionCount = questions.filter((question) => question.required).length;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-xs font-medium text-red-500">{message}</p>;
}

export default function BetaOnboardingPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BetaOnboardingFormData>({
    resolver: zodResolver(betaOnboardingSchema),
    defaultValues: {
      name: "",
      email: "",
      reviewedPages: [],
      honeypot: "",
      answers: {
        q4: { encountered: false, step: "" },
        q6: { confusing: false, details: "" },
        q10: { issue: false, details: "" },
        q12: { encountered: false, details: "" },
        q14: "",
        q15: "",
      },
    },
  });

  const watchedAnswers = useWatch({ control, name: "answers" });
  const reviewedPages = useWatch({ control, name: "reviewedPages" }) ?? [];

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted || !data.user) return;

      setValue("userId", data.user.id);
      if (data.user.email) {
        setValue("email", data.user.email, { shouldValidate: true });
      }

      const fullName = data.user.user_metadata?.full_name;
      if (typeof fullName === "string" && fullName.trim()) {
        setValue("name", fullName, { shouldValidate: true });
      }
    });

    return () => {
      mounted = false;
    };
  }, [setValue]);

  const answeredRequiredCount = useMemo(() => {
    return questions.filter((question) => {
      if (!question.required) return false;
      const value = watchedAnswers?.[question.key];

      if (question.choices) {
        return typeof value === "string" && value.length > 0;
      }

      if (question.key === "q4") {
        return typeof watchedAnswers?.q4?.encountered === "boolean";
      }
      if (question.key === "q6") {
        return typeof watchedAnswers?.q6?.confusing === "boolean";
      }
      if (question.key === "q10") {
        return typeof watchedAnswers?.q10?.issue === "boolean";
      }

      return false;
    }).length;
  }, [watchedAnswers]);

  const onSubmit = async (data: BetaOnboardingFormData) => {
    if (data.honeypot) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/beta/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast.success("Feedback submitted successfully.");
        reset();
        setTimeout(() => setIsSuccess(false), 10000);
      } else {
        toast.error(result.error || "Failed to submit feedback. Please try again.");
      }
    } catch (error: unknown) {
      console.error(error);
      toast.error("Network error. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white transition-colors duration-500 dark:bg-slate-950">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(22,163,74,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.06)_0%,transparent_60%)] pointer-events-none dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.06)_0%,transparent_60%)]" />
        <div className="absolute top-20 right-0 w-150 h-150 bg-green-500/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-125 h-125 bg-slate-900/5 rounded-full blur-[150px] pointer-events-none dark:bg-green-900/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:sticky lg:top-24"
          >
            <Link href="/" className="mb-10 inline-flex items-center gap-3 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-linear-to-br from-emerald-500/20 to-green-500/20 shadow-lg shadow-green-600/10 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:shadow-emerald-500/20 dark:border-slate-800">
                <Wallet className="h-6 w-6 text-emerald-700 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">EaziWage</span>
            </Link>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-700 backdrop-blur-sm dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Beta Feedback
              </motion.div>

              <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
                Tell us how onboarding really felt.
              </h1>

              <p className="max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                Please answer from your experience reviewing register, login, and the employee or employer onboarding flow. Ten questions are required; the final five are optional but very useful.
              </p>

              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Pages to review</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Open what applies, then tick what you checked.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {pagesToReview.map((page) => (
                    <div key={page.value} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                      <Controller
                        control={control}
                        name="reviewedPages"
                        render={({ field }) => {
                          const selected = field.value ?? [];
                          const isChecked = selected.includes(page.value);

                          return (
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  field.onChange(
                                    checked
                                      ? [...selected, page.value]
                                      : selected.filter((value) => value !== page.value),
                                  );
                                }}
                              />
                              <span className="truncate">{page.label}</span>
                            </label>
                          );
                        }}
                      />
                      <Link href={page.href} className="text-sm font-semibold text-green-600 hover:underline dark:text-green-400">
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/80">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Required progress</p>
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    {answeredRequiredCount}/{requiredQuestionCount}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all duration-300"
                    style={{ width: `${(answeredRequiredCount / requiredQuestionCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:p-10 dark:border-slate-700/80 dark:bg-slate-900/80">
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="py-12 text-center"
                  >
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">
                      Feedback Received
                    </h2>
                    <p className="mx-auto max-w-sm text-slate-600 dark:text-slate-400">
                      Thank you for helping us tighten the onboarding experience before launch.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-8 border-slate-200 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                      onClick={() => setIsSuccess(false)}
                    >
                      Submit another response
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="mb-10">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Beta onboarding survey
                      </h2>
                      <p className="mt-2 text-slate-600 dark:text-slate-400">
                        Share what worked, what slowed you down, and what needs fixing.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                      <input type="text" className="sr-only" tabIndex={-1} {...register("honeypot")} />

                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">
                            Full Name
                          </Label>
                          <div className="relative">
                            <Input
                              id="name"
                              placeholder="Your name"
                              {...register("name")}
                              className="h-14 border-slate-200 bg-white pr-12 text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500"
                            />
                            <User className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          </div>
                          <FieldError message={errors.name?.message} />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                            Email Address
                          </Label>
                          <div className="relative">
                            <Input
                              id="email"
                              type="email"
                              placeholder="you@company.com"
                              {...register("email")}
                              className="h-14 border-slate-200 bg-white pr-12 text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500"
                            />
                            <Mail className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          </div>
                          <FieldError message={errors.email?.message} />
                        </div>
                      </div>

                      <div className="space-y-5">
                        {questions.map((question, index) => {
                          const error = errors.answers?.[question.key];

                          if (question.choices) {
                            return (
                              <div key={question.key} className="rounded-3xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-950/30">
                                <div className="mb-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <Label className="text-base font-bold leading-snug text-slate-900 dark:text-white">
                                      {index + 1}. {question.title}
                                    </Label>
                                    {question.required && (
                                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                        Required
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{question.help}</p>
                                </div>

                                <Controller
                                  control={control}
                                  name={`answers.${question.key}`}
                                  render={({ field }) => (
                                    <RadioGroup
                                      value={typeof field.value === "string" ? field.value : ""}
                                      onValueChange={field.onChange}
                                      className="grid gap-3 sm:grid-cols-2"
                                    >
                                      {question.choices?.map((choice) => (
                                        <label
                                          key={choice.value}
                                          className={cn(
                                            "flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:border-green-300 hover:bg-green-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-green-800 dark:hover:bg-green-900/10",
                                            field.value === choice.value && "border-green-500 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400",
                                          )}
                                        >
                                          <RadioGroupItem value={choice.value} />
                                          <span>{choice.label}</span>
                                        </label>
                                      ))}
                                    </RadioGroup>
                                  )}
                                />
                                <FieldError message={"message" in (error ?? {}) ? String(error?.message) : undefined} />
                              </div>
                            );
                          }

                          if (question.key === "q14" || question.key === "q15") {
                            return (
                              <div key={question.key} className="rounded-3xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-950/30">
                                <div className="mb-4">
                                  <Label className="text-base font-bold leading-snug text-slate-900 dark:text-white">
                                    {index + 1}. {question.title}
                                  </Label>
                                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{question.help}</p>
                                </div>
                                <Textarea
                                  rows={4}
                                  placeholder={question.key === "q14" ? "What helped you move through the flow?" : "What should we fix, simplify, or explain better?"}
                                  {...register(`answers.${question.key}`)}
                                  className="min-h-28 resize-none border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500"
                                />
                              </div>
                            );
                          }

                          const booleanName =
                            question.key === "q4"
                              ? "answers.q4.encountered"
                              : question.key === "q6"
                                ? "answers.q6.confusing"
                                : question.key === "q10"
                                  ? "answers.q10.issue"
                                  : "answers.q12.encountered";
                          const detailsName =
                            question.key === "q4"
                              ? "answers.q4.step"
                              : question.key === "q6"
                                ? "answers.q6.details"
                                : question.key === "q10"
                                  ? "answers.q10.details"
                                  : "answers.q12.details";
                          const selected =
                            question.key === "q4"
                              ? watchedAnswers?.q4?.encountered
                              : question.key === "q6"
                                ? watchedAnswers?.q6?.confusing
                                : question.key === "q10"
                                  ? watchedAnswers?.q10?.issue
                                  : watchedAnswers?.q12?.encountered;

                          return (
                            <div key={question.key} className="rounded-3xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-950/30">
                              <div className="mb-4">
                                <div className="flex items-start justify-between gap-4">
                                  <Label className="text-base font-bold leading-snug text-slate-900 dark:text-white">
                                    {index + 1}. {question.title}
                                  </Label>
                                  {question.required && (
                                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                      Required
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{question.help}</p>
                              </div>

                              <Controller
                                control={control}
                                name={booleanName}
                                render={({ field }) => (
                                  <RadioGroup
                                    value={field.value ? "yes" : "no"}
                                    onValueChange={(value) => field.onChange(value === "yes")}
                                    className="grid gap-3 sm:grid-cols-2"
                                  >
                                    {[
                                      { value: "no", label: "No" },
                                      { value: "yes", label: "Yes" },
                                    ].map((choice) => (
                                      <label
                                        key={choice.value}
                                        className={cn(
                                          "flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:border-green-300 hover:bg-green-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-green-800 dark:hover:bg-green-900/10",
                                          (field.value ? "yes" : "no") === choice.value && "border-green-500 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400",
                                        )}
                                      >
                                        <RadioGroupItem value={choice.value} />
                                        <span>{choice.label}</span>
                                      </label>
                                    ))}
                                  </RadioGroup>
                                )}
                              />

                              {selected && (
                                <Textarea
                                  rows={3}
                                  placeholder={question.key === "q4" ? "Which step or page section?" : "Tell us what happened."}
                                  {...register(detailsName)}
                                  className="mt-4 min-h-24 resize-none border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-600/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-14 w-full bg-linear-to-r from-green-600 to-green-500 text-lg font-bold text-white shadow-lg shadow-green-600/25 transition-all duration-200 hover:from-green-700 hover:to-green-600"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Submitting...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Send className="h-5 w-5" />
                            Submit Feedback
                          </span>
                        )}
                      </Button>

                      <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
                        <span>{reviewedPages.length} page{reviewedPages.length === 1 ? "" : "s"} marked reviewed</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span>{requiredQuestionCount} required questions</span>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
