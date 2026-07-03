import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Every /console access and every AI query logs here — this table itself is
 * yellow-tier from the console's own point of view (aggregate-visible via
 * v_console_audit_summary, never raw-dumpable through /console) specifically
 * so the audit log doesn't become its own leak vector.
 */
export async function logConsoleAccess(params: {
  adminId: string;
  adminEmail?: string | null;
  action: 'console_view' | 'console_query';
  queryText?: string;
  tablesTouched?: string[];
  summaryReturned?: string;
}): Promise<void> {
  const truncatedSummary = params.summaryReturned && params.summaryReturned.length > 2000
    ? `${params.summaryReturned.slice(0, 2000)}… [truncated]`
    : params.summaryReturned;

  const { error } = await supabaseAdmin.from('system_audit_logs').insert({
    admin_id: params.adminId,
    admin_name: params.adminEmail,
    target_id: params.adminId,
    target_type: 'console',
    action: params.action,
    new_value: {
      query_text: params.queryText ?? null,
      tables_touched: params.tablesTouched ?? null,
      summary_returned: truncatedSummary ?? null,
    },
  });

  if (error) {
    console.error('[console] Failed to write audit log:', error);
  }
}
