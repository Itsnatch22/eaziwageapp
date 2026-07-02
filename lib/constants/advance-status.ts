/**
 * advances.status has two disbursement code paths that both count as "money
 * actually moved": the automated flow in lib/services/payout-service.ts sets
 * 'completed', while the manual admin action route
 * (app/api/admin/advances/[id]/[action]/route.ts) sets 'disbursed'. 'repaid'
 * is the terminal state after full repayment. A query filtering by only one
 * or two of these silently undercounts revenue/disbursement stats — this
 * happened independently in /api/admin/billing, /api/admin/dashboard,
 * /api/admin/reconciliation, and others. Always use these constants instead
 * of inlining the status list.
 */

// Money has been disbursed at some point (still outstanding or already repaid).
export const DISBURSED_STATUSES = ['disbursed', 'completed', 'repaid'] as const;

// Money is disbursed and not yet repaid — still counts against the employee's
// limit / the employer's outstanding liability.
export const OUTSTANDING_STATUSES = ['disbursed', 'completed'] as const;
