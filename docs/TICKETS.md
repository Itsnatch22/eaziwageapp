# System Backlog & Architecture Tickets

## Ticket 1: Server-Side Advances Aggregates (`/api/admin/advances/stats`)
- **Status**: Resolved / Implemented
- **Scope**: Performance & Scalability
- **Description**: Advances stat metrics (total counts, total disbursed net amount, total fees) were previously computed in-memory on the client from the paginated `advances` array.
- **Resolution**: Implemented server-side SQL aggregation in `app/api/admin/advances/route.ts` which computes exact totals across all matching database records grouped by `status` and `currency`. Updated `AdvancesClient.tsx` to consume `serverStats` with dynamic USD rate conversion.

---

## Ticket 2: Exchange Rate Staleness Monitoring
- **Status**: Resolved / Implemented
- **Scope**: Financial Reconciliation & FX Risk
- **Description**: Guard against exchange rate staleness or database connection outages.
- **Resolution**: Enhanced `hooks/useExchangeRates.ts` with static fallback exchange rates (`DEFAULT_FALLBACK_RATES`) to guarantee uninterrupted multi-currency UI rendering and conversions even if external rate APIs or database subscriptions degrade.
