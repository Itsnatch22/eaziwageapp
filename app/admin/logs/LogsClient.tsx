'use client';

import React, { useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock, Search, ChevronDown, ChevronUp,
  ArrowLeft, Shield, Users, Activity, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ErrorLog {
  id: string;
  message: string | null;
  digest: string | null;
  stack: string | null;
  url: string | null;
  role: string | null;
  user_id: string | null;
  resolved: boolean;
  created_at: string;
}

interface Stats {
  total: number;
  unresolved: number;
  last24h: number;
  mostAffectedRole: string;
}

interface Props {
  initialLogs: ErrorLog[];
  stats: Stats;
}

const ROLE_COLORS: Record<string, string> = {
  admin:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  employer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  employee: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  public:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatCard({
  label, value, icon: Icon, accent,
}: { label: string; value: string | number; icon: React.ElementType; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', accent)}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default function LogsClient({ initialLogs, stats }: Props) {
  const [logs, setLogs]               = useState<ErrorLog[]>(initialLogs);
  const [filterRole, setFilterRole]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]           = useState('');
  const [expandedStack, setExpandedStack] = useState<string | null>(null);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition]  = useTransition();

  const fetchFiltered = useCallback(
    async (role: string, status: string, q: string) => {
      const params = new URLSearchParams();
      if (role !== 'all') params.set('role', role);
      if (status === 'resolved') params.set('resolved', 'true');
      if (status === 'unresolved') params.set('resolved', 'false');
      if (q.trim()) params.set('search', q.trim());

      try {
        const res = await fetch(`/api/admin/logs?${params}`);
        if (!res.ok) return;
        const json = await res.json();
        setLogs(json.logs ?? []);
      } catch {
        toast.error('Failed to fetch logs');
      }
    },
    []
  );

  const handleRoleChange = (val: string) => {
    setFilterRole(val);
    startTransition(() => fetchFiltered(val, filterStatus, search));
  };

  const handleStatusChange = (val: string) => {
    setFilterStatus(val);
    startTransition(() => fetchFiltered(filterRole, val, search));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    startTransition(() => fetchFiltered(filterRole, filterStatus, val));
  };

  const handleResolve = async (id: string) => {
    setResolvingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/logs/${id}/resolve`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      setLogs((prev) =>
        prev.map((l) => (l.id === id ? { ...l, resolved: true } : l))
      );
      toast.success('Marked as resolved');
    } catch {
      toast.error('Failed to resolve — try again');
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleStack = (id: string) =>
    setExpandedStack((prev) => (prev === id ? null : id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
          Error Logs
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Application errors captured across all roles and routes
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Errors"    value={stats.total}           icon={BarChart3}      accent="bg-slate-600" />
        <StatCard label="Unresolved"      value={stats.unresolved}      icon={AlertTriangle}  accent="bg-red-500" />
        <StatCard label="Last 24 hours"   value={stats.last24h}         icon={Clock}          accent="bg-amber-500" />
        <StatCard label="Top Affected"    value={stats.mostAffectedRole || '—'} icon={Activity} accent="bg-purple-600" />
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by URL or message…"
              value={search}
              onChange={handleSearch}
              className="pl-9 h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>
          <Select value={filterRole} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="employer">Employer</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-40 h-9 text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-slate-700 dark:text-slate-300 font-semibold text-lg">No errors logged</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">Your application is running cleanly.</p>
          </div>
        ) : (
          <div className={cn('overflow-x-auto', isPending && 'opacity-60 pointer-events-none')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/40">
                  {['Time', 'Role', 'URL', 'Message', 'Error ID', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          title={new Date(log.created_at).toLocaleString()}
                          className="text-slate-600 dark:text-slate-400 text-xs cursor-default"
                        >
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize',
                            ROLE_COLORS[log.role ?? 'public'] ?? ROLE_COLORS.public
                          )}
                        >
                          {log.role ?? 'public'}
                        </span>
                      </td>

                      {/* URL */}
                      <td className="px-4 py-3 max-w-[160px]">
                        <span
                          className="text-slate-600 dark:text-slate-400 text-xs font-mono truncate block"
                          title={log.url ?? '—'}
                        >
                          {log.url ?? '—'}
                        </span>
                      </td>

                      {/* Message */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <span
                          className="text-slate-700 dark:text-slate-300 text-xs truncate block"
                          title={log.message ?? ''}
                        >
                          {log.message ? log.message.slice(0, 80) : '—'}
                        </span>
                      </td>

                      {/* Error ID */}
                      <td className="px-4 py-3">
                        {log.digest ? (
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 px-2 py-0.5 rounded-full">
                            {log.digest}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {log.resolved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            <AlertTriangle className="w-3 h-3" />
                            Unresolved
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!log.resolved && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolve(log.id)}
                              disabled={resolvingIds.has(log.id)}
                              className="h-7 text-xs border-slate-200 dark:border-slate-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-green-900/20 dark:hover:text-green-300 transition-colors"
                            >
                              {resolvingIds.has(log.id) ? 'Saving…' : 'Mark Resolved'}
                            </Button>
                          )}
                          {log.stack && (
                            <button
                              onClick={() => toggleStack(log.id)}
                              className="inline-flex items-center gap-0.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              {expandedStack === log.id ? (
                                <><ChevronUp className="w-3.5 h-3.5" /> Hide stack</>
                              ) : (
                                <><ChevronDown className="w-3.5 h-3.5" /> View stack</>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Stack trace expansion */}
                    {expandedStack === log.id && log.stack && (
                      <tr>
                        <td colSpan={7} className="px-4 pb-4">
                          <pre className="text-left text-xs font-mono bg-slate-900 dark:bg-slate-950 text-slate-300 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all border border-slate-700/60 mt-1">
                            <span className="text-slate-500">stack:</span>{'\n'}
                            {log.stack}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
