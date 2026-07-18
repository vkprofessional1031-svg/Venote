INSERT INTO storage.buckets (id, name, public) 
VALUES ('note-images', 'note-images', true) 
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'note-images');

CREATE POLICY "Auth Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'note-images' 
  AND (select auth.uid()::text) = (string_to_array(name, '/'))[1]
);

CREATE POLICY "Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'note-images' 
  AND (select auth.uid()::text) = (string_to_array(name, '/'))[1]
);
