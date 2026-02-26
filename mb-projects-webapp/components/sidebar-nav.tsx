'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Building2,
    CheckSquare,
    Users,
    LayoutDashboard,
    Settings,
    Shield,
    Plus
} from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { isAdmin, getRoleLabel } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavItem {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
    showPlus?: boolean;
}

const sidebarNavItems: NavItem[] = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Projects",
        href: "/projects",
        icon: Building2,
        showPlus: true,
    },
    {
        title: "Tasks",
        href: "/tasks",
        icon: CheckSquare,
    },
    {
        title: "Team",
        href: "/team",
        icon: Users,
        adminOnly: true,
        showPlus: true,
    },
];

type SidebarNavProps = React.HTMLAttributes<HTMLElement>;

export function SidebarNav({ className, ...props }: SidebarNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setMounted(true);

        async function fetchRole() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email && isMounted) {
                const { data } = await supabase
                    .from("users")
                    .select("role")
                    .eq("email", user.email)
                    .single();
                if (isMounted) {
                    setUserRole(data?.role || null);
                }
            }
        }
        fetchRole();
        return () => { isMounted = false; };
    }, [supabase]);

    const handlePlusClick = (e: React.MouseEvent, href: string) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`${href}?action=add`);
    };

    // Filter nav items based on role
    const visibleItems = sidebarNavItems.filter(item => {
        if (!mounted) return true; // Show all until mounted (safe default)
        if (item.adminOnly && !isAdmin(userRole)) return false;
        return true;
    });

    if (!mounted) return <div className={cn("flex flex-col h-full w-full", className)} />;

    return (
        <nav
            className={cn(
                "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 h-full w-full",
                className
            )}
            {...props}
        >
            <div className="flex-1 space-y-1">
                {visibleItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                            pathname === item.href
                                ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-50"
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {item.showPlus && isAdmin(userRole) && (
                            <div
                                onClick={(e) => handlePlusClick(e, item.href)}
                                className="hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded-sm transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
                            </div>
                        )}
                    </Link>
                ))}
            </div>

            {/* Role badge */}
            {userRole && (
                <div className="px-3 py-2">
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-xs font-medium w-full justify-center",
                            userRole === "master_admin"
                                ? "border-purple-400 text-purple-600 dark:border-purple-600 dark:text-purple-400"
                                : userRole === "admin"
                                    ? "border-blue-400 text-blue-600 dark:border-blue-600 dark:text-blue-400"
                                    : "border-slate-300 text-slate-500"
                        )}
                    >
                        <Shield className="h-3 w-3 mr-1" />
                        {getRoleLabel(userRole)}
                    </Badge>
                </div>
            )}

        </nav>
    );
}
