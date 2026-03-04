-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    role TEXT DEFAULT 'employee' NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Add role_normalized column if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role_normalized TEXT;

-- Create index on id for faster lookups
CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);

-- Create index on role for faster admin queries
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
-- Users can read their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Admins can read all profiles
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'compliance', 'employer_admin')
        )
    );

-- Admins can update all profiles
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'compliance', 'employer_admin')
        )
    );

-- Allow insert for service role (used during user registration)
-- This is handled by the auth.users trigger that creates profiles

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Admin Notifications Table
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for admin_notifications
CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx ON public.admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_read_idx ON public.admin_notifications(read);

-- Enable RLS on admin_notifications
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Allow admins to read admin_notifications
DROP POLICY IF EXISTS "admins_can_read_notifications" ON public.admin_notifications;
CREATE POLICY "admins_can_read_notifications"
    ON public.admin_notifications FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'compliance', 'employer_admin')
        )
    );

-- Allow admins to insert admin_notifications
DROP POLICY IF EXISTS "admins_can_insert_notifications" ON public.admin_notifications;
CREATE POLICY "admins_can_insert_notifications"
    ON public.admin_notifications FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'compliance', 'employer_admin')
        )
    );

-- Allow admins to update admin_notifications
DROP POLICY IF EXISTS "admins_can_update_notifications" ON public.admin_notifications;
CREATE POLICY "admins_can_update_notifications"
    ON public.admin_notifications FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'compliance', 'employer_admin')
        )
    );

-- Allow admins to delete admin_notifications
DROP POLICY IF EXISTS "admins_can_delete_notifications" ON public.admin_notifications;
CREATE POLICY "admins_can_delete_notifications"
    ON public.admin_notifications FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'compliance', 'employer_admin')
        )
    );

-- Comments
COMMENT ON TABLE public.profiles IS 'User profiles with role information';
COMMENT ON TABLE public.admin_notifications IS 'Notifications for admin users';

