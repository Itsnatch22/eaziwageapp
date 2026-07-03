
CREATE TABLE IF NOT EXISTS incident_log (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  affected_services TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 90-day retention index — queries always filter by date range
CREATE INDEX IF NOT EXISTS idx_incident_log_date ON incident_log (date DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_incident_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_incident_log_updated_at
BEFORE UPDATE ON incident_log
FOR EACH ROW EXECUTE FUNCTION update_incident_log_updated_at();

-- RLS: service role only — this table is never read by end users directly
ALTER TABLE incident_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON incident_log
  USING (auth.role() = 'service_role');

