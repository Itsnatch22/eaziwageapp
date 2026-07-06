-- app/api/employee-dashboard/request-advance/route.ts's "already have a pending
-- advance" check was a plain SELECT followed by a later INSERT — a classic
-- check-then-insert race. Two near-simultaneous requests (double-click, retry
-- from a flaky connection) could both pass the check before either insert
-- committed, producing two pending advances for the same employee. A partial
-- unique index makes the DB itself the enforcement point — the second insert
-- now fails with a 23505 unique_violation, which the route catches and turns
-- into a clean 409 instead of a duplicate row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_advances_one_pending_per_employee
ON public.advances (employee_id)
WHERE status = 'pending';
