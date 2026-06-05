CREATE TABLE IF NOT EXISTS public.dashboard_contact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    is_read BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending', -- pending, replied, archived
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.dashboard_contact ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable public insert for contact form" 
ON public.dashboard_contact 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow authenticated admins to view contact messages" 
ON public.dashboard_contact 
FOR SELECT 
TO authenticated 
USING (auth.role() = 'service_role' OR EXISTS (
  SELECT 1 FROM public.system_admins WHERE email = auth.email()
));

CREATE POLICY "Allow authenticated admins to update contact messages" 
ON public.dashboard_contact 
FOR UPDATE 
TO authenticated 
USING (auth.role() = 'service_role' OR EXISTS (
  SELECT 1 FROM public.system_admins WHERE email = auth.email()
));

CREATE INDEX IF NOT EXISTS idx_dashboard_contact_email ON public.dashboard_contact(email);
CREATE INDEX IF NOT EXISTS idx_dashboard_contact_submitted_at ON public.dashboard_contact(submitted_at DESC);
