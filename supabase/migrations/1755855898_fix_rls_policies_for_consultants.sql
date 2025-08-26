-- Migration: fix_rls_policies_for_consultants
-- Created at: 1755855898

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own weeks" ON public.weeks;
DROP POLICY IF EXISTS "Users can manage their own weeks" ON public.weeks;
DROP POLICY IF EXISTS "Users can view their own day entries" ON public.day_entries;
DROP POLICY IF EXISTS "Users can manage their own day entries" ON public.day_entries;
DROP POLICY IF EXISTS "Users can view their own project entries" ON public.project_entries;
DROP POLICY IF EXISTS "Users can manage their own project entries" ON public.project_entries;
DROP POLICY IF EXISTS "Users can view their own cost entries" ON public.cost_entries;
DROP POLICY IF EXISTS "Users can manage their own cost entries" ON public.cost_entries;
DROP POLICY IF EXISTS "All users can view projects" ON public.projects;
DROP POLICY IF EXISTS "All users can view clients" ON public.clients;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for weeks table
CREATE POLICY "Users can view their own weeks" ON public.weeks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own weeks" ON public.weeks
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for day_entries table
CREATE POLICY "Users can view their own day entries" ON public.day_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.weeks 
            WHERE weeks.id = day_entries.week_id 
            AND weeks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own day entries" ON public.day_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.weeks 
            WHERE weeks.id = day_entries.week_id 
            AND weeks.user_id = auth.uid()
        )
    );

-- Create RLS policies for project_entries table
CREATE POLICY "Users can view their own project entries" ON public.project_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.day_entries de
            JOIN public.weeks w ON w.id = de.week_id
            WHERE de.id = project_entries.day_entry_id 
            AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own project entries" ON public.project_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.day_entries de
            JOIN public.weeks w ON w.id = de.week_id
            WHERE de.id = project_entries.day_entry_id 
            AND w.user_id = auth.uid()
        )
    );

-- Create RLS policies for cost_entries table
CREATE POLICY "Users can view their own cost entries" ON public.cost_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.day_entries de
            JOIN public.weeks w ON w.id = de.week_id
            WHERE de.id = cost_entries.day_entry_id 
            AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own cost entries" ON public.cost_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.day_entries de
            JOIN public.weeks w ON w.id = de.week_id
            WHERE de.id = cost_entries.day_entry_id 
            AND w.user_id = auth.uid()
        )
    );

-- Create RLS policies for projects and clients (read-only for all authenticated users)
CREATE POLICY "All users can view projects" ON public.projects
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All users can view clients" ON public.clients
    FOR SELECT USING (auth.role() = 'authenticated');;