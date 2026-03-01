import Link from "next/link";
import { UserNav } from "@/components/user-nav";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { PageTitle } from "@/components/page-title";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth";

export async function SiteHeader({ initialRole }: { initialRole?: string | string[] | null }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch user role from the users table (if not provided)
    let role: string | string[] | null = initialRole || null;
    if (!role && user?.email) {
        const userData = await getUserRole(
            supabase,
            user.email,
            user.user_metadata?.full_name
        );
        role = userData?.role || null;
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-800 dark:bg-slate-950/95">
            <div className="flex h-14 items-center px-4 w-full justify-between">
                <div className="flex items-center flex-1 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
                    <div className="flex items-center">
                        {/* Mobile Sidebar Navigation (Client Component) */}
                        <MobileSidebar />

                        {/* Desktop Brand / Logo */}
                        <div className="hidden lg:flex">
                            <Link href="/" className="flex items-center space-x-2">
                                <span className="font-bold sm:inline-block">
                                    MB Projects
                                </span>
                            </Link>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <PageTitle />
                    </div>
                </div>

                {/* User Nav and Actions */}
                <div className="flex items-center space-x-2">
                    <nav className="flex items-center">
                        <UserNav user={user} role={role} />
                    </nav>
                </div>
            </div>
        </header>
    );
}
