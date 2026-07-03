
-- JSONB entry migrated to payment_methods table — column is now safe to drop
ALTER TABLE profiles
  DROP COLUMN IF EXISTS payment_methods;

