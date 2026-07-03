
-- rls_auto_enable() is an event trigger function.
-- It has no valid RPC use case — it only functions when invoked by the DB event trigger engine.
-- authenticated has an explicit EXECUTE grant that must be removed.
-- postgres and service_role retain access for internal/migration tooling.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

