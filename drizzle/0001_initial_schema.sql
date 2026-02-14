-- Create employee_status enum
CREATE TYPE "employee_status" AS ENUM ('Active', 'Inactive');

-- Create organizations table
CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "country" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create employees table
CREATE TABLE "employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text,
  "employee_number" text,
  "department" text NOT NULL,
  "salary" numeric(12, 2) NOT NULL,
  "withdrawn_this_month" numeric(12, 2) DEFAULT '0' NOT NULL,
  "status" "employee_status" DEFAULT 'Active' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

-- Create policies table
CREATE TABLE "policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE UNIQUE,
  "withdrawal_limit_percent" numeric(5, 2) DEFAULT '50' NOT NULL,
  "frequency_cap" numeric(5, 0),
  "frequency_period" text DEFAULT 'month' NOT NULL,
  "auto_approval_enabled" numeric(1, 0) DEFAULT '0' NOT NULL,
  "auto_approval_threshold" numeric(12, 2) DEFAULT '500' NOT NULL,
  "access_days" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb NOT NULL,
  "access_start_hour" numeric(2, 0) DEFAULT '0' NOT NULL,
  "access_end_hour" numeric(2, 0) DEFAULT '23' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create payroll_integrations table
CREATE TABLE "payroll_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE UNIQUE,
  "provider" text NOT NULL,
  "status" text DEFAULT 'inactive' NOT NULL,
  "last_synced_at" timestamp,
  "credentials" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for employees
CREATE INDEX "employees_organization_idx" ON "employees"("organization_id");
CREATE INDEX "employees_name_idx" ON "employees"("name");
CREATE INDEX "employees_status_idx" ON "employees"("status");
CREATE INDEX "employees_deleted_at_idx" ON "employees"("deleted_at");
CREATE INDEX "employees_org_status_idx" ON "employees"("organization_id", "status", "deleted_at");

-- Enable Row Level Security (RLS)
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_integrations" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant isolation
-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view their own organization"
  ON "organizations"
  FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM user_organizations WHERE organization_id = id
  ));

-- Employees: Users can only see employees from their organization
CREATE POLICY "Users can view employees from their organization"
  ON "employees"
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert employees to their organization"
  ON "employees"
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update employees from their organization"
  ON "employees"
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete employees from their organization"
  ON "employees"
  FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

-- Similar policies for policies and payroll_integrations
CREATE POLICY "Users can view their organization policies"
  ON "policies"
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view their organization integrations"
  ON "payroll_integrations"
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

-- Create user_organizations junction table for multi-tenant support
CREATE TABLE "user_organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  "role" text DEFAULT 'member' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE(user_id, organization_id)
);

CREATE INDEX "user_organizations_user_idx" ON "user_organizations"("user_id");
CREATE INDEX "user_organizations_org_idx" ON "user_organizations"("organization_id");

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON "organizations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON "employees"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON "policies"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_integrations_updated_at BEFORE UPDATE ON "payroll_integrations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();