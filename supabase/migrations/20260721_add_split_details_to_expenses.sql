-- Add split_details column to expenses table
ALTER TABLE public.expenses
ADD COLUMN split_details TEXT;
