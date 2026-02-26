"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import useSWR from "swr";

// Types
type Project = { id: string | number; Project_Name: string; Start_Date: string | null; Status: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskItem = Record<string, any>;

function calculateCurrentWeek(startDate: string | null): number {
    if (!startDate) return 1;
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.ceil(diffDays / 7));
}

export function TasksClientPage() {
    const supabase = useMemo(() => createClient(), []);

    // 1. Fetch Session
    const { data: session } = useSWR("session", async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return { user: null, role: "employee" };
        const { data: userData } = await supabase.from("users").select("role").eq("email", user.email).single();
        return { user, role: userData?.role || "employee" };
    });
    const user = session?.user || null;
    const role = session?.role || "employee";

    // 2. Fetch Projects (for the dropdown)
    const { data: projects = [] } = useSWR("tasks-projects", async () => {
        if (role === "admin" || role === "master_admin") {
            const { data } = await supabase.from("projects").select("id, Project_Name, Start_Date, Status");
            return data || [];
        } else {
            const { data } = await supabase.from("projects").select("id, Project_Name, Start_Date, Status");
            return data || [];
        }
    });

    const [activeProjectId, setActiveProjectId] = useState<string>("");
    const activeProject = projects.find((p: Project) => p.id.toString() === activeProjectId);
    const currentWeek = calculateCurrentWeek(activeProject?.Start_Date ?? null);

    // Set initial active project if not set once projects load
    useEffect(() => {
        if (!activeProjectId && projects.length > 0) {
            setActiveProjectId(projects[0].id.toString());
        }
    }, [projects, activeProjectId]);

    // 3. Fetch Tasks
    const { data: tasks = [], mutate } = useSWR(
        activeProjectId ? ["tasks", activeProjectId] : null,
        async ([, projId]: [string, string]) => {
            const { data } = await supabase.from("tasks").select("*").eq("project_id", projId);
            return data || [];
        },
        { fallbackData: [] }
    );
    // 4. Realtime Subscription for tasks
    useEffect(() => {
        if (!activeProjectId) return;

        const channel = supabase
            .channel(`tasks-rt-${activeProjectId}`)
            .on("postgres_changes",
                { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${activeProjectId}` },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        mutate((prev: TaskItem[] = []) => [...prev, payload.new], false);
                    } else if (payload.eventType === "UPDATE") {
                        mutate((prev: TaskItem[] = []) => prev.map((t: TaskItem) => t.id === payload.new.id ? payload.new : t), false);
                    } else if (payload.eventType === "DELETE") {
                        mutate((prev: TaskItem[] = []) => prev.filter((t: TaskItem) => t.id !== payload.old.id), false);
                    }
                })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeProjectId, supabase, mutate]);

    // Task action handlers
    const updateTaskStatus = async (taskId: string, status: string, extras: Record<string, string | null> = {}) => {
        // Optimistic update
        mutate((prev: TaskItem[] = []) =>
            prev.map((t: TaskItem) => t.id === taskId ? { ...t, status, ...extras } : t),
            false
        );

        await supabase
            .from("tasks")
            .update({ status, ...extras })
            .eq("id", taskId);
    };

    const handleStart = (taskId: string) =>
        updateTaskStatus(taskId, "in_progress", { startTime: new Date().toISOString() });

    const handleComplete = (taskId: string) =>
        updateTaskStatus(taskId, "completed", { endTime: new Date().toISOString() });

    const handleHold = (taskId: string) =>
        updateTaskStatus(taskId, "on_hold");

    const handleResume = (taskId: string) =>
        updateTaskStatus(taskId, "in_progress");

    // Filter tasks into buckets (mirrors dashboard.js logic)
    const visibleTasks = tasks.filter((t: TaskItem) => t.requirement !== "not_applicable");
    const activeProjectTasks = tasks.filter((t: TaskItem) => t.requirement !== "not_applicable");

    const thisWeek = activeProjectTasks.filter((t: TaskItem) => {
        const d = calculateCurrentWeek(t.created_at);
        return d === currentWeek && t.status !== "completed";
    });

    // Check if task exists in thisWeek
    const isThisWeek = (t: TaskItem) => thisWeek.some((w: TaskItem) => w.id === t.id);

    // action required tasks: action_required == true AND not completed AND NOT in this week
    const actionRequired = activeProjectTasks.filter((t: TaskItem) =>
        t.action_required === true &&
        t.status !== "completed" &&
        !isThisWeek(t)
    );

    // completed tasks
    const completed = activeProjectTasks.filter((t: TaskItem) => t.status === "completed");

    // Scorecard
    const totalTasks = visibleTasks.length;
    const completedCount = completed.length;
    const overdueCount = visibleTasks.filter(t => t.status === "pending" && t.targetWeek < currentWeek).length;

    return (
        <div className="space-y-6">
            {/* Top Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                    <SelectTrigger className="w-full sm:w-[300px]">
                        <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                        {projects.map((p: Project) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                                {p.Project_Name} {p.Status === "on_hold" ? "(On Hold)" : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Mini Scorecard */}
                <div className="flex gap-4 text-sm">
                    <div className="rounded-md border px-3 py-1.5 text-center">
                        <p className="text-xs text-slate-500">Week</p>
                        <p className="font-semibold">{currentWeek}</p>
                    </div>
                    <div className="rounded-md border px-3 py-1.5 text-center">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="font-semibold">{totalTasks}</p>
                    </div>
                    <div className="rounded-md border px-3 py-1.5 text-center">
                        <p className="text-xs text-slate-500">Done</p>
                        <p className="font-semibold text-green-600">{completedCount}</p>
                    </div>
                    <div className="rounded-md border px-3 py-1.5 text-center">
                        <p className="text-xs text-slate-500">Overdue</p>
                        <p className="font-semibold text-red-600">{overdueCount}</p>
                    </div>
                </div>
            </div>

            {/* Task Tabs */}
            <Tabs defaultValue="action-required" className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
                    <TabsTrigger value="action-required">
                        Action Required
                        {actionRequired.length > 0 && (
                            <Badge variant="destructive" className="ml-2">{actionRequired.length}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="this-week">
                        This Week
                        {thisWeek.length > 0 && (
                            <Badge variant="secondary" className="ml-2">{thisWeek.length}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="completed">
                        Completed
                        {completed.length > 0 && (
                            <Badge variant="outline" className="ml-2">{completed.length}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="action-required" className="mt-4 space-y-3">
                    {actionRequired.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No action required ✓</p>
                    ) : (
                        actionRequired.map((task: TaskItem) => (
                            <TaskCard key={task.id} task={task} currentWeek={currentWeek}
                                onStart={handleStart} onComplete={handleComplete}
                                onHold={handleHold} onResume={handleResume} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="this-week" className="mt-4 space-y-3">
                    {thisWeek.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No tasks for Week {currentWeek}</p>
                    ) : (
                        thisWeek.map((task: TaskItem) => (
                            <TaskCard key={task.id} task={task} currentWeek={currentWeek}
                                onStart={handleStart} onComplete={handleComplete}
                                onHold={handleHold} onResume={handleResume} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="completed" className="mt-4 space-y-3">
                    {completed.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No completed tasks yet.</p>
                    ) : (
                        completed.map((task: TaskItem) => (
                            <TaskCard key={task.id} task={task} currentWeek={currentWeek}
                                onStart={handleStart} onComplete={handleComplete}
                                onHold={handleHold} onResume={handleResume} />
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ---- Task Card Component ----

interface TaskCardProps {
    task: TaskItem;
    currentWeek: number;
    onStart: (id: string) => void;
    onComplete: (id: string) => void;
    onHold: (id: string) => void;
    onResume: (id: string) => void;
}

function TaskCard({ task, currentWeek, onStart, onComplete, onHold, onResume }: TaskCardProps) {
    const isOverdue = task.status === "pending" && task.targetWeek < currentWeek;

    const statusBadge = () => {
        switch (task.status) {
            case "completed": return <Badge className="bg-green-600 hover:bg-green-700 text-white">Completed</Badge>;
            case "in_progress": return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">In Progress</Badge>;
            case "on_hold": return <Badge variant="destructive">On Hold</Badge>;
            case "awaiting_approval": return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Awaiting Approval</Badge>;
            case "pending":
                return isOverdue
                    ? <Badge variant="destructive">Overdue</Badge>
                    : <Badge variant="outline">Pending</Badge>;
            default: return <Badge variant="outline">{task.status}</Badge>;
        }
    };

    return (
        <Card className={isOverdue ? "border-red-300 dark:border-red-800" : ""}>
            <CardHeader className="py-3 pb-1">
                <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-medium leading-tight">
                            {task.taskName || "Unnamed Task"}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                            {task.phase && <span className="mr-2">📂 {task.phase}</span>}
                            Week {task.targetWeek}
                            {task.actualAssigneeEmail && <span> • {task.actualAssigneeEmail}</span>}
                        </CardDescription>
                    </div>
                    {statusBadge()}
                </div>
            </CardHeader>
            <CardContent className="py-2 pb-3 flex justify-end gap-2">
                {task.status === "pending" && (
                    <Button size="sm" onClick={() => onStart(task.id)}>
                        Start Work
                    </Button>
                )}
                {task.status === "in_progress" && (
                    <>
                        <Button variant="outline" size="sm" onClick={() => onHold(task.id)}>
                            Hold
                        </Button>
                        <Button size="sm" onClick={() => onComplete(task.id)}>
                            Complete
                        </Button>
                    </>
                )}
                {task.status === "on_hold" && (
                    <Button size="sm" onClick={() => onResume(task.id)}>
                        Resume
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
