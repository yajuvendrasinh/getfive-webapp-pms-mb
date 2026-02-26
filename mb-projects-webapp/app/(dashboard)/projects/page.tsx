import { ProjectsClientPage } from "./client-page";

export default function ProjectsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-semibold tracking-tight">Projects</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    View and manage all projects.
                </p>
            </div>

            <ProjectsClientPage />
        </div>
    );
}
