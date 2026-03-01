"use client";

import { usePathname } from "next/navigation";

export function PageTitle() {
    const pathname = usePathname();

    // Logic to determine the title and subtitle based on the path
    const getPageInfo = () => {
        switch (pathname) {
            case "/tasks":
                return { title: "Tasks Dashboard" };
            case "/projects":
                return { title: "Projects Dashboard" };
            case "/team":
                return {
                    title: "Team Management",
                    subtitle: "Manage employees, assign roles, and control access."
                };
            case "/dashboard":
                return {
                    title: "Dashboard"
                };
            case "/":
                return {
                    title: "Dashboard"
                };
            default:
                return { title: "" };
        }
    };

    const { title, subtitle } = getPageInfo();

    if (!title) return null;

    return (
        <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 hidden sm:block leading-none">
                {title}
            </h1>
            {subtitle && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden lg:block leading-none">
                    {subtitle}
                </p>
            )}
        </div>
    );
}
