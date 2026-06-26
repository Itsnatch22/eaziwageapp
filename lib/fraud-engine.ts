import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createLogger } from '@/lib/logger';

const env = getEnv();
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const log = createLogger('fraud-engine');

interface FraudCheckResult {
  isBlocked: boolean;
  alerts: Array<Record<string, unknown>>;
}

// Retries the rules fetch once after 300 ms — cheap insurance against transient network blips.
// Only the rules query is retried; all other queries are best-effort or non-fatal.
async function fetchFraudRules() {
  const query = () =>
    supabaseAdmin.from('fraud_rules').select('*').eq('enabled', true);
  const first = await query();
  if (!first.error) return first;
  await new Promise((r) => setTimeout(r, 300));
  return query();
}

/**
 * Core Fraud Engine
 * Runs detection rules against an advance request
 */
export async function runFraudChecks(params: {
  userId: string;
  employeeId: string;
  employerId: string;
  amount: number;
}): Promise<FraudCheckResult> {
  const { employeeId, employerId, amount } = params;
  const alerts: Array<Record<string, unknown>> = [];
  let isBlocked = false;

  try {

    const { data: rules, error: rulesError } = await fetchFraudRules();

    if (rulesError) {
      log.error('Cannot load rules (after retry) — failing closed', { err: rulesError.message, employeeId, employerId });
      throw Object.assign(new Error('Fraud engine unavailable'), { code: 'FRAUD_ENGINE_UNAVAILABLE' });
    }

    if (!rules || rules.length === 0) return { isBlocked: false, alerts: [] };


    const { data: recentAdvances } = await supabaseAdmin
      .from('advances')
      .select('amount, created_at, status')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(10);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);


    for (const rule of rules) {
      let triggered = false;
      let reason = '';

      switch (rule.rule_type) {
        case 'amount_threshold':
          if (amount > rule.threshold_value) {
            triggered = true;
            reason = `Requested amount ${amount} exceeds threshold of ${rule.threshold_value}`;
          }
          break;

        case 'frequency':
          const recentCount = (recentAdvances || []).filter(a => 
            new Date(a.created_at) > sevenDaysAgo && a.status !== 'rejected'
          ).length;
          if (recentCount >= rule.threshold_value) {
            triggered = true;
            reason = `User has ${recentCount} requests in 7 days (Limit: ${rule.threshold_value})`;
          }
          break;

        case 'velocity':
          const hourCount = (recentAdvances || []).filter(a => 
            new Date(a.created_at) > oneHourAgo
          ).length;
          if (hourCount >= rule.threshold_value) {
            triggered = true;
            reason = `Rapid withdrawal attempts: ${hourCount} in last hour`;
          }
          break;
      }

      if (triggered) {

        const { data: alert, error: alertError } = await supabaseAdmin
          .from('fraud_alerts')
          .insert({
            rule_id: rule.id,
            title: rule.name,
            description: reason,
            severity: rule.severity,
            employee_id: employeeId,
            employer_id: employerId,
            metadata: {
              requested_amount: amount,
              threshold: rule.threshold_value,
              rule_type: rule.rule_type
            }
          })
          .select()
          .single();

        if (alertError) {
          log.error('Alert insert failed — flagging advance for manual review', { err: alertError.message, rule_id: rule.id, employeeId, employerId });
          alerts.push({
            rule_id: rule.id,
            severity: rule.severity,
            description: reason,
            _unlogged: true // caller should check this and route to manual_review
          });
        } else if (alert) {
          alerts.push(alert);
        }

        try {
          await supabaseAdmin.rpc('increment_rule_trigger', { rule_id: rule.id });
        } catch {
          // Non-critical counter — never gate on this
        }

        if (rule.action === 'block') isBlocked = true;
      }
    }

    return { isBlocked, alerts };

  } catch (error) {
    log.error('Unexpected error — failing closed', { err: error, employeeId, employerId });
    throw error; // Let the caller decide — never silently approve
  }
}
