import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdmin, getUserRole } from "@/lib/auth";
import { TeamClientPage } from "./client-page";

export default async function TeamPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
        redirect("/login");
    }

    // Get current user's role (with auto-provisioning)
    const currentUserData = await getUserRole(
        supabase,
        user.email,
        user.user_metadata?.full_name
    );

    // Only admin and master_admin can access this page
    if (!currentUserData || !isAdmin(currentUserData.role)) {
        redirect("/projects");
    }

    // Fetch all users
    const { data: allUsers } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-semibold tracking-tight">Team Management</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Manage users, assign roles, and control access.
                </p>
            </div>

            <TeamClientPage
                initialUsers={allUsers || []}
                currentUserRole={currentUserData.role}
                currentUserEmail={user.email}
            />
        </div>
    );
}
