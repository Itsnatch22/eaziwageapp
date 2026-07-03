
-- Core lookup: cooldown check, monthly count, fraud engine recent advances
CREATE INDEX idx_advances_employee_id_status 
  ON public.advances(employee_id, status);

-- Cooldown query: order by disbursed_at DESC for last completed advance
CREATE INDEX idx_advances_employee_disbursed 
  ON public.advances(employee_id, disbursed_at DESC) 
  WHERE status = 'completed';

-- Monthly advance count: date-range filter on created_at
CREATE INDEX idx_advances_employee_created 
  ON public.advances(employee_id, created_at DESC);

-- Webhook + payout service: lookup by merchant reference
CREATE INDEX idx_advances_reference 
  ON public.advances(reference) 
  WHERE reference IS NOT NULL;

-- Fraud engine: employer-level advance lookups
CREATE INDEX idx_advances_employer_id_status 
  ON public.advances(employer_id, status);

