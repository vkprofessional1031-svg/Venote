ALTER TABLE entries 
  DROP COLUMN IF EXISTS is_quick_note,
  DROP COLUMN IF EXISTS font_family,
  DROP COLUMN IF EXISTS font_size,
  DROP COLUMN IF EXISTS text_align,
  DROP COLUMN IF EXISTS is_bold,
  DROP COLUMN IF EXISTS is_italic,
  DROP COLUMN IF EXISTS is_underline;
