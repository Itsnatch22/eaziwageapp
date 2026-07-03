ALTER TABLE employer_onboarding
  ADD COLUMN payday_day_of_month integer CHECK (payday_day_of_month BETWEEN 1 AND 31),
  ADD COLUMN mobile_money_number text;

ALTER TABLE employers
  ADD COLUMN payday_day_of_month integer CHECK (payday_day_of_month BETWEEN 1 AND 31),
  ADD COLUMN mobile_money_provider text,
  ADD COLUMN mobile_money_number text;

CREATE TABLE payday_recoupments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  payday_date date NOT NULL,
  amount_due numeric NOT NULL CHECK (amount_due >= 0),
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending_response'
    CHECK (status IN ('pending_response', 'confirmed', 'collecting', 'collected', 'failed', 'declined')),
  merchant_reference text UNIQUE,
  internal_reference text,
  failure_reason text,
  responded_at timestamptz,
  collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employer_id, payday_date)
);

CREATE INDEX idx_payday_recoupments_employer_status ON payday_recoupments(employer_id, status);

