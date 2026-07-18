ALTER TABLE entries ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
