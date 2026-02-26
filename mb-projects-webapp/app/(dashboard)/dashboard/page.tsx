import { createClient } from "@/utils/supabase/server";
import { DashboardClientPage } from "./client-page";

export default async function DashboardPage() {
    const supabase = await createClient();

    // Fetch all tasks
    let allTasks: any[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
        const { data } = await supabase
            .from("tasks")
            .select("id, status, deadline, actualAssigneeEmail, phase, targetWeek")
            .order("created_at", { ascending: false })
            .range(from, from + step - 1);

        if (data && data.length > 0) {
            allTasks = [...allTasks, ...data];
            if (data.length < step) {
                keepFetching = false;
            } else {
                from += step;
            }
        } else {
            keepFetching = false;
        }
    }

    // Fetch basic project info for mapping IDs to names if needed
    const { data: projects } = await supabase
        .from("projects")
        .select("id, Project_Name");

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-semibold tracking-tight">Dashboard</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Real-time project metrics and task analytics.
                </p>
            </div>

            <DashboardClientPage
                initialTasks={allTasks}
                projects={projects || []}
            />
        </div>
    );
}
