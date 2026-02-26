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
import { type User } from "@supabase/supabase-js";

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

export function TasksClientPage({ initialProjects }: { initialProjects: Project[]; user: User | null }) {
    const [activeProjectId, setActiveProjectId] = useState<string>(
        initialProjects.length > 0 ? initialProjects[0].id.toString() : ""
    );
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [loading, setLoading] = useState(false);
    const supabase = useMemo(() => createClient(), []);

    // Get active project's start date
    const activeProject = initialProjects.find(p => p.id.toString() === activeProjectId);
    const currentWeek = calculateCurrentWeek(activeProject?.Start_Date ?? null);


    useEffect(() => {
        if (!activeProjectId) return;

        // Fetch tasks
        const controller = new AbortController();
        supabase
            .from("tasks")
            .select("*")
            .eq("project_id", activeProjectId)
            .then(({ data }) => {
                if (!controller.signal.aborted && data) setTasks(data);
                setLoading(false);
            });

        // Realtime subscription
        const channel = supabase
            .channel(`tasks-rt-${activeProjectId}`)
            .on("postgres_changes",
                { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${activeProjectId}` },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        setTasks(prev => [...prev, payload.new]);
                    } else if (payload.eventType === "UPDATE") {
                        setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
                    } else if (payload.eventType === "DELETE") {
                        setTasks(prev => prev.filter(t => t.id !== payload.old.id));
                    }
                })
            .subscribe();

        return () => {
            controller.abort();
            supabase.removeChannel(channel);
        };
    }, [activeProjectId, supabase]);

    // Task action handlers
    const updateTaskStatus = async (taskId: string, status: string, extras: Record<string, string | null> = {}) => {
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
    const visibleTasks = tasks.filter(t => t.requirement !== "not_applicable");

    const actionRequired = visibleTasks.filter(t =>
        t.status === "in_progress" ||
        t.status === "on_hold" ||
        t.status === "awaiting_approval" ||
        (t.status === "pending" && t.targetWeek < currentWeek)
    );

    const thisWeek = visibleTasks.filter(t =>
        t.status === "pending" && t.targetWeek === currentWeek
    );

    const completed = visibleTasks.filter(t => t.status === "completed");

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
                        {initialProjects.map(p => (
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
                    {loading ? (
                        <p className="text-sm text-slate-400 py-8 text-center">Loading tasks...</p>
                    ) : actionRequired.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No action required ✓</p>
                    ) : (
                        actionRequired.map(task => (
                            <TaskCard key={task.id} task={task} currentWeek={currentWeek}
                                onStart={handleStart} onComplete={handleComplete}
                                onHold={handleHold} onResume={handleResume} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="this-week" className="mt-4 space-y-3">
                    {loading ? (
                        <p className="text-sm text-slate-400 py-8 text-center">Loading tasks...</p>
                    ) : thisWeek.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No tasks for Week {currentWeek}</p>
                    ) : (
                        thisWeek.map(task => (
                            <TaskCard key={task.id} task={task} currentWeek={currentWeek}
                                onStart={handleStart} onComplete={handleComplete}
                                onHold={handleHold} onResume={handleResume} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="completed" className="mt-4 space-y-3">
                    {loading ? (
                        <p className="text-sm text-slate-400 py-8 text-center">Loading tasks...</p>
                    ) : completed.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No completed tasks yet.</p>
                    ) : (
                        completed.map(task => (
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
