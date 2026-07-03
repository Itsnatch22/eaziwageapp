import { consoleQuery } from './db';

// Every function here queries only green-tier tables or yellow-tier aggregate
// views — never a red-tier table. See supabase migrations for the grants that
// make this the actual enforced boundary, not just a convention followed here.

export async function getSystemHealth() {
  const [apiHealth, recentErrors, incidents] = await Promise.all([
    consoleQuery(`
      SELECT name, provider, status, latency_ms, uptime_percent, transactions_today, syncs_today, last_check
      FROM api_health
      ORDER BY last_check DESC NULLS LAST
    `),
    consoleQuery(`
      SELECT message, digest, url, role, resolved, count(*) AS occurrences, max(created_at) AS last_seen
      FROM error_logs
      WHERE created_at >= now() - interval '7 days'
      GROUP BY message, digest, url, role, resolved
      ORDER BY occurrences DESC, last_seen DESC
      LIMIT 25
    `),
    consoleQuery(`
      SELECT date, status, affected_services, note
      FROM incident_log
      ORDER BY date DESC
      LIMIT 10
    `),
  ]);
  return { apiHealth, recentErrors, incidents };
}

export async function getSecuritySummary() {
  const [logins, failedLogins, devices, fraud, fraudRules] = await Promise.all([
    consoleQuery(`SELECT * FROM v_console_login_summary LIMIT 60`),
    consoleQuery(`SELECT * FROM v_console_failed_login_summary LIMIT 60`),
    consoleQuery(`SELECT * FROM v_console_trusted_devices_summary`),
    consoleQuery(`SELECT * FROM v_console_fraud_summary ORDER BY day DESC LIMIT 100`),
    consoleQuery(`SELECT * FROM v_console_fraud_rules_summary`),
  ]);
  return { logins, failedLogins, devices, fraud, fraudRules };
}

export async function getPaymentRailHealth() {
  const [dusupay, wallets, walletTx, payroll, payoutProviders] = await Promise.all([
    consoleQuery(`SELECT * FROM v_console_dusupay_summary ORDER BY day DESC LIMIT 100`),
    consoleQuery(`SELECT * FROM v_console_wallet_summary`),
    consoleQuery(`SELECT * FROM v_console_wallet_tx_summary ORDER BY day DESC LIMIT 100`),
    consoleQuery(`
      SELECT provider, status, last_sync_status, count(*) AS integration_count, max(last_sync_at) AS most_recent_sync
      FROM v_console_payroll_integrations
      GROUP BY provider, status, last_sync_status
    `),
    consoleQuery(`SELECT country_code, provider_name, method_type, enabled FROM payout_providers ORDER BY country_code`),
  ]);
  return { dusupay, wallets, walletTx, payroll, payoutProviders };
}

export async function getSupportSummary() {
  const [tickets, wiza, notifications] = await Promise.all([
    consoleQuery(`
      SELECT category, status, count(*) AS ticket_count, max(created_at) AS most_recent
      FROM support_tickets
      GROUP BY category, status
      ORDER BY ticket_count DESC
    `),
    consoleQuery(`SELECT * FROM v_console_wiza_summary ORDER BY day DESC LIMIT 60`),
    consoleQuery(`SELECT * FROM v_console_notifications_summary ORDER BY day DESC LIMIT 100`),
  ]);
  return { tickets, wiza, notifications };
}

export async function getAuditSummary() {
  return consoleQuery(`SELECT * FROM v_console_audit_summary ORDER BY day DESC LIMIT 100`);
}

export async function getConsoleContext() {
  const [health, security, payments, support, audit] = await Promise.all([
    getSystemHealth(),
    getSecuritySummary(),
    getPaymentRailHealth(),
    getSupportSummary(),
    getAuditSummary(),
  ]);
  return { health, security, payments, support, audit, generatedAt: new Date().toISOString() };
}
