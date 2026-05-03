-- Create admin reports table
CREATE TABLE IF NOT EXISTS admin_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('financial', 'operational', 'compliance', 'performance')),
  period TEXT NOT NULL CHECK (period IN ('today', 'day', 'week', 'month', 'quarter', 'year', 'custom')),
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed', 'scheduled')),
  generated_at TIMESTAMPTZ,
  file_size TEXT,
  download_url TEXT,
  scheduled_for TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS admin_reports_type_idx ON admin_reports(type);
CREATE INDEX IF NOT EXISTS admin_reports_status_idx ON admin_reports(status);
CREATE INDEX IF NOT EXISTS admin_reports_period_idx ON admin_reports(period);
CREATE INDEX IF NOT EXISTS admin_reports_created_by_idx ON admin_reports(created_by);
CREATE INDEX IF NOT EXISTS admin_reports_created_at_idx ON admin_reports(created_at);
CREATE INDEX IF NOT EXISTS admin_reports_generated_at_idx ON admin_reports(generated_at);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS admin_reports_status_type_idx ON admin_reports(status, type);

-- Add RLS policies
ALTER TABLE admin_reports ENABLE ROW LEVEL SECURITY;

-- Only admin users can view reports
CREATE POLICY "Admins can view all reports" ON admin_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = admin_reports.created_by 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only admin users can insert reports
CREATE POLICY "Admins can create reports" ON admin_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = admin_reports.created_by 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only admin users can update reports
CREATE POLICY "Admins can update reports" ON admin_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = admin_reports.created_by 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only admin users can delete reports
CREATE POLICY "Admins can delete reports" ON admin_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = admin_reports.created_by 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_reports_updated_at_trigger
  BEFORE UPDATE ON admin_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_reports_updated_at();
