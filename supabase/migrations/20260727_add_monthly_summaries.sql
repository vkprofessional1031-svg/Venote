CREATE TABLE monthly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  month date NOT NULL,
  summary_text text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own summaries" 
ON monthly_summaries FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own summaries" 
ON monthly_summaries FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own summaries" 
ON monthly_summaries FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own summaries" 
ON monthly_summaries FOR DELETE 
USING (auth.uid() = user_id);

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
