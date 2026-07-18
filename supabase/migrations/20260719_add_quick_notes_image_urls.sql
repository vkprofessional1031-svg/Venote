ALTER TABLE quick_notes ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
