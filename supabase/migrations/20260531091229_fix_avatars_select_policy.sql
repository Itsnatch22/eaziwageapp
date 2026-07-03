
-- Drop the broad public SELECT policy
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Replace with scoped SELECT policy
CREATE POLICY "Users can view their own avatars"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

