-- Create job_applications table
CREATE TABLE public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    source TEXT,
    applied_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for job_applications
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own applications"
    ON public.job_applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own applications"
    ON public.job_applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
    ON public.job_applications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications"
    ON public.job_applications FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX idx_job_applications_user_id ON public.job_applications(user_id);


-- Create application_rounds table
CREATE TABLE public.application_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    round_name TEXT NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'upcoming',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for application_rounds
ALTER TABLE public.application_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rounds"
    ON public.application_rounds FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rounds"
    ON public.application_rounds FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rounds"
    ON public.application_rounds FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rounds"
    ON public.application_rounds FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX idx_application_rounds_user_id ON public.application_rounds(user_id);
CREATE INDEX idx_application_rounds_app_id ON public.application_rounds(application_id);
CREATE INDEX idx_application_rounds_deadline ON public.application_rounds(deadline);


-- Create prep_sessions table
CREATE TABLE public.prep_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.job_applications(id) ON DELETE SET NULL,
    prep_type TEXT NOT NULL,
    count_or_duration TEXT,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for prep_sessions
ALTER TABLE public.prep_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prep sessions"
    ON public.prep_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prep sessions"
    ON public.prep_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prep sessions"
    ON public.prep_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prep sessions"
    ON public.prep_sessions FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX idx_prep_sessions_user_id ON public.prep_sessions(user_id);
CREATE INDEX idx_prep_sessions_date ON public.prep_sessions(date);
