import { createClient } from "@/utils/supabase/server";
import { ProjectsClientPage } from "./client-page";

export default async function ProjectsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch user role
    const { data: userData } = await supabase
        .from("users")
        .select("role, email")
        .eq("email", user?.email)
        .single();

    const role = userData?.role || "employee";

    // Fetch projects
    let projects = [];
    if (role === "admin" || role === "master_admin") {
        const { data } = await supabase
            .from("projects")
            .select("*")
            .order("created_at", { ascending: false });
        projects = data || [];
    } else {
        // For RM/employees, fetch all projects (they will be filtered/shown appropriately)
        const { data } = await supabase
            .from("projects")
            .select("*")
            .order("created_at", { ascending: false });
        projects = data || [];
    }

    // Fetch all users for team assignment dropdowns
    const { data: allUsers } = await supabase.from("users").select("name, email, role");

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-semibold tracking-tight">Projects</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    View and manage all projects.
                </p>
            </div>

            <ProjectsClientPage
                initialProjects={projects}
                userRole={role}
                allUsers={allUsers || []}
            />
        </div>
    );
}
