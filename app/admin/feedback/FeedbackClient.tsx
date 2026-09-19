"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";

type SurveyType = "onboarding" | "disbursement";
type AnswerValue =
  | string
  | boolean
  | null
  | {
      encountered?: boolean;
      confusing?: boolean;
      issue?: boolean;
      value?: boolean;
      step?: string;
      details?: string;
    };

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
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatAnswer = (value: AnswerValue) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return labelFor(value);
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, item]) => item !== "" && item !== null && item !== undefined)
      .map(([key, item]) => `${labelFor(key)}: ${typeof item === "boolean" ? (item ? "Yes" : "No") : item}`)
      .join(" · ");
  }
  return "Not provided";
};

const surveyLabel = (survey: SurveyType) => (survey === "onboarding" ? "Onboarding" : "Disbursement");

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
      const data = (await response.json()) as FeedbackResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load feedback");
      setFeedback(data.feedback ?? []);
      setMeta(data.meta ?? { total: 0, onboarding: 0, disbursement: 0 });
      setSelected((current) =>
        current ? data.feedback.find((entry) => entry.id === current.id && entry.survey === current.survey) ?? null : null,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchFeedback(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchFeedback]);

  useRealtimeRefresh(
    [{ table: "onboarding_feedback" }, { table: "beta_disbursement_feedback" }],
    () => { void fetchFeedback(); },
  );

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
            Beta research workspace
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Survey Responses</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Compare tester participation at a glance, then open a response when you need the full context.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void fetchFeedback()}
          disabled={loading}
          className="h-11 rounded-xl border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/60"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh responses
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="All responses" value={meta.total} icon={Inbox} />
        <Metric label="Onboarding" value={meta.onboarding} icon={UserRound} accent="blue" />
        <Metric label="Disbursement" value={meta.disbursement} icon={FileText} accent="green" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 p-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Participants</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {filteredFeedback.length} of {feedback.length} submissions shown
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name or email..."
                className="h-10 rounded-xl border-slate-200 bg-white pl-10 dark:border-slate-700 dark:bg-slate-800/70"
              />
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(["all", "onboarding", "disbursement"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSurveyFilter(filter)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-semibold capitalize text-slate-500 dark:text-slate-400",
                    surveyFilter === filter && "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white",
                  )}
                >
                  {filter === "all" ? "All" : surveyLabel(filter)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredFeedback.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <Inbox className="mb-4 h-9 w-9 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">No responses found</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try a different search or survey filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-400 dark:bg-slate-950/30">
                <tr>
                  <th className="px-5 py-3 font-bold">Participant</th>
                  <th className="px-5 py-3 font-bold">Survey</th>
                  <th className="px-5 py-3 font-bold">Pages reviewed</th>
                  <th className="px-5 py-3 font-bold">Submitted</th>
                  <th className="px-5 py-3 text-right font-bold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {filteredFeedback.map((entry) => {
                  const isSelected = selected?.id === entry.id && selected.survey === entry.survey;
                  return (
                    <tr
                      key={`${entry.survey}-${entry.id}`}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40",
                        isSelected && "bg-emerald-50/60 dark:bg-emerald-500/5",
                      )}
                      onClick={() => setSelected(entry)}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{entry.tester_name || "Unnamed tester"}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Mail className="h-3 w-3" />
                          {entry.tester_email || "No email provided"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", entry.survey === "onboarding" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300")}>
                          {surveyLabel(entry.survey)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{entry.reviewed_pages?.length ?? 0} pages</td>
                      <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">{formatDateTime(entry.submitted_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")}>
                          View <ChevronDown className={cn("h-4 w-4 transition-transform", isSelected && "rotate-180")} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
          <div className="flex flex-col gap-4 border-b border-slate-200/70 p-5 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", selected.survey === "onboarding" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300")}>
                  {surveyLabel(selected.survey)} survey
                </span>
                <span className="text-xs text-slate-400">Response details</span>
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{selected.tester_name || "Unnamed tester"}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{selected.tester_email || "No email provided"}</span>
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDateTime(selected.submitted_at)}</span>
              </div>
            </div>
            <Button type="button" variant="ghost" onClick={() => setSelected(null)} className="h-9 self-start rounded-lg text-slate-500">
              <X className="mr-1.5 h-4 w-4" />
              Close details
            </Button>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pages reviewed</h3>
              <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
                {(selected.reviewed_pages ?? []).length > 0 ? selected.reviewed_pages?.map((page) => (
                  <span key={page} className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">{page}</span>
                )) : <span className="text-sm text-slate-500">None recorded</span>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(selected.answers ?? {}).map(([key, value], index) => (
                <div key={key} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Question {index + 1} · {key.toUpperCase()}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-200">{formatAnswer(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  accent = "slate",
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  accent?: "slate" | "blue" | "green";
}) {
  const accents = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
    green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", accents[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
