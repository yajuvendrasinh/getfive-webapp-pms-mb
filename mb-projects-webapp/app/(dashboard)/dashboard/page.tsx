import { createClient } from "@/utils/supabase/server";
import { DashboardClientPage } from "./client-page";

export default async function DashboardPage() {
    const supabase = await createClient();

    // KPI: Total, Completed, Pending, Overdue
    const now = new Date().toISOString();

    const [totalRes, completedRes, pendingRes, overdueRes, d3DataRes] = await Promise.all([
        supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .or("requirement.neq.not_applicable,requirement.is.null"),
        supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "completed"),
        supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .or("requirement.neq.not_applicable,requirement.is.null")
            .in("status", ["pending", "in_progress"]),
        supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .or("requirement.neq.not_applicable,requirement.is.null")
            .neq("status", "completed")
            .lt("deadline", now),
        // NOTE: For 50,000+ rows, the below query downloading tasks for D3 charts will become a memory bottleneck. 
        // TODO: In the future, create a Supabase RPC aggregation function to group by "actualAssigneeEmail" and "targetWeek", 
        // to return pre-tallied arrays instead of downloading the raw rows to JavaScript.
        supabase.from("tasks")
            .select("id, taskName, status, deadline, actualAssigneeEmail, phase, targetWeek")
            .or("requirement.neq.not_applicable,requirement.is.null")
            .order("created_at", { ascending: false })
            .limit(5000)
    ]);

    const kpis = {
        total: totalRes.count || 0,
        completed: completedRes.count || 0,
        pending: pendingRes.count || 0,
        overdue: overdueRes.count || 0,
    };

    const chartTasks = d3DataRes.data || [];

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
                kpiData={kpis}
                initialTasks={chartTasks}
                projects={projects || []}
            />
        </div>
    );
}
