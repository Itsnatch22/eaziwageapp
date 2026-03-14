-- 1. Create Global Settings table
CREATE TABLE IF NOT EXISTS public.global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  platform_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Insert default settings
INSERT INTO public.global_settings (id, platform_settings, risk_settings, notification_settings)
VALUES ('default', 
  '{"maintenance_mode": false, "allow_new_registrations": true}'::jsonb,
  '{"default_min_advance": 500, "default_max_advance_percent": 50}'::jsonb,
  '{"email_enabled": true, "sms_enabled": false}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 3. Create Blackout Periods table
CREATE TABLE IF NOT EXISTS public.blackout_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  applies_to TEXT NOT NULL DEFAULT 'all', -- 'all' or country code 'KE', 'UG', etc.
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Create Legal Documents table
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL, -- 'employee_terms', 'employer_partnership', 'privacy_policy'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. Create System Audit Logs table
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  admin_name TEXT,
  target_id TEXT,
  target_type TEXT,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 6. Enable RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blackout_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Admin Only RLS Policies
CREATE POLICY admin_all_global_settings ON public.global_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

CREATE POLICY admin_all_blackout_periods ON public.blackout_periods
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

CREATE POLICY admin_all_legal_docs ON public.legal_documents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

CREATE POLICY admin_all_audit_logs ON public.system_audit_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')));

-- 8. Public/Auth Read policies for specific tables
CREATE POLICY read_active_legal_docs ON public.legal_documents
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY read_active_blackout_periods ON public.blackout_periods
  FOR SELECT TO authenticated
  USING (is_active = true);
