import { SidebarNav } from "@/components/sidebar-nav";
import { SiteHeader } from "@/components/site-header";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <div className="container flex-1 items-start lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6 lg:pl-4">
                <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 lg:sticky lg:block">
                    <ScrollArea className="h-full pr-6">
                        <SidebarNav className="flex-col h-[calc(100vh-4rem)] py-4" />
                    </ScrollArea>
                </aside>
                <main className="flex w-full flex-col overflow-hidden py-6 pr-4 lg:py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
