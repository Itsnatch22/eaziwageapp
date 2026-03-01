-- ============================================================================
-- URGENT FIX: Infinite recursion in profiles table RLS policies
-- Error: "infinite recursion detected in policy for relation \"profiles\""
-- Error Code: 42P17
-- ============================================================================
--
-- This script provides multiple solutions to fix the infinite recursion error.
-- 
-- INSTRUCTIONS:
-- 1. Run this in Supabase SQL Editor
-- 2. Or apply via Supabase CLI: npx supabase db push
-- ============================================================================

-- ============================================================================
-- SOLUTION 1: Quick Fix - Disable and Recreate Safe Policies
-- ============================================================================

-- Step 1: Drop all existing policies on profiles table
DROP POLICY IF EXISTS "profiles_are_publicly_readable" ON profiles;
DROP POLICY IF EXISTS "profiles_user_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_full_access" ON profiles;
DROP POLICY IF EXISTS "Allow public read access" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated update own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "users_can_read_profiles" ON profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;

-- Step 2: Re-enable RLS with simple, non-recursive policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Simple read policy - allows authenticated users to read all profiles
-- This avoids recursion by not referencing any other tables
CREATE POLICY "profiles_read_all" ON profiles
    FOR SELECT TO authenticated
    USING (true);

-- Simple update policy - allows users to update their own profile
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- SOLUTION 2: If Solution 1 doesn't work, temporarily disable RLS
-- ============================================================================

-- Run this ONLY if Solution 1 doesn't work
-- This is less secure but will fix the immediate error
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SOLUTION 3: Check for recursive function definitions
-- ============================================================================

-- Run this to see if there are any functions that might be causing recursion
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    SELECT proname 
    FROM pg_proc 
    WHERE proname LIKE '%profile%' 
    OR proname LIKE '%auth%'
);

-- ============================================================================
-- VERIFICATION: Check current policies
-- ============================================================================

-- Run this to see all policies on profiles table
SELECT 
    policyname,
    cmd,
    qual,
    with_check,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- ALTERNATIVE: Use a view instead of direct table access
-- ============================================================================

-- If policies keep causing issues, create a view for profile data
-- DROP VIEW IF EXISTS profiles_view;
-- CREATE VIEW profiles_view AS
-- SELECT id, full_name, email, role, role_normalized
-- FROM profiles;

-- ============================================================================
-- TEST: Test if the fix works
-- ============================================================================

-- Run this to test if the profiles table is accessible
-- SELECT id, full_name, role FROM profiles LIMIT 1;
