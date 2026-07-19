-- Enables Postgres Changes (Supabase Realtime) on system_audit_logs so the
-- admin layout's actor-visibility toast (components/admin/AdminLayout.tsx)
-- can broadcast "X approved/rejected an employee/employer" to other admins
-- in real time, reusing the audit trail these routes already write instead
-- of adding a second notification write path. RLS is unaffected — the
-- existing admin_all_audit_logs policy already grants admins SELECT, which
-- Realtime respects.
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_audit_logs;
