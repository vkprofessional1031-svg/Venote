ALTER TABLE quick_notes
ADD COLUMN font_family text DEFAULT 'Plus Jakarta Sans',
ADD COLUMN font_size text DEFAULT '15px',
ADD COLUMN text_align text DEFAULT 'left',
ADD COLUMN is_bold boolean DEFAULT false,
ADD COLUMN is_italic boolean DEFAULT false,
ADD COLUMN is_underline boolean DEFAULT false;
