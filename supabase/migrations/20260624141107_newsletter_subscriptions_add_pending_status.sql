
-- Drop old constraint, add new one that includes 'pending'
ALTER TABLE newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_status_check;

ALTER TABLE newsletter_subscriptions
  ADD CONSTRAINT newsletter_subscriptions_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'unsubscribed'::text]));

-- Also update default to 'pending' since new signups should await confirmation
ALTER TABLE newsletter_subscriptions
  ALTER COLUMN status SET DEFAULT 'pending';

