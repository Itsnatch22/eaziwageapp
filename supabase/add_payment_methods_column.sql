-- Migration: Add payment_methods column to profiles table
-- This adds support for storing employee payment methods (mobile money, bank accounts)

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS payment_methods JSONB NULL DEFAULT '[]'::jsonb;

-- Add index for better performance on payment methods queries
CREATE INDEX IF NOT EXISTS idx_profiles_payment_methods ON public.profiles USING GIN (payment_methods);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.payment_methods IS 'Array of payment methods for the user (mobile money, bank transfers, etc.)';

-- Example payment method structure:
-- [
--   {
--     "id": "abc123def",
--     "type": "MOBILE_MONEY",
--     "provider": "mtn",
--     "account_number": "+256712345678",
--     "account_name": "John Doe",
--     "is_primary": true,
--     "created_at": "2024-01-01T00:00:00Z"
--   },
--   {
--     "id": "xyz789uvw",
--     "type": "BANK",
--     "bank_name": "Equity Bank",
--     "account_number": "1234567890",
--     "account_name": "John Doe",
--     "bank_code": "63",
--     "is_primary": false,
--     "created_at": "2024-01-02T00:00:00Z"
--   }
-- ]
