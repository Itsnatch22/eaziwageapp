
-- Add delivery tracking columns to notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed', 'fallback_email')),
  ADD COLUMN IF NOT EXISTS delivery_channel text
    CHECK (delivery_channel IN ('push', 'email', 'in_app')),
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- Index for admin dashboard — failed/pending lookups
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status
  ON notifications(delivery_status, created_at DESC)
  WHERE delivery_status IN ('failed', 'pending');

-- Index for per-user delivery history
CREATE INDEX IF NOT EXISTS idx_notifications_user_delivery
  ON notifications(user_id, delivery_status);

