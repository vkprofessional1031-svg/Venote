ALTER TABLE public.job_applications 
ADD COLUMN job_url TEXT;

NOTIFY pgrst, 'reload schema';
