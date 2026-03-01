import { SidebarNav } from "@/components/sidebar-nav";
import { SiteHeader } from "@/components/site-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
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
        <div className="flex min-h-screen flex-col">
            <SiteHeader initialRole={role} />
            <div className="container flex-1 items-start lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6 lg:pl-4">
                <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 lg:sticky lg:block">
                    <ScrollArea className="h-full pr-6">
                        <SidebarNav className="flex-col h-[calc(100vh-4rem)] py-4" initialRole={role} />
                    </ScrollArea>
                </aside>
                <main className="flex w-full flex-col overflow-hidden py-6 pr-4 lg:py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
