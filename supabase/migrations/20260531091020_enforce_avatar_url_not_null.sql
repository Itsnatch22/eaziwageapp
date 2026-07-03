
-- Backfill nulls in system_admins
UPDATE public.system_admins
SET avatar_url = 'https://etfytrhduspebpvybljq.supabase.co/storage/v1/object/public/avatars/download.jpeg'
WHERE avatar_url IS NULL;

-- Backfill nulls in profiles
UPDATE public.profiles
SET avatar_url = 'https://etfytrhduspebpvybljq.supabase.co/storage/v1/object/public/avatars/download.jpeg'
WHERE avatar_url IS NULL;

-- Enforce NOT NULL on system_admins
ALTER TABLE public.system_admins
ALTER COLUMN avatar_url SET NOT NULL;

-- Enforce NOT NULL on profiles
ALTER TABLE public.profiles
ALTER COLUMN avatar_url SET NOT NULL;

-- Set default for future inserts on both tables
ALTER TABLE public.system_admins
ALTER COLUMN avatar_url SET DEFAULT 'https://etfytrhduspebpvybljq.supabase.co/storage/v1/object/public/avatars/download.jpeg';

ALTER TABLE public.profiles
ALTER COLUMN avatar_url SET DEFAULT 'https://etfytrhduspebpvybljq.supabase.co/storage/v1/object/public/avatars/download.jpeg';

