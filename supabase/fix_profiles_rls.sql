-- ============================================================================
-- Fix for: infinite recursion detected in policy for relation "profiles"
-- Error Code: 42P17
-- ============================================================================
-- 
-- This error occurs when RLS (Row Level Security) policies on the profiles
-- table reference each other in a circular/recursive manner.
--
-- INSTRUCTIONS:
-- 1. Run this script in Supabase SQL Editor
-- 2. Or apply via Supabase CLI: supabase db push or supabase db reset
-- ============================================================================

-- First, let's see what policies currently exist on the profiles table
SELECT 
    policyname,
    cmd,
    qual,
    with_check,
    permissive
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- SOLUTION 1: If you have recursive policies, disable RLS temporarily
-- (Not recommended for production, but useful for debugging)
-- ============================================================================

-- Option A: Disable RLS on profiles (debug only)
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Option B: Re-enable RLS after fixing
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SOLUTION 2: Fix common circular reference patterns
-- ============================================================================

-- Common pattern that causes recursion:
-- If you have a policy that checks auth.uid() against a field that itself
-- requires another query to profiles (or a related table), it can loop.

-- Example fix: Use a direct comparison instead of subqueries
-- Instead of:
--   WHERE id IN (SELECT user_id FROM user_roles WHERE ...)
-- Use:
--   WHERE auth.uid() = id

-- ============================================================================
-- SOLUTION 3: Create safe, non-recursive policies
-- ============================================================================

-- Drop existing problematic policies (replace with your policy names)
-- DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
-- DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

-- Create simple, non-recursive policies
-- Example: Allow users to read their own profile
-- CREATE POLICY "profiles_select_own" ON profiles
--     FOR SELECT USING (auth.uid() = id);

-- Example: Allow users to update their own profile
-- CREATE POLICY "profiles_update_own" ON profiles
--     FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- SOLUTION 4: If using service role, bypass RLS entirely
-- ============================================================================

-- In your API routes, use the admin client for internal operations
-- that don't need RLS:
-- import { createClient } from '@supabase/supabase-js'
-- const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

-- ============================================================================
-- DEBUG: Check for circular function dependencies
-- ============================================================================

SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%profile%';

-- ============================================================================
-- QUICK FIX: If you just need to disable RLS temporarily to debug
-- ============================================================================

-- Run this to temporarily disable RLS on profiles table
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- After fixing the issue, re-enable with proper policies
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Then recreate your policies (example):
-- CREATE POLICY "Allow public read access" ON profiles FOR SELECT USING (true);
-- CREATE POLICY "Allow authenticated update own" ON profiles FOR UPDATE USING (auth.uid() = id);
