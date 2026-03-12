-- ═══════════════════════════════════════════════════════════════════════════
-- Recreate system_admins table from scratch
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Drop existing table (this will cascade delete all admin records)
DROP TABLE IF EXISTS system_admins CASCADE;

-- Step 2: Recreate the table
CREATE TABLE public.system_admins (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text NULL,
  avatar_url text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  is_admin boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone NULL,
  CONSTRAINT system_admins_pkey PRIMARY KEY (id),
  CONSTRAINT system_admins_email_key UNIQUE (email),
  CONSTRAINT system_admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Step 3: Add indexes
CREATE INDEX IF NOT EXISTS idx_system_admins_email ON system_admins(email);
CREATE INDEX IF NOT EXISTS idx_system_admins_is_admin ON system_admins(is_admin) WHERE is_admin = true;

-- Step 4: Enable RLS (optional - since we use service role client, RLS is bypassed)
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- Step 5: Find the auth.users records for the 5 admin emails
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'full_name' as full_name,
  created_at
FROM auth.users
WHERE email IN (
  'joel@eaziwage.com',
  'henry@eaziwage.com',
  'jason@eaziwage.com',
  'kamaumark996@gmail.com',
  'mark@eaziwage.com'
)
ORDER BY email;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 6: INSERT THE ACTUAL USER IDs FROM STEP 5 ABOVE
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO system_admins (id, email, full_name, is_admin, created_at)
VALUES
  ('c5db180b-bad3-4372-936f-31c432720bd1',     'henry@eaziwage.com',        'Henry',   true, NOW()),
  ('9531947a-9301-4b05-8eda-272b5d2d9c93',     'jason@eaziwage.com',        'Jason',   true, NOW()),
  ('2f488136-2258-4908-9116-eed137bd1fff',      'joel@eaziwage.com',         'Joel',    true, NOW()),
  ('36ec0954-6989-495f-b4ea-420eb67d5a91',     'kamaumark996@gmail.com',    'Kamau',   true, NOW()),
  ('fa23df9c-6781-44e4-938e-88a0cb059178',      'mark@eaziwage.com',         'Mark',    true, NOW())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  is_admin = EXCLUDED.is_admin;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 7: Verify all 5 admins are inserted
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
  sa.id,
  sa.email,
  sa.full_name,
  sa.is_admin,
  sa.created_at,
  u.email as auth_email,
  CASE 
    WHEN u.id IS NOT NULL THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as auth_user_status
FROM system_admins sa
LEFT JOIN auth.users u ON sa.id = u.id
WHERE sa.is_admin = true
ORDER BY sa.email;

-- Expected output: 5 rows, all with auth_user_status = 'EXISTS'

-- ═══════════════════════════════════════════════════════════════════════════
-- Troubleshooting queries
-- ═══════════════════════════════════════════════════════════════════════════

-- Check if any emails exist in auth.users but NOT in system_admins
SELECT 
  u.id,
  u.email,
  'Missing from system_admins' as status
FROM auth.users u
WHERE u.email IN (
  'joel@eaziwage.com',
  'henry@eaziwage.com',
  'jason@eaziwage.com',
  'kamaumark996@gmail.com',
  'mark@eaziwage.com'
)
AND NOT EXISTS (
  SELECT 1 FROM system_admins sa WHERE sa.id = u.id
);

-- Check for duplicate emails in system_admins
SELECT email, COUNT(*) as count
FROM system_admins
GROUP BY email
HAVING COUNT(*) > 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTANT NOTES
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. All 5 admins MUST first exist in auth.users (they must have registered)
-- 2. The id in system_admins MUST match the id in auth.users
-- 3. The email MUST match exactly (case-sensitive in some DBs)
-- 4. After inserting, verify Step 7 shows all 5 rows with 'EXISTS' status
-- ═══════════════════════════════════════════════════════════════════════════