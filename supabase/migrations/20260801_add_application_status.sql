ALTER TABLE public.job_applications 
ADD COLUMN status TEXT NOT NULL DEFAULT 'applied' 
CHECK (status IN ('applied', 'in_progress', 'accepted', 'rejected'));

ALTER TABLE public.job_applications 
ADD COLUMN status_manually_set BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
