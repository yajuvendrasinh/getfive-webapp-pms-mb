import Link from "next/link";
import { UserNav } from "@/components/user-nav";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth";

export async function SiteHeader() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch user role from the users table (with auto-provisioning for master admin)
    let role: string | null = null;
    if (user?.email) {
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
                <div className="flex items-center">
                    {/* Mobile Sidebar Navigation (Client Component) */}
                    <MobileSidebar />

                    {/* Desktop Brand / Logo */}
                    <div className="hidden lg:flex mr-4">
                        <Link href="/" className="flex items-center space-x-2">
                            <span className="font-bold sm:inline-block">
                                MB Projects
                            </span>
                        </Link>
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
