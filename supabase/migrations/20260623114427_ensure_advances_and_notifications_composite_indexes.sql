
CREATE INDEX IF NOT EXISTS idx_advances_status_created 
  ON advances (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON notifications (user_id, created_at DESC);

