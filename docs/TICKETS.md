# System Backlog & Architecture Tickets

## Ticket 1: Server-Side Advances Aggregates (`/api/admin/advances/stats`)
- **Status**: Open / Backlog
- **Scope**: Performance & Scalability
- **Description**: Currently, `AdvancesClient.tsx` calculates stat metrics (total counts, total disbursed net amount, total fees) in-memory on the client from the fetched `advances` array.
- **Issue**: Once the total number of advances exceeds a single pagination page (`limit: 50`), client-side array aggregation will only reflect the current page rather than global database metrics.
- **Proposed Solution**:
  1. Create a dedicated endpoint: `GET /api/admin/advances/stats` (or append `stats` object to GET `/api/admin/advances`).
  2. Perform SQL aggregation on Supabase:
     ```sql
     SELECT 
       status, 
       COUNT(*) as count, 
       SUM(net_amount) as total_net, 
       SUM(fee_amount) as total_fees 
     FROM advances 
     GROUP BY status;
     ```
  3. Update `AdvancesClient.tsx` to consume server-side stats instead of deriving from paginated rows.

---

## Ticket 2: Exchange Rate Staleness Monitoring
- **Status**: Open / Backlog
- **Scope**: Financial Reconciliation & FX Risk
- **Description**: Advances stat cards and multi-currency conversions rely on exchange rates fetched via `useExchangeRates`.
- **Note**: Ensure exchange rates continue to be refreshed via scheduled sync cron (`.github/workflows/exchange-rates.yml`) with fallbacks to static rate tables if API provider degrades.
