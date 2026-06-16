BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number text NOT NULL,
  currency text NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_number)
);

-- Enable RLS
ALTER TABLE public.admin_wallet ENABLE ROW LEVEL SECURITY;

-- SELECT policy: admin users only (profiles.is_admin = true)
DROP POLICY IF EXISTS select_admin_wallet ON public.admin_wallet;
CREATE POLICY select_admin_wallet
  ON public.admin_wallet
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.is_admin = true
    )
  );

-- UPDATE policy: admin users only
DROP POLICY IF EXISTS update_admin_wallet ON public.admin_wallet;
CREATE POLICY update_admin_wallet
  ON public.admin_wallet
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.is_admin = true
    )
  );

-- INSERT policy: allow service_role (server-side sync job) to insert
DROP POLICY IF EXISTS insert_admin_wallet_service_role ON public.admin_wallet;
CREATE POLICY insert_admin_wallet_service_role
  ON public.admin_wallet
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
  );

-- UPDATE by sync job: allow service_role to update
DROP POLICY IF EXISTS update_admin_wallet_service_role ON public.admin_wallet;
CREATE POLICY update_admin_wallet_service_role
  ON public.admin_wallet
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
  );

COMMIT;
