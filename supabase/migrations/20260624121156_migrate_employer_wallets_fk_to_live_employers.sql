
-- ============================================================
-- Step 1: Add new column to hold the live employer FK
-- ============================================================
ALTER TABLE employer_wallets
  ADD COLUMN live_employer_id uuid;

-- ============================================================
-- Step 2: Backfill via the onboarding_id bridge
-- ============================================================
UPDATE employer_wallets ew
SET live_employer_id = e.id
FROM employers e
WHERE e.onboarding_id = ew.employer_id;

-- ============================================================
-- Step 3: Safety check — abort if any wallet has no live employer
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM employer_wallets WHERE live_employer_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration aborted: employer_wallets rows with no matching live employer. Fix employer records first.';
  END IF;
END $$;

-- ============================================================
-- Step 4: Drop all dependent policies before touching the column
-- ============================================================
DROP POLICY IF EXISTS "employer_view_own_wallet" ON employer_wallets;
DROP POLICY IF EXISTS "employer_view_own_wallet_tx" ON wallet_transactions;

-- ============================================================
-- Step 5: Drop old FK and UNIQUE constraint
-- ============================================================
ALTER TABLE employer_wallets
  DROP CONSTRAINT employer_wallets_employer_id_fkey,
  DROP CONSTRAINT employer_wallets_employer_id_key;

-- ============================================================
-- Step 6: Drop old column, rename new column into its place
-- ============================================================
ALTER TABLE employer_wallets DROP COLUMN employer_id;
ALTER TABLE employer_wallets RENAME COLUMN live_employer_id TO employer_id;

-- ============================================================
-- Step 7: Add NOT NULL, UNIQUE, and FK to live employers
-- ============================================================
ALTER TABLE employer_wallets
  ALTER COLUMN employer_id SET NOT NULL;

ALTER TABLE employer_wallets
  ADD CONSTRAINT employer_wallets_employer_id_key UNIQUE (employer_id);

ALTER TABLE employer_wallets
  ADD CONSTRAINT employer_wallets_employer_id_fkey
    FOREIGN KEY (employer_id) REFERENCES employers(id) ON DELETE CASCADE;

-- ============================================================
-- Step 8: Rebuild employer_wallets RLS — direct join, no bridge
-- ============================================================
CREATE POLICY "employer_view_own_wallet"
  ON employer_wallets
  FOR SELECT
  TO authenticated
  USING (
    employer_id IN (
      SELECT id FROM employers WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- Step 9: Rebuild wallet_transactions RLS — clean direct join
-- ============================================================
CREATE POLICY "employer_view_own_wallet_tx"
  ON wallet_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM employer_wallets ew
      JOIN employers e ON e.id = ew.employer_id
      WHERE ew.id = wallet_transactions.wallet_id
        AND e.user_id = auth.uid()
    )
  );

