-- 1. Add deleted_at to employer_onboarding for soft delete
ALTER TABLE public.employer_onboarding ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Create termination_feedback table
CREATE TABLE IF NOT EXISTS public.termination_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES public.employer_onboarding(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  other_reason TEXT,
  additional_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.termination_feedback ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can insert their own feedback" ON public.termination_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback" ON public.termination_feedback
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));
