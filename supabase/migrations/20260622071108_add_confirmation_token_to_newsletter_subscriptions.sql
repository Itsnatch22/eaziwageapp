ALTER TABLE newsletter_subscriptions 
ADD COLUMN IF NOT EXISTS confirmation_token text UNIQUE,
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone;
