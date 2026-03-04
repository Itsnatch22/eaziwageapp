-- supabase/migrations/20260304_fraud_detection.sql

-- Fraud Rules Table
CREATE TABLE IF NOT EXISTS public.fraud_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL, -- 'amount_threshold', 'frequency', 'velocity', 'pattern', 'employer_manipulation'
    threshold_value NUMERIC NOT NULL,
    threshold_unit TEXT, -- 'amount', 'count', 'percentage', 'days'
    severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
    action TEXT NOT NULL DEFAULT 'flag', -- 'flag', 'block', 'notify'
    enabled BOOLEAN DEFAULT true,
    trigger_count INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fraud Alerts Table
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES public.fraud_rules(id),
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'under_review', 'resolved', 'dismissed'
    
    -- Entity references (can be linked to employee or employer)
    employee_id UUID, -- References employee onboarding or sync table
    employer_id UUID,
    transaction_id UUID, -- Link to advance request if applicable
    
    metadata JSONB DEFAULT '{}'::jsonb, -- Store snapshot of data that triggered it
    reviewer_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID, -- Profile ID of admin
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed some default rules
INSERT INTO public.fraud_rules (name, description, rule_type, threshold_value, threshold_unit, severity, action)
VALUES 
('High Amount Advance', 'Flag advances exceeding 50,000 KES', 'amount_threshold', 50000, 'amount', 'high', 'flag'),
('Rapid Request Frequency', 'More than 3 requests in a 7-day window', 'frequency', 3, 'count', 'medium', 'flag'),
('Salary Spike Detection', 'Salary increase >40% MoM', 'employer_manipulation', 40, 'percentage', 'high', 'block'),
('Velocity Attack', 'More than 2 withdrawal attempts in 1 hour', 'velocity', 2, 'count', 'high', 'block');

-- Enable RLS
ALTER TABLE public.fraud_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

-- Policies (Admin only)
CREATE POLICY "Admin can manage fraud rules" ON public.fraud_rules
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'compliance')));

CREATE POLICY "Admin can manage fraud alerts" ON public.fraud_alerts
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'compliance')));
