ALTER TABLE expenses 
ADD COLUMN split_participants JSONB DEFAULT NULL;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
