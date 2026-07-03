
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text,
  digest text,
  stack text,
  url text,
  role text CHECK (role IN ('admin', 'employer', 'employee', 'public')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

-- Admin can see all errors
CREATE POLICY "Admins can read error_logs"
  ON error_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Service role inserts only — anon cannot write
REVOKE INSERT ON error_logs FROM anon;
REVOKE INSERT ON error_logs FROM authenticated;

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Indexes for admin dashboard queries
CREATE INDEX idx_error_logs_created_at
  ON error_logs(created_at DESC);

CREATE INDEX idx_error_logs_role_created
  ON error_logs(role, created_at DESC);

CREATE INDEX idx_error_logs_unresolved
  ON error_logs(resolved, created_at DESC)
  WHERE resolved = false;

