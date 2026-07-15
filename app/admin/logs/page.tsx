import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';
import LogsClient, { type ErrorLog } from './LogsClient';

async function fetchLogsData() {
  const supabase = await createRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect('/admin');

  const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
  if (adminAccess.error || !adminAccess.isAdmin) redirect('/admin');

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [logsResult, statsResult] = await Promise.all([
    supabaseAdmin
      .from('error_logs')
      .select('id, message, digest, stack, url, role, user_id, resolved, created_at')
      .order('resolved', { ascending: true })
      .order('created_at', { ascending: false })
      .range(0, 19),
    supabaseAdmin
      .from('error_logs')
      .select('role, resolved, created_at'),
  ]);

  const logs: ErrorLog[] = logsResult.data ?? [];
  const all = statsResult.data ?? [];

  const total      = all.length;
  const unresolved = all.filter((r) => !r.resolved).length;
  const last24h    = all.filter((r) => r.created_at >= yesterday).length;

  const roleCounts: Record<string, number> = {};
  for (const r of all) {
    const role = r.role ?? 'public';
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
  }
  const mostAffectedRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return { logs, stats: { total, unresolved, last24h, mostAffectedRole } };
}

async function LogsContent() {
  const { logs, stats } = await fetchLogsData();
  return <LogsClient initialLogs={logs} stats={stats} initialTotal={stats.total} />;
}

function LogsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <div>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-4" />
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-2" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-72" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 p-5 h-24" />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 h-16" />
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 h-64" />
    </div>
  );
}

export default function AdminLogsPage() {
  return (
    <Suspense fallback={<LogsLoading />}>
      <LogsContent />
    </Suspense>
  );
}
