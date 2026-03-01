import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth";
import { ProjectsClientPage } from "./client-page";

export default async function ProjectsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let role: string | string[] | null = null;
    if (user?.email) {
        const userData = await getUserRole(
            supabase,
            user.email,
            user.user_metadata?.full_name
        );
        role = userData?.role || null;
    }

    return (
        <div className="space-y-6">
            <ProjectsClientPage initialUser={user} initialRole={role} />
        </div>
    );
}
