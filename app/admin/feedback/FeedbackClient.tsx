"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";

type SurveyType = "onboarding" | "disbursement";
type AnswerValue = string | boolean | null | { encountered?: boolean; confusing?: boolean; issue?: boolean; value?: boolean; step?: string; details?: string };

interface FeedbackEntry {
  id: string;
  user_id: string | null;
  tester_name: string | null;
  tester_email: string | null;
  reviewed_pages: string[] | null;
  answers: Record<string, AnswerValue>;
  submitted_at: string;
  survey: SurveyType;
}

interface FeedbackResponse {
  feedback: FeedbackEntry[];
  meta: { total: number; onboarding: number; disbursement: number };
}

const labelFor = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatAnswer = (value: AnswerValue) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return labelFor(value);
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined);
    return entries.map(([key, item]) => `${labelFor(key)}: ${typeof item === "boolean" ? (item ? "Yes" : "No") : item}`).join(" · ");
  }
  return "Not provided";
};

const surveyLabel = (survey: SurveyType) => survey === "onboarding" ? "Onboarding" : "Disbursement";

export default function FeedbackClient() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [meta, setMeta] = useState<FeedbackResponse["meta"]>({ total: 0, onboarding: 0, disbursement: 0 });
  const [selected, setSelected] = useState<FeedbackEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [surveyFilter, setSurveyFilter] = useState<"all" | SurveyType>("all");
  const [loading, setLoading] = useState(true);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/feedback", { cache: "no-store" });
      const data = await response.json() as FeedbackResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load feedback");
      setFeedback(data.feedback ?? []);
      setMeta(data.meta ?? { total: 0, onboarding: 0, disbursement: 0 });
      setSelected((current) => current ? data.feedback.find((entry) => entry.id === current.id && entry.survey === current.survey) ?? null : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchFeedback();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchFeedback]);

  const filteredFeedback = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return feedback.filter((entry) => {
      if (surveyFilter !== "all" && entry.survey !== surveyFilter) return false;
      if (!query) return true;
      return `${entry.tester_name ?? ""} ${entry.tester_email ?? ""} ${entry.survey}`.toLowerCase().includes(query);
    });
  }, [feedback, searchTerm, surveyFilter]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Beta feedback
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Survey Responses</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review who completed the beta surveys and inspect every response.</p>
        </div>
        <Button variant="outline" onClick={() => void fetchFeedback()} disabled={loading} className="h-11 rounded-xl border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/60">
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total responses" value={meta.total} icon={Inbox} />
        <Metric label="Onboarding surveys" value={meta.onboarding} icon={UserRound} accent="blue" />
        <Metric label="Disbursement surveys" value={meta.disbursement} icon={FileText} accent="green" />
      </div>

      <div className="grid min-h-[640px] gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
          <div className="border-b border-slate-200/70 p-4 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search name or email..." className="h-11 rounded-xl border-slate-200 bg-white pl-10 dark:border-slate-700 dark:bg-slate-800/70" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(["all", "onboarding", "disbursement"] as const).map((filter) => (
                <button key={filter} type="button" onClick={() => setSurveyFilter(filter)} className={cn("h-9 rounded-lg text-xs font-semibold capitalize text-slate-500 dark:text-slate-400", surveyFilter === filter && "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white")}>
                  {filter === "all" ? "All" : surveyLabel(filter)}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : filteredFeedback.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <Inbox className="mb-4 h-8 w-8 text-slate-400" />
                <h3 className="font-semibold text-slate-900 dark:text-white">No responses found</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try a different search or survey filter.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFeedback.map((entry) => (
                  <button key={`${entry.survey}-${entry.id}`} type="button" onClick={() => setSelected(entry)} className={cn("w-full rounded-xl border p-4 text-left transition-all", selected?.id === entry.id && selected.survey === entry.survey ? "border-slate-900 bg-slate-900 text-white shadow-md dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{entry.tester_name || "Unnamed tester"}</p>
                        <p className={cn("mt-1 truncate text-xs", selected?.id === entry.id && selected.survey === entry.survey ? "text-white/70 dark:text-slate-600" : "text-slate-500 dark:text-slate-400")}>{entry.tester_email || "No email provided"}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider", entry.survey === "onboarding" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300")}>{surveyLabel(entry.survey)}</span>
                    </div>
                    <p className={cn("mt-3 text-[11px]", selected?.id === entry.id && selected.survey === entry.survey ? "text-white/60 dark:text-slate-500" : "text-slate-400")}>{formatDateTime(entry.submitted_at)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
          {!selected ? (
            <div className="flex min-h-[640px] items-center justify-center p-6 text-center">
              <div><ClipboardCheck className="mx-auto mb-4 h-10 w-10 text-slate-400" /><h2 className="font-semibold text-slate-900 dark:text-white">Select a response</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose a survey submission to inspect the answers.</p></div>
            </div>
          ) : (
            <div className="flex min-h-[640px] flex-col">
              <div className="border-b border-slate-200/70 p-5 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", selected.survey === "onboarding" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300")}>{surveyLabel(selected.survey)} survey</span>
                    <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{selected.tester_name || "Unnamed tester"}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{selected.tester_email || "No email provided"}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDateTime(selected.submitted_at)}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{selected.reviewed_pages?.length ?? 0} pages reviewed</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pages reviewed</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selected.reviewed_pages ?? []).length > 0 ? selected.reviewed_pages?.map((page) => <span key={page} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">{page}</span>) : <span className="text-sm text-slate-500">None recorded</span>}
                  </div>
                </div>
                <div className="space-y-3">
                  {Object.entries(selected.answers ?? {}).map(([key, value], index) => (
                    <div key={key} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Question {index + 1} · {key.toUpperCase()}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-200">{formatAnswer(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent = "slate" }: { label: string; value: number; icon: ComponentType<{ className?: string }>; accent?: "slate" | "blue" | "green" }) {
  const accents = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
    green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
      <div className="flex items-center justify-between"><div><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p></div><div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", accents[accent])}><Icon className="h-5 w-5" /></div></div>
    </div>
  );
}
