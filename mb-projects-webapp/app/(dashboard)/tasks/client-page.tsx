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
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Play, CheckCircle2, Pause, RotateCcw, UserPlus } from "lucide-react";
import useSWR from "swr";
import { cn, getISTDate } from "@/lib/utils";
import { isAdmin as checkIsAdmin, getRoleLabel } from "@/lib/auth";

// Types
type Project = { id: string | number; Project_Name: string; Start_Date: string | null; Project_Status: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskItem = Record<string, any>;

interface TaskData {
    kpis: {
        total: number;
        completed: number;
        overdue: number;
        late: number;
        score: number;
    };
    activeTasks: TaskItem[];
    completedTasks: TaskItem[];
    team: { name: string; email: string; role: string | string[] }[];
}

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
        if (!user?.email) return { user: null, role: ["employee"] };
        const { data: userData } = await supabase.from("users").select("role").eq("email", user.email).single();
        const role = Array.isArray(userData?.role) ? userData.role : [userData?.role || "employee"];
        return { user, role };
    });
    const user = session?.user || null;
    const role = session?.role || ["employee"];

    // 2. Fetch Projects (for the dropdown)
    const { data: projects = [] } = useSWR(
        user?.email ? ["tasks-projects", user.email, role] : null,
        async ([, email, uRole]) => {
            if (checkIsAdmin(uRole)) {
                const { data } = await supabase.from("projects").select("id, Project_Name, Start_Date, Project_Status");
                return data || [];
            } else {
                // Return projects where email is in any of the Project_* role columns
                // Using .or with mix of .eq for single values and .cs (contains) for array values
                const { data, error } = await supabase
                    .from("projects")
                    .select("id, Project_Name, Start_Date, Project_Status")
                    .or(`Project_RM.eq.${email},Project_RM2.eq.${email},Project_CDD.cs.{${email}},Project_FDD.cs.{${email}},Project_PC.cs.{${email}},Project_AM.cs.{${email}}`);
                if (error) {
                    console.error("Error fetching projects for user:", error);
                    return [];
                }
                return data || [];
            }
        }
    );

    const [activeProjectId, setActiveProjectId] = useState<string>("");
    const [showCompleted, setShowCompleted] = useState(false);
    const [showNextWeek, setShowNextWeek] = useState(false);
    const [assignMode, setAssignMode] = useState(false);
    const [remarksTaskId, setRemarksTaskId] = useState<string | null>(null);

    const activeProject = projects.find((p: Project) => p.id.toString() === activeProjectId);
    const currentWeek = calculateCurrentWeek(activeProject?.Start_Date ?? null);

    // Set initial active project if not set once projects load
    useEffect(() => {
        if (!activeProjectId && projects.length > 0) {
            setActiveProjectId(projects[0].id.toString());
        }
    }, [projects, activeProjectId]);

    // Helper for late tasks
    const isTaskLate = (task: TaskItem, startDate: string | null) => {
        if (!task.endTime || !startDate) return false;
        const end = new Date(task.endTime);
        const start = new Date(startDate);
        const diffMs = end.getTime() - start.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const finishedWeek = Math.floor(diffDays / 7) + 1;
        return finishedWeek > task.targetWeek;
    };

    // 3. Fetch Tasks
    const { data: tasksData, mutate } = useSWR<TaskData | null>(
        activeProjectId ? ["tasks-data", activeProjectId, currentWeek] : null,
        async ([, projId, cWeek]: [string, string, number]): Promise<TaskData> => {
            const [projRes, activeRes, completedRes, usersRes] = await Promise.all([
                supabase.from("projects").select("*").eq("id", projId).single(),
                supabase.from("tasks")
                    .select("*")
                    .eq("project_id", projId)
                    .or("requirement.neq.not_applicable,requirement.is.null")
                    .neq("status", "completed")
                    .limit(1000),
                supabase.from("tasks")
                    .select("*")
                    .eq("project_id", projId)
                    .or("requirement.neq.not_applicable,requirement.is.null")
                    .eq("status", "completed")
                    .order("created_at", { ascending: false })
                    .limit(500),
                supabase.from("users").select("name, email, role")
            ]);

            const pData = projRes.data;
            const act = (activeRes.data as TaskItem[]) || [];
            const cmp = (completedRes.data as TaskItem[]) || [];
            const all = [...act, ...cmp];

            // Team members for this project
            const projectTeam: { name: string; email: string; role: string }[] = [];
            if (pData) {
                const teamFields = [
                    "Project_RM", "Project_RM2", "Project_FDD", "Project_Sec", "Project_PC",
                    "Project_AM", "Project_Additional_mem_1", "Project_Additional_mem_2", "Project_Additional_mem_3"
                ];
                teamFields.forEach(f => {
                    if (pData[f]) {
                        let emails: string[] = [];
                        if (Array.isArray(pData[f])) {
                            emails = pData[f];
                        } else if (typeof pData[f] === "string" && pData[f].trim() !== "") {
                            emails = pData[f].split(",").map((e: string) => typeof e === "string" ? e.trim() : "").filter(Boolean);
                        }

                        emails.forEach((email: string) => {
                            if (!email) return;
                            const u = (usersRes.data || []).find(user => user.email === email);
                            projectTeam.push({
                                name: u?.name || email,
                                email,
                                role: f.replace("Project_", "").replace("_", " ")
                            });
                        });
                    }
                });
            }

            // KPIs
            const total = all.length;
            const done = cmp.length;
            const overdue = act.filter(t => t.status === "pending" && t.targetWeek < cWeek).length;
            const late = cmp.filter(t => isTaskLate(t, pData?.Start_Date)).length;
            const score = (done - total) * 10;

            return {
                kpis: { total, completed: done, overdue, late, score },
                activeTasks: act,
                completedTasks: cmp,
                team: projectTeam
            };
        },
        { fallbackData: null }
    );

    // 4. Realtime Subscription for tasks
    useEffect(() => {
        if (!activeProjectId) return;

        const channel = supabase
            .channel(`tasks-rt-${activeProjectId}`)
            .on("postgres_changes",
                { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${activeProjectId}` },
                () => {
                    mutate();
                })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeProjectId, supabase, mutate]);

    // Task action handlers
    const updateTaskStatus = async (taskId: string, status: string, extras: Record<string, string | null> = {}) => {
        // Optimistic update
        mutate((prev: TaskData | null | undefined) => {
            if (!prev) return prev;
            const act = [...prev.activeTasks];
            const cmp = [...prev.completedTasks];
            const kpis = { ...prev.kpis };
            const team = [...prev.team];

            const actIdx = act.findIndex(t => t.id === taskId);
            if (actIdx > -1) {
                if (status === "completed") {
                    const [t] = act.splice(actIdx, 1);
                    cmp.unshift({ ...t, status, ...extras });
                    kpis.completed += 1;
                    // Logic for late update would be complex here, mutate() after will fix
                } else {
                    act[actIdx] = { ...act[actIdx], status, ...extras };
                }
            } else {
                const cmpIdx = cmp.findIndex(t => t.id === taskId);
                if (cmpIdx > -1) {
                    if (status !== "completed") {
                        const [t] = cmp.splice(cmpIdx, 1);
                        act.push({ ...t, status, ...extras });
                        kpis.completed = Math.max(0, kpis.completed - 1);
                    } else {
                        cmp[cmpIdx] = { ...cmp[cmpIdx], status, ...extras };
                    }
                }
            }

            return { kpis, activeTasks: act, completedTasks: cmp, team };
        }, false);

        await supabase
            .from("tasks")
            .update({ status, ...extras, updated_at: getISTDate() })
            .eq("id", taskId);

        mutate();
    };

    const handleAssignChange = async (taskId: string, email: string) => {
        await supabase.from("tasks").update({ actualAssigneeEmail: email, updated_at: getISTDate() }).eq("id", taskId);
        mutate();
    };

    const handleStart = (taskId: string) =>
        updateTaskStatus(taskId, "in_progress", { startTime: getISTDate() });

    const handleComplete = (taskId: string) =>
        updateTaskStatus(taskId, "completed", { endTime: getISTDate() });

    const handleHold = (taskId: string) =>
        updateTaskStatus(taskId, "on_hold");

    const handleResume = (taskId: string) =>
        updateTaskStatus(taskId, "in_progress");

    // Computed Data
    const data = tasksData || { kpis: { total: 0, completed: 0, overdue: 0, late: 0, score: 0 }, activeTasks: [], completedTasks: [], team: [] };
    const { kpis, activeTasks, completedTasks: completed, team } = data;

    const actionRequired = activeTasks.filter((t: TaskItem) =>
        t.status === "in_progress" ||
        t.status === "on_hold" ||
        t.status === "awaiting_approval" ||
        (t.status === "pending" && t.targetWeek < currentWeek)
    );

    const thisWeek = activeTasks.filter((t: TaskItem) =>
        t.status === "pending" && t.targetWeek === currentWeek
    );

    const nextWeek = activeTasks.filter((t: TaskItem) =>
        t.targetWeek === currentWeek + 1
    );

    const isAdminRole = checkIsAdmin(role);
    const isRMOrAdmin = (Array.isArray(role) ? role.includes("RM") : role === "RM") || isAdminRole;

    return (
        <div className="space-y-4 -mt-2">
            {/* Page Header / Subtext */}
            <div className="pb-2 border-b border-slate-100">
                <p className="text-sm text-slate-500 font-medium">
                    Manage your tasks, view action required items, and track weekly progress.
                </p>
            </div>

            {/* Top Controls & Box-Style Scorecard */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
                    <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                        <SelectTrigger className="w-full sm:w-[280px] bg-white shadow-sm border-slate-200 h-9">
                            <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map((p: Project) => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.Project_Name} {p.Project_Status === "on_hold" ? "⏸" : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {isRMOrAdmin && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button
                                variant={assignMode ? "default" : "outline"}
                                size="sm"
                                onClick={() => setAssignMode(!assignMode)}
                                className={cn(
                                    "h-9 px-3 text-xs font-bold",
                                    assignMode ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-white"
                                )}
                            >
                                <UserPlus className="mr-2 h-3.5 w-3.5" />
                                {assignMode ? "✓ Done" : "Assign Mode"}
                            </Button>
                            <Button
                                variant={showNextWeek ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowNextWeek(!showNextWeek)}
                                className="h-9 px-3 text-xs bg-white"
                            >
                                {showNextWeek ? "Hide Next" : "Show Next"}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Box-Style Scorecard */}
                {!checkIsAdmin(role) && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <MetricBox label="Week" value={currentWeek} />
                        <MetricBox label="Total" value={kpis.total} />
                        <MetricBox label="Done" value={kpis.completed} color="text-green-600" />
                        <MetricBox label="Overdue" value={kpis.overdue} color="text-red-600" />
                    </div>
                )}
            </div>

            {/* Sections */}
            <div className="space-y-8 mt-2">
                {/* Action Required */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                        <h2 className="text-xl font-bold text-slate-800">Action Required</h2>
                        {actionRequired.length > 0 && (
                            <Badge variant="destructive">{actionRequired.length}</Badge>
                        )}
                    </div>
                    <div className="grid gap-3">
                        {actionRequired.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4 italic">No action required ✓</p>
                        ) : (
                            actionRequired.map((task: TaskItem) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    currentWeek={currentWeek}
                                    team={team}
                                    assignMode={assignMode}
                                    onStart={handleStart}
                                    onComplete={handleComplete}
                                    onHold={handleHold}
                                    onResume={handleResume}
                                    onAssign={handleAssignChange}
                                    onOpenRemarks={setRemarksTaskId}
                                />
                            ))
                        )}
                    </div>
                </section>

                {/* This Week */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                        <h2 className="text-xl font-bold text-slate-800">This Week (Week {currentWeek})</h2>
                        {thisWeek.length > 0 && (
                            <Badge variant="secondary">{thisWeek.length}</Badge>
                        )}
                    </div>
                    <div className="grid gap-3">
                        {thisWeek.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4 italic">No tasks for this week</p>
                        ) : (
                            thisWeek.map((task: TaskItem) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    currentWeek={currentWeek}
                                    team={team}
                                    assignMode={assignMode}
                                    onStart={handleStart}
                                    onComplete={handleComplete}
                                    onHold={handleHold}
                                    onResume={handleResume}
                                    onAssign={handleAssignChange}
                                    onOpenRemarks={setRemarksTaskId}
                                />
                            ))
                        )}
                    </div>
                </section>

                {/* Next Week (Conditional) */}
                {showNextWeek && isRMOrAdmin && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                            <h2 className="text-xl font-bold text-slate-800">Next Week (Week {currentWeek + 1})</h2>
                            {nextWeek.length > 0 && (
                                <Badge variant="outline">{nextWeek.length}</Badge>
                            )}
                        </div>
                        <div className="grid gap-3">
                            {nextWeek.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 italic">No tasks for next week</p>
                            ) : (
                                nextWeek.map((task: TaskItem) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        currentWeek={currentWeek}
                                        team={team}
                                        assignMode={assignMode}
                                        onStart={handleStart}
                                        onComplete={handleComplete}
                                        onHold={handleHold}
                                        onResume={handleResume}
                                        onAssign={handleAssignChange}
                                        onOpenRemarks={setRemarksTaskId}
                                    />
                                ))
                            )}
                        </div>
                    </section>
                )}

                {/* Completed Tasks */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-800">Completed</h2>
                            {completed.length > 0 && (
                                <Badge variant="outline">{completed.length}</Badge>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCompleted(!showCompleted)}
                        >
                            {showCompleted ? "Hide" : "Show"}
                        </Button>
                    </div>
                    {showCompleted && (
                        <div className="grid gap-3">
                            {completed.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 italic">No completed tasks yet.</p>
                            ) : (
                                completed.map((task: TaskItem) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        currentWeek={currentWeek}
                                        team={team}
                                        assignMode={assignMode}
                                        onStart={handleStart}
                                        onComplete={handleComplete}
                                        onHold={handleHold}
                                        onResume={handleResume}
                                        onAssign={handleAssignChange}
                                        onOpenRemarks={setRemarksTaskId}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </section>
            </div>

            {/* Remarks Modal Side-panel / Modal */}
            {remarksTaskId && (
                <RemarksModal
                    taskId={remarksTaskId}
                    taskName={activeTasks.find(t => t.id === remarksTaskId)?.taskName || completed.find(t => t.id === remarksTaskId)?.taskName}
                    remarks={activeTasks.find(t => t.id === remarksTaskId)?.remarks || completed.find(t => t.id === remarksTaskId)?.remarks || []}
                    onClose={() => setRemarksTaskId(null)}
                    onSave={async (newRemarks) => {
                        await supabase.from("tasks").update({ remarks: newRemarks, updated_at: getISTDate() }).eq("id", remarksTaskId);
                        mutate();
                    }}
                />
            )}
        </div>
    );
}

// ---- Task Card Component ----

interface TaskCardProps {
    task: TaskItem;
    currentWeek: number;
    team: { name: string; email: string; role: string | string[] }[];
    assignMode: boolean;
    onStart: (id: string) => void;
    onComplete: (id: string) => void;
    onHold: (id: string) => void;
    onResume: (id: string) => void;
    onAssign: (taskId: string, email: string) => void;
    onOpenRemarks: (taskId: string) => void;
}

function TaskCard({
    task,
    currentWeek,
    team,
    assignMode,
    onStart,
    onComplete,
    onHold,
    onResume,
    onAssign,
    onOpenRemarks
}: TaskCardProps) {
    const isOverdue = task.status === "pending" && task.targetWeek < currentWeek;
    const hasRemarks = task.remarks && task.remarks.length > 0;

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
        <Card className={cn(
            "transition-shadow hover:shadow-md",
            isOverdue ? "border-red-300 dark:border-red-800" : "",
            task.status === "completed" ? "opacity-75" : ""
        )}>
            <CardHeader className="py-3 pb-1 px-4">
                <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-semibold leading-tight truncate">
                                {task.taskName || "Unnamed Task"}
                            </CardTitle>
                            <button
                                onClick={() => onOpenRemarks(task.id)}
                                className={cn(
                                    "p-1 rounded-full hover:bg-slate-100 relative transition-colors",
                                    hasRemarks ? "text-orange-600" : "text-slate-400"
                                )}
                            >
                                <MessageSquare className="h-4 w-4" />
                                {hasRemarks && (
                                    <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full border border-white" />
                                )}
                            </button>
                        </div>
                        <CardDescription className="mt-1 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
                            {task.phase && <span className="flex items-center">📂 {task.phase}</span>}
                            <span>Week {task.targetWeek}</span>
                            {!assignMode && task.actualAssigneeEmail && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 bg-slate-100 text-slate-600 border-none font-medium">
                                    {team.find(u => u.email === task.actualAssigneeEmail)?.name || task.actualAssigneeEmail}
                                </Badge>
                            )}
                        </CardDescription>
                    </div>
                    {statusBadge()}
                </div>
            </CardHeader>
            <CardContent className="py-2 pb-3 px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="w-full sm:w-auto">
                    {assignMode && (
                        <Select
                            value={task.actualAssigneeEmail || ""}
                            onValueChange={(val) => onAssign(task.id, val)}
                        >
                            <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs">
                                <SelectValue placeholder="Assign member..." />
                            </SelectTrigger>
                            <SelectContent>
                                {team.map((member) => (
                                    <SelectItem key={member.email} value={member.email} className="text-xs">
                                        {member.name} ({getRoleLabel(member.role)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {task.status === "pending" && (
                        <Button size="sm" onClick={() => onStart(task.id)} className="h-8 gap-1.5">
                            <Play className="h-3.5 w-3.5" /> Start Work
                        </Button>
                    )}
                    {task.status === "in_progress" && (
                        <>
                            <Button variant="outline" size="sm" onClick={() => onHold(task.id)} className="h-8 gap-1.5">
                                <Pause className="h-3.5 w-3.5" /> Hold
                            </Button>
                            <Button size="sm" onClick={() => onComplete(task.id)} className="h-8 gap-1.5 bg-green-600 hover:bg-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                            </Button>
                        </>
                    )}
                    {task.status === "on_hold" && (
                        <Button size="sm" onClick={() => onResume(task.id)} className="h-8 gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5" /> Resume
                        </Button>
                    )}
                    {task.status === "completed" && (
                        <Button variant="outline" size="sm" onClick={() => onHold(task.id)} className="h-8 gap-1.5">
                            Reopen
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ---- Remarks Modal Component ----

interface RemarksModalProps {
    taskId: string;
    taskName: string;
    remarks: { user: string; text: string; time: string }[];
    onClose: () => void;
    onSave: (newRemarks: any[]) => Promise<void>;
}

function RemarksModal({ taskId, taskName, remarks, onClose, onSave }: RemarksModalProps) {
    const [newRemark, setNewRemark] = useState("");
    const [userName, setUserName] = useState("Unidentified User");

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                const { data } = await supabase.from("users").select("name").eq("email", user.email).single();
                setUserName(data?.name || user.email);
            }
        };
        fetchUser();
    }, []);

    const handleSend = async () => {
        if (!newRemark.trim()) return;
        const updatedRemarks = [
            ...remarks,
            {
                user: userName,
                text: newRemark.trim(),
                time: getISTDate()
            }
        ];
        await onSave(updatedRemarks);
        setNewRemark("");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md bg-white dark:bg-slate-950 flex flex-col max-h-[80vh] shadow-2xl overflow-hidden border-none">
                <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-base truncate max-w-[200px]">{taskName}</CardTitle>
                            <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Task Remarks</CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
                        <RotateCcw className="h-4 w-4 rotate-45" />
                    </Button>
                </CardHeader>
                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-4">
                        {remarks.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8 italic font-light">No remarks yet. Start the conversation!</p>
                        ) : (
                            remarks.map((r, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{r.user}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-800">
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{r.text}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t flex flex-col gap-3">
                    <textarea
                        className="w-full p-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all resize-none shadow-sm"
                        placeholder="Add a remark or comment..."
                        rows={2}
                        value={newRemark}
                        onChange={(e) => setNewRemark(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <div className="flex justify-end">
                        <Button
                            onClick={handleSend}
                            disabled={!newRemark.trim()}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg px-6"
                        >
                            Send Message
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// --- Metric Box ---
function MetricBox({ label, value, color = "text-slate-900" }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-w-[70px] h-[54px] bg-white border border-slate-200 rounded-lg shadow-sm">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">{label}</span>
            <span className={cn("text-lg font-bold leading-none mt-0.5", color)}>{value}</span>
        </div>
    );
}
