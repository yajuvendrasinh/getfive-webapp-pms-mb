import { createClient } from "@/utils/supabase/server";
import { TasksClientPage } from "./client-page";

export default async function TasksPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch projects user wants to see in dropdown
    // For basic employee, we only show projects they have tasks in. For RM/Admin we show all or projects they are assigned to.
    // Simplification for now: let's fetch projects from DB where user is somehow involved, or all if admin.
    // In the original extension, "assigned_projects" array in users table was deprecated in favor of dynamic fetch.

    let projects: { id: string; Project_Name: string; Start_Date: string; Status: string }[] = [];
    try {
        const { data: userData } = await supabase.from('users').select('role').eq('email', user?.email).single();
        const role = userData?.role || 'employee';

        if (role === 'admin' || role === 'master_admin') {
            const { data } = await supabase.from('projects').select('id, Project_Name, Start_Date, Status');
            projects = data || [];
        } else {
            // Find projects where user is RM, FDD, Sec, PC, AM, or Additional member 1-3
            // For now, let's fetch all and filter client side OR use a simpler RPC/query. Let's just fetch all active projects for now.
            const { data } = await supabase.from('projects').select('id, Project_Name, Start_Date, Status');
            projects = data || [];
        }
    } catch (e) {
        console.error(e);
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-semibold tracking-tight">Tasks Dashboard</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Manage your tasks, view action required items, and track weekly progress.
                </p>
            </div>

            <TasksClientPage initialProjects={projects} user={user} />
        </div>
    );
}
