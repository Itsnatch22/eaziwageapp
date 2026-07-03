
-- Remove hardcoded default avatar, let it be null so users upload their own
ALTER TABLE public.profiles
  ALTER COLUMN avatar_url SET DEFAULT NULL,
  ALTER COLUMN avatar_url DROP NOT NULL;

-- Also fix system_admins table which has the same hardcoded default
ALTER TABLE public.system_admins
  ALTER COLUMN avatar_url SET DEFAULT NULL,
  ALTER COLUMN avatar_url DROP NOT NULL;

-- Clear existing download.jpeg values to null for all users who haven't uploaded their own
UPDATE public.profiles
SET avatar_url = NULL
WHERE avatar_url = 'https://etfytrhduspebpvybljq.supabase.co/storage/v1/object/public/avatars/download.jpeg';

UPDATE public.system_admins
SET avatar_url = NULL
WHERE avatar_url = 'https://etfytrhduspebpvybljq.supabase.co/storage/v1/object/public/avatars/download.jpeg';

