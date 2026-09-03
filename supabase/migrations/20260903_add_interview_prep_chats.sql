CREATE TABLE interview_prep_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  job_application_id uuid REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL,
  mode text NOT NULL CHECK (mode IN ('research', 'mock')),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE interview_prep_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prep chats" ON interview_prep_chats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
