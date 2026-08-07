CREATE TABLE IF NOT EXISTS public.schedule_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    color TEXT, -- optional category color
    -- Optional links back to source data (nullable, only one should be set if linked)
    linked_task_id UUID, -- references an Organize task, if this block was dragged from the unscheduled list
    linked_round_id UUID REFERENCES public.application_rounds(id) ON DELETE SET NULL, -- references a Prep round, if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'schedule_blocks' AND policyname = 'Users can view their own schedule blocks'
    ) THEN
        CREATE POLICY "Users can view their own schedule blocks" ON public.schedule_blocks FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'schedule_blocks' AND policyname = 'Users can insert their own schedule blocks'
    ) THEN
        CREATE POLICY "Users can insert their own schedule blocks" ON public.schedule_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'schedule_blocks' AND policyname = 'Users can update their own schedule blocks'
    ) THEN
        CREATE POLICY "Users can update their own schedule blocks" ON public.schedule_blocks FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'schedule_blocks' AND policyname = 'Users can delete their own schedule blocks'
    ) THEN
        CREATE POLICY "Users can delete their own schedule blocks" ON public.schedule_blocks FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_user_id ON public.schedule_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_start_time ON public.schedule_blocks(start_time);

NOTIFY pgrst, 'reload schema';
