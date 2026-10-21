-- Fix storage upload policy to use correct folder extraction
-- The previous policy used a non-existent 'folder' column
-- This version uses storage.foldername() helper function to extract the folder from the path

-- Drop the old policy
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

-- Create the corrected upload policy
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reference-images'
  AND (storage.foldername(name))[1] IN ('originals', 'thumbnails')
);

-- Verify the policy was created
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Authenticated users can upload images';
