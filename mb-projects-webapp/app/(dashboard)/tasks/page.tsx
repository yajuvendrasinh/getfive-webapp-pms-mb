import { TasksClientPage } from "./client-page";

export default function TasksPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-semibold tracking-tight">Tasks Dashboard</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Manage your tasks, view action required items, and track weekly progress.
                </p>
            </div>

            <TasksClientPage />
        </div>
    );
}
