-- The entire admin support-ticket UI (app/admin/support/SupportClient.tsx)
-- is built around a 3-state model: open / pending / closed -- stats
-- counters, filters, badges, and a "Pending" action button all reference it.
-- The API route (app/api/support/tickets/[id]/route.ts) already allow-listed
-- 'pending' as a valid status to PATCH. But the DB constraint never included
-- it (only open/in_progress/resolved/closed, where in_progress/resolved are
-- unused dead states -- nothing in the app ever sets them), so every click
-- of "Pending" 500'd with a check constraint violation.

ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_status_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check
  CHECK (status = ANY (ARRAY['open'::text, 'pending'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]));
