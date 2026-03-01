-- ==========================================
-- SUPABASE SECURITY (RLS) POLICIES
-- ==========================================

-- 1. Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_template ENABLE ROW LEVEL SECURITY;

-- 2. Helper function to check if current user is Admin or Master Admin
-- SECURITY DEFINER allows this to run with bypass RLS to check the roles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = auth.jwt() ->> 'email' 
    AND (role = 'admin' OR role = 'master_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. USERS Table Policies
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Prevent Master Admin deletion" ON public.users;

-- Everyone authenticated can see the team list
CREATE POLICY "Enable read for authenticated users" ON public.users
FOR SELECT TO authenticated USING (true);

-- Only Admins/Master Admin can insert/update/delete users
CREATE POLICY "Admins can manage users" ON public.users
FOR ALL TO authenticated USING (public.is_admin());

-- Protect the Master Admin record from deletion even by other admins
CREATE POLICY "Prevent Master Admin deletion" ON public.users
FOR DELETE TO authenticated USING (
    public.is_admin() AND email != 'yajuvendra.sinh@getfive.in'
);


-- 4. PROJECTS Table Policies
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;

-- Everyone authenticated can see projects
CREATE POLICY "Enable read for authenticated users" ON public.projects
FOR SELECT TO authenticated USING (true);

-- Only Admins/Master Admin can manage projects
CREATE POLICY "Admins can manage projects" ON public.projects
FOR ALL TO authenticated USING (public.is_admin());


-- 5. TASKS Table Policies
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assignees can update their tasks" ON public.tasks;

-- Everyone authenticated can see tasks
CREATE POLICY "Enable read for authenticated users" ON public.tasks
FOR SELECT TO authenticated USING (true);

-- Admins/Master Admin have full control
CREATE POLICY "Admins can manage all tasks" ON public.tasks
FOR ALL TO authenticated USING (public.is_admin());

-- Assignees can update their own tasks (e.g., status, remarks)
CREATE POLICY "Assignees can update their tasks" ON public.tasks
FOR UPDATE TO authenticated 
USING (auth.jwt() ->> 'email' = "actualAssigneeEmail")
WITH CHECK (auth.jwt() ->> 'email' = "actualAssigneeEmail");


-- 6. MASTER TEMPLATE Table Policies
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.master_template;
DROP POLICY IF EXISTS "Admins can manage template" ON public.master_template;

-- Everyone authenticated can read the template
CREATE POLICY "Enable read for authenticated users" ON public.master_template
FOR SELECT TO authenticated USING (true);

-- Only Admins/Master Admin can change the template
CREATE POLICY "Admins can manage template" ON public.master_template
FOR ALL TO authenticated USING (public.is_admin());
