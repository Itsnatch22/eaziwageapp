import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';

const env = getEnv();
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface FraudCheckResult {
  isBlocked: boolean;
  alerts: Array<Record<string, unknown>>;
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
    // 1. Fetch enabled rules
    const { data: rules } = await supabaseAdmin
      .from('fraud_rules')
      .select('*')
      .eq('enabled', true);

    if (!rules) return { isBlocked: false, alerts: [] };

    // 2. Fetch context data (recent history)
    const { data: recentAdvances } = await supabaseAdmin
      .from('advances')
      .select('amount, created_at, status')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(10);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 3. Process Rules
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
        // Create Alert
        const { data: alert } = await supabaseAdmin
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

        // Increment trigger count
        await supabaseAdmin.rpc('increment_rule_trigger', { rule_id: rule.id });

        if (alert) alerts.push(alert);
        if (rule.action === 'block') isBlocked = true;
      }
    }

    return { isBlocked, alerts };

  } catch (error) {
    console.error('[FraudEngine] Error running checks:', error);
    return { isBlocked: false, alerts: [] }; // Fail open for now, or change to fail closed
  }
}
