-- Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    email TEXT PRIMARY KEY,
    name TEXT,
    role TEXT,
    assigned_projects TEXT[] DEFAULT '{}',
    uid TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    "Project_Name" TEXT,
    "Start_Date" TIMESTAMP WITH TIME ZONE,
    "Project_Status" TEXT DEFAULT 'active',
    "Project_RM" TEXT,
    "Project_FDD" TEXT,
    "Project_Sec" TEXT,
    "Project_PC" TEXT,
    "Project_AM" TEXT,
    "Project_Additional_mem_1" TEXT,
    "Project_Additional_mem_2" TEXT,
    "Project_Additional_mem_3" TEXT,
    "completionTime" TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "createdBy" TEXT
);

-- Create Master Template Table
CREATE TABLE IF NOT EXISTS public.master_template (
    id TEXT PRIMARY KEY,
    phase TEXT,
    "taskName" TEXT,
    sequence INTEGER,
    "targetWeek" INTEGER,
    "targetWeekLabel" TEXT,
    "assigneeName" TEXT,
    "assigneeRole" TEXT,
    "actualAssigneeEmail" TEXT
);

-- Create Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    "taskName" TEXT,
    phase TEXT,
    "targetWeek" INTEGER,
    "assigneeRole" TEXT,
    status TEXT DEFAULT 'pending',
    "startTime" TIMESTAMP WITH TIME ZONE,
    "endTime" TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE,
    remarks JSONB DEFAULT '[]'::jsonb,
    requirement TEXT DEFAULT '',
    "actualAssigneeEmail" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for the tasks table so clients can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Note: Because Supabase relies on Postgres RLS for security,
-- by default new tables DO NOT have RLS enabled unless explicitly turned on.
-- This means your client app can read/write data using the anon key freely, which mimics standard Firestore access without strict rules.
-- If you want to restrict this in the future, you can turn on RLS and add policies.
