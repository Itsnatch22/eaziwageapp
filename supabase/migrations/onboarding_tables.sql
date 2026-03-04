-- Employer Onboarding Table
CREATE TABLE IF NOT EXISTS employer_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    country TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Employee Onboarding Table
CREATE TABLE IF NOT EXISTS employee_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    employer_id UUID NOT NULL REFERENCES employer_onboarding(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    national_id TEXT,
    id_type TEXT DEFAULT 'national_id',
    date_of_birth DATE,
    job_title TEXT,
    department TEXT,
    employment_type TEXT DEFAULT 'full_time',
    start_date DATE,
    monthly_salary NUMERIC(12, 2),
    country TEXT,
    city TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    postal_code TEXT,
    bank_name TEXT,
    bank_account TEXT,
    mobile_money_provider TEXT,
    mobile_money_number TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    terms_accepted_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for employer_onboarding
CREATE INDEX IF NOT EXISTS employer_onboarding_user_id_idx ON employer_onboarding(user_id);
CREATE INDEX IF NOT EXISTS employer_onboarding_status_idx ON employer_onboarding(status);

-- Indexes for employee_onboarding
CREATE INDEX IF NOT EXISTS employee_onboarding_employer_id_idx ON employee_onboarding(employer_id);
CREATE INDEX IF NOT EXISTS employee_onboarding_user_id_idx ON employee_onboarding(user_id);
CREATE INDEX IF NOT EXISTS employee_onboarding_status_idx ON employee_onboarding(status);
CREATE INDEX IF NOT EXISTS employee_onboarding_employee_code_idx ON employee_onboarding(employee_code);

-- Enable Row Level Security
ALTER TABLE employer_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employer_onboarding
-- Employers can view their own profile
CREATE POLICY "Employers can view own profile"
    ON employer_onboarding FOR SELECT
    USING (auth.uid() = user_id);

-- Employers can insert their own profile
CREATE POLICY "Employers can insert own profile"
    ON employer_onboarding FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Employers can update their own profile
CREATE POLICY "Employers can update own profile"
    ON employer_onboarding FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for employee_onboarding
-- Employers can view their employees
CREATE POLICY "Employers can view own employees"
    ON employee_onboarding FOR SELECT
    USING (
        employer_id IN (
            SELECT id FROM employer_onboarding WHERE user_id = auth.uid()
        )
    );

-- Employers can insert employees for their organization
CREATE POLICY "Employers can insert employees"
    ON employee_onboarding FOR INSERT
    WITH CHECK (
        employer_id IN (
            SELECT id FROM employer_onboarding WHERE user_id = auth.uid()
        )
    );

-- Employers can update their employees
CREATE POLICY "Employers can update employees"
    ON employee_onboarding FOR UPDATE
    USING (
        employer_id IN (
            SELECT id FROM employer_onboarding WHERE user_id = auth.uid()
        )
    );

-- Employers can delete their employees
CREATE POLICY "Employers can delete employees"
    ON employee_onboarding FOR DELETE
    USING (
        employer_id IN (
            SELECT id FROM employer_onboarding WHERE user_id = auth.uid()
        )
    );

-- Admins can view all
CREATE POLICY "Admins can view all employer_onboarding"
    ON employer_onboarding FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can view all employee_onboarding"
    ON employee_onboarding FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_employer_onboarding_updated_at ON employer_onboarding;
CREATE TRIGGER update_employer_onboarding_updated_at
    BEFORE UPDATE ON employer_onboarding
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_onboarding_updated_at ON employee_onboarding;
CREATE TRIGGER update_employee_onboarding_updated_at
    BEFORE UPDATE ON employee_onboarding
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE employer_onboarding IS 'Employer onboarding profiles';
COMMENT ON TABLE employee_onboarding IS 'Employee onboarding records linked to employers';

