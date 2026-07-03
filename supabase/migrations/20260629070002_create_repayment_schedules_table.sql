
CREATE TABLE IF NOT EXISTS repayment_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core references
  advance_id uuid NOT NULL REFERENCES advances(id) ON DELETE RESTRICT,
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  -- Repayment details
  repayment_amount numeric NOT NULL CHECK (repayment_amount > 0),
  currency text NOT NULL DEFAULT 'KES',
  due_date date NOT NULL,
  payroll_cycle text NOT NULL,

  -- Reference code for Stanbic webhook matching
  repayment_reference text UNIQUE NOT NULL,

  -- Status tracking
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'partial', 'waived', 'disputed')),

  -- Payment tracking
  paid_amount numeric NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  paid_at timestamptz,
  payment_reference text,

  -- Overdue tracking
  overdue_notified_at timestamptz,

  -- Audit
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Updated at trigger
CREATE TRIGGER repayment_schedules_updated_at
  BEFORE UPDATE ON repayment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_repayment_schedules_advance_id
  ON repayment_schedules(advance_id);

CREATE INDEX idx_repayment_schedules_employer_id
  ON repayment_schedules(employer_id);

CREATE INDEX idx_repayment_schedules_due_date
  ON repayment_schedules(due_date DESC);

CREATE INDEX idx_repayment_schedules_status_due
  ON repayment_schedules(status, due_date)
  WHERE status IN ('pending', 'overdue');

CREATE INDEX idx_repayment_schedules_reference
  ON repayment_schedules(repayment_reference);

-- RLS
ALTER TABLE repayment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on repayment_schedules"
  ON repayment_schedules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Employers can read their own repayment schedules"
  ON repayment_schedules
  FOR SELECT
  TO authenticated
  USING (
    employer_id IN (
      SELECT id FROM employers
      WHERE user_id = auth.uid()
    )
  );

