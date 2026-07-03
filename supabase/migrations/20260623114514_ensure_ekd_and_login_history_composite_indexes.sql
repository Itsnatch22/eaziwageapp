
CREATE INDEX IF NOT EXISTS idx_ekd_user_status 
  ON employee_kyc_documents (user_id, status);

CREATE INDEX IF NOT EXISTS idx_login_history_user_time 
  ON login_history (user_id, logged_in_at DESC);

