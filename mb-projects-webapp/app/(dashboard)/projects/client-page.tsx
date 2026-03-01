"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO, isValid } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Calendar as CalendarIcon, Users, Clock, FolderPlus, X, CircleCheckBig, ChevronDown } from "lucide-react";
import { cn, getISTDate } from "@/lib/utils";
import { type User as SupabaseUser } from "@supabase/supabase-js";

import { isAdmin as checkIsAdmin } from "@/lib/auth";
import useSWR from "swr";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectItem = Record<string, any>;
type UserItem = { name: string; email: string; role: string | string[] };

interface ProjectsClientPageProps {
    initialUser: SupabaseUser | null;
    initialRole: string | string[] | null;
}

export function ProjectsClientPage({ initialUser, initialRole }: ProjectsClientPageProps) {
    const supabase = useMemo(() => createClient(), []);
    const searchParams = useSearchParams();

    const userRole = Array.isArray(initialRole) ? initialRole : [initialRole || "employee"];
    const isAdmin = checkIsAdmin(userRole);

    // Fetch all users
    const { data: allUsers = [] } = useSWR("allUsers", async () => {
        const { data } = await supabase.from("users").select("name, email, role");
        return data || [];
    });

    // Helper to check for a specific role
    const hasRole = (userRole: string | string[] | undefined, targetRole: string) => {
        if (!userRole) return false;
        if (Array.isArray(userRole)) return userRole.includes(targetRole);
        return userRole === targetRole;
    };


    // Fetch projects
    const { data: projects = [], mutate } = useSWR(
        "projects",
        async () => {
            const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
            if (error) {
                console.error("Error fetching projects details:", error);
                console.error("Error JSON:", JSON.stringify(error));
                return [];
            }
            // Deduplicate by ID to prevent "duplicate key" errors
            const uniqueData = (data || []).reduce((acc: ProjectItem[], p) => {
                if (!acc.find(x => x.id === p.id)) acc.push(p);
                return acc;
            }, []);
            return uniqueData;
        },
        { fallbackData: [] }
    );

    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        if (searchParams.get("action") === "add" && isAdmin) {
            setShowAddForm(true);
        }
    }, [searchParams, isAdmin]);

    // Setup realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("projects-rt")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "projects" },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        mutate((prev: ProjectItem[] = []) => {
                            if (prev.some(p => p.id === payload.new.id)) return prev;
                            return [payload.new, ...prev];
                        }, false);
                    } else if (payload.eventType === "UPDATE") {
                        mutate((prev: ProjectItem[] = []) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)), false);
                    } else if (payload.eventType === "DELETE") {
                        mutate((prev: ProjectItem[] = []) => prev.filter((p) => p.id !== payload.old.id), false);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, mutate]);

    const [addLoading, setAddLoading] = useState(false);
    const [newProject, setNewProject] = useState<{
        Project_Name: string;
        Start_Date: string;
        Project_RM: string;
        Project_RM2: string[];
        Project_FDD: string[];
        Project_CDD: string[];
        Project_PC: string[];
        Project_AM: string[];
    }>({
        Project_Name: "",
        Start_Date: "",
        Project_RM: "",
        Project_RM2: [],
        Project_FDD: [],
        Project_CDD: [],
        Project_PC: [],
        Project_AM: [],
    });

    // Filter users by role
    const rmUsers = useMemo(() => allUsers.filter(u => hasRole(u.role, "RM")), [allUsers]);
    const fddUsers = useMemo(() => allUsers.filter(u => hasRole(u.role, "FDD")), [allUsers]);
    const cddUsers = useMemo(() => allUsers.filter(u => hasRole(u.role, "CDD")), [allUsers]);
    const pcUsers = useMemo(() => allUsers.filter(u => hasRole(u.role, "PC")), [allUsers]);
    const amUsers = useMemo(() => allUsers.filter(u => hasRole(u.role, "AM")), [allUsers]);

    // RM2 options should exclude the primary RM
    const rm2Options = useMemo(() => {
        return rmUsers.filter(u => u.email !== newProject.Project_RM);
    }, [rmUsers, newProject.Project_RM]);

    const [confirmingStatus, setConfirmingStatus] = useState<{ id: string; status: string; name: string; stats?: { total: number; completed: number; pending: number } } | null>(null);
    const [datePopoverOpen, setDatePopoverOpen] = useState(false);

    // Filter projects by status
    const activeProjects = projects.filter(p =>
        (p.Project_Status || p.Status) === "active"
    );
    const onHoldProjects = projects.filter(p =>
        (p.Project_Status || p.Status) === "on_hold"
    );
    const completedProjects = projects.filter(p =>
        (p.Project_Status || p.Status) === "completed"
    );

    const triggerStatusChange = async (projectId: string, newStatus: string, projectName: string) => {
        if (newStatus === "completed") {
            const { data } = await supabase.from("tasks").select("status").eq("project_id", projectId).or("requirement.neq.not_applicable,requirement.is.null");
            const total = data?.length || 0;
            const completed = data?.filter(t => t.status === "completed").length || 0;
            const pending = total - completed;
            setConfirmingStatus({ id: projectId, status: newStatus, name: projectName, stats: { total, completed, pending } });
        } else {
            setConfirmingStatus({ id: projectId, status: newStatus, name: projectName });
        }
    };

    const handleStatusChange = async (projectId: string, newStatus: string) => {
        const updates: Record<string, string | null> = {
            Project_Status: newStatus
        };
        if (newStatus === "completed") {
            updates.completionTime = getISTDate();
        }

        // Optimistic update with deduplication check
        mutate((prev: ProjectItem[] = []) => {
            const exists = prev.some(p => p.id === projectId);
            if (!exists) return prev; // Should not happen for status change
            return prev.map(p => p.id === projectId ? { ...p, ...updates } : p);
        }, false);

        const { error } = await supabase.from("projects").update(updates).eq("id", projectId);
        if (error) {
            console.error("Error updating project status:", error);
            alert("Failed to update project status. Please check your connection.");
            mutate(); // Revert optimistic update
        }
    };

    const generateProjectId = () => {
        const existingIds = projects.map(p => p.id).filter((id: string) => /^PR\d+$/.test(id));
        let maxNum = 0;
        existingIds.forEach((id: string) => {
            const num = parseInt(id.replace("PR", ""), 10);
            if (num > maxNum) maxNum = num;
        });
        return `PR${String(maxNum + 1).padStart(3, "0")}`;
    };

    const handleAddProject = async () => {
        if (!newProject.Project_Name.trim() || !newProject.Start_Date) {
            alert("Project Name and Start Date are required.");
            return;
        }
        setAddLoading(true);
        try {
            const projectId = generateProjectId();
            const projectData = {
                id: projectId,
                Project_Name: newProject.Project_Name.trim(),
                Start_Date: new Date(newProject.Start_Date).toISOString(),
                Project_Status: "active",
                Project_RM: newProject.Project_RM || null,
                Project_RM2: newProject.Project_RM2,
                Project_FDD: newProject.Project_FDD,
                Project_CDD: newProject.Project_CDD,
                Project_PC: newProject.Project_PC,
                Project_AM: newProject.Project_AM,
                created_at: getISTDate()
            };

            const { data, error } = await supabase.from("projects").insert([projectData]).select();
            if (error) throw error;

            mutate((prev: ProjectItem[] = []) => {
                // Ensure we don't add a project that's already in the list (prevents duplicate key errors)
                if (prev.some(p => p.id === data[0].id)) return prev;
                return [data[0], ...prev];
            }, false);
            setShowAddForm(false);
            setNewProject({
                Project_Name: "",
                Start_Date: "",
                Project_RM: "",
                Project_RM2: [],
                Project_FDD: [],
                Project_CDD: [],
                Project_PC: [],
                Project_AM: [],
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            alert("Failed to add project: " + msg);
        } finally {
            setAddLoading(false);
        }
    };

    return (
        <div className="space-y-4 -mt-4">
            {/* Summary Cards */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <SummaryCard title="Total Projects" value={projects.length} icon={<Building2 className="h-4 w-4 text-slate-500" />} />
                <SummaryCard title="Active" value={activeProjects.length} icon={<Clock className="h-4 w-4 text-green-500" />} />
                <SummaryCard title="On Hold" value={onHoldProjects.length} icon={<CalendarIcon className="h-4 w-4 text-amber-500" />} />
                <SummaryCard title="Completed" value={completedProjects.length} icon={<CircleCheckBig className="h-4 w-4 text-green-600" />} />
            </div>


            {/* Add Project Form */}
            {showAddForm && isAdmin && (
                <Card className="border-2 border-blue-200 dark:border-blue-800 mb-6 overflow-hidden bg-blue-50/20 py-0 gap-0">
                    <CardHeader className="p-4 px-6 pb-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-lg leading-none">Add New Project</CardTitle>
                                <Badge variant="outline" className="font-mono text-[10px] text-slate-500">{generateProjectId()}</Badge>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)} className="h-8 w-8 p-0">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="px-6 pt-0 pb-5">
                        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                            {/* Row 1: Project Name & Date */}
                            <div className="space-y-2">
                                <Label htmlFor="proj-name">Project Name *</Label>
                                <Input
                                    id="proj-name"
                                    placeholder="Enter project name"
                                    value={newProject.Project_Name}
                                    onChange={(e) => setNewProject(prev => ({ ...prev, Project_Name: e.target.value }))}
                                    className="h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Start Date *</Label>
                                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "h-10 w-full justify-start text-left font-normal bg-white dark:bg-slate-950 px-3",
                                                !newProject.Start_Date && "text-slate-500"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                                            {newProject.Start_Date ? (
                                                isValid(parseISO(newProject.Start_Date)) ? (
                                                    format(parseISO(newProject.Start_Date), "do MMMM yyyy")
                                                ) : (
                                                    newProject.Start_Date
                                                )
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            captionLayout="dropdown"
                                            fromYear={2020}
                                            toYear={2035}
                                            selected={newProject.Start_Date ? parseISO(newProject.Start_Date) : undefined}
                                            onSelect={(date) => {
                                                if (date) {
                                                    // Store as YYYY-MM-DD for database compatibility
                                                    setNewProject(prev => ({
                                                        ...prev,
                                                        Start_Date: format(date, "yyyy-MM-dd")
                                                    }));
                                                    setDatePopoverOpen(false);
                                                }
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Row 2: RM & RM2 */}
                            <div className="space-y-2">
                                <Label>Relationship Manager *</Label>
                                <Select
                                    value={newProject.Project_RM || ""}
                                    onValueChange={(val) => {
                                        if (newProject.Project_RM2.includes(val)) {
                                            alert("This user is already selected as an Additional Relationship Manager.");
                                            return;
                                        }
                                        setNewProject(prev => ({ ...prev, Project_RM: val }));
                                    }}
                                >
                                    <SelectTrigger className="h-10 w-full bg-white dark:bg-slate-950">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rmUsers.map((u: UserItem) => (
                                            <SelectItem key={u.email} value={u.email}>
                                                {u.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <MultiSelect
                                label="Additional Relationship Manager"
                                options={rm2Options}
                                selected={newProject.Project_RM2}
                                onChange={(val) => setNewProject(prev => ({ ...prev, Project_RM2: val }))}
                            />

                            {/* Row 3: PC & FDD */}
                            <MultiSelect
                                label="Project Coordinator"
                                options={pcUsers}
                                selected={newProject.Project_PC}
                                onChange={(val) => setNewProject(prev => ({ ...prev, Project_PC: val }))}
                            />
                            <MultiSelect
                                label="Financial Due Diligence"
                                options={fddUsers}
                                selected={newProject.Project_FDD}
                                onChange={(val) => setNewProject(prev => ({ ...prev, Project_FDD: val }))}
                            />

                            {/* Row 4: CDD & AM */}
                            <MultiSelect
                                label="Customer Due Diligence"
                                options={cddUsers}
                                selected={newProject.Project_CDD}
                                onChange={(val) => setNewProject(prev => ({ ...prev, Project_CDD: val }))}
                            />
                            <MultiSelect
                                label="Account Manager"
                                options={amUsers}
                                selected={newProject.Project_AM}
                                onChange={(val) => setNewProject(prev => ({ ...prev, Project_AM: val }))}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-1">
                            <Button variant="outline" onClick={() => setShowAddForm(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddProject}
                                disabled={addLoading}
                                className="bg-slate-900 text-white hover:bg-slate-800"
                            >
                                {addLoading ? "Creating..." : "Create Project"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Project Tabs & Actions */}
            <Tabs defaultValue="active" className="w-full">
                <div className="flex items-center justify-between gap-4 mb-4">
                    <TabsList className="grid w-full grid-cols-3 lg:w-[450px]">
                        <TabsTrigger value="active">
                            Active
                            {activeProjects.length > 0 && <Badge variant="secondary" className="ml-2">{activeProjects.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="on-hold">
                            On Hold
                            {onHoldProjects.length > 0 && <Badge variant="outline" className="ml-2">{onHoldProjects.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="completed">
                            Completed
                            {completedProjects.length > 0 && <Badge variant="outline" className="ml-2">{completedProjects.length}</Badge>}
                        </TabsTrigger>
                    </TabsList>

                    {isAdmin && (
                        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2 h-9">
                            <FolderPlus className="h-4 w-4" />
                            Add Project
                        </Button>
                    )}
                </div>

                <TabsContent value="active" className="mt-4 space-y-3">
                    {activeProjects.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No active projects.</p>
                    ) : (
                        activeProjects.map((project: ProjectItem) => (
                            <ProjectCard key={project.id} project={project} isAdmin={isAdmin}
                                onStatusChange={triggerStatusChange} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="on-hold" className="mt-4 space-y-3">
                    {onHoldProjects.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No projects on hold.</p>
                    ) : (
                        onHoldProjects.map((project: ProjectItem) => (
                            <ProjectCard key={project.id} project={project} isAdmin={isAdmin}
                                onStatusChange={triggerStatusChange} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="completed" className="mt-4 space-y-3">
                    {completedProjects.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No completed projects.</p>
                    ) : (
                        completedProjects.map((project: ProjectItem) => (
                            <ProjectCard key={project.id} project={project} isAdmin={isAdmin}
                                onStatusChange={triggerStatusChange} />
                        ))
                    )}
                </TabsContent>
            </Tabs>

            {/* Confirmation Dialog */}
            {confirmingStatus && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {confirmingStatus.status === "completed" ? (
                                    <CircleCheckBig className="h-5 w-5 text-green-600" />
                                ) : (
                                    <Clock className="h-5 w-5 text-amber-500" />
                                )}
                                Confirm Status Change
                            </CardTitle>
                            <CardDescription>
                                Are you sure you want to mark <span className="font-bold text-slate-900 dark:text-white uppercase px-1">{confirmingStatus.name}</span> as <span className="font-bold text-slate-900 dark:text-white uppercase">{confirmingStatus.status.replace("_", " ")}</span>?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {confirmingStatus.stats && (
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-800 space-y-3">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project Task Summary</p>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                                            <p className="text-xs text-slate-500">Total</p>
                                            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{confirmingStatus.stats.total}</p>
                                        </div>
                                        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                                            <p className="text-xs text-green-600">Done</p>
                                            <p className="text-lg font-bold text-green-600">{confirmingStatus.stats.completed}</p>
                                        </div>
                                        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                                            <p className="text-xs text-orange-600">Pending</p>
                                            <p className="text-lg font-bold text-orange-600">{confirmingStatus.stats.pending}</p>
                                        </div>
                                    </div>
                                    {confirmingStatus.stats.pending > 0 ? (
                                        <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                                            <Clock className="h-3 w-3" />
                                            <span>Note: {confirmingStatus.stats.pending} tasks are still pending.</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                            <CircleCheckBig className="h-3 w-3" />
                                            <span>Success! All tasks for this project are completed.</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                        <div className="flex justify-end gap-3 p-6 pt-0">
                            <Button variant="ghost" onClick={() => setConfirmingStatus(null)}>Cancel</Button>
                            <Button
                                className={cn(
                                    confirmingStatus.status === "completed" ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700",
                                    "text-white"
                                )}
                                onClick={() => {
                                    handleStatusChange(confirmingStatus.id, confirmingStatus.status);
                                    setConfirmingStatus(null);
                                }}
                            >
                                Confirm Change
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

// --- MultiSelect Dropdown ---
function MultiSelect({ label, options, selected, onChange }: {
    label: string,
    options: UserItem[],
    selected: string[],
    onChange: (emails: string[]) => void
}) {
    const [open, setOpen] = useState(false);
    const displayLabel = useMemo(() => {
        if (selected.length === 0) return "Select";
        return selected
            .map(email => {
                const user = options.find(u => u.email === email);
                return user?.name ? user.name.split(" ")[0] : email;
            })
            .join(", ");
    }, [selected, options]);

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-between font-normal px-3 bg-white dark:bg-slate-950">
                        <span className="truncate">
                            {displayLabel}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 max-h-80 overflow-hidden flex flex-col p-0" align="start">
                    <ScrollArea className="flex-1 overflow-y-auto p-1">
                        <div className="space-y-px">
                            {options.map((option) => (
                                <DropdownMenuCheckboxItem
                                    key={option.email}
                                    checked={selected.includes(option.email)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            onChange([...selected, option.email]);
                                        } else {
                                            onChange(selected.filter(e => e !== option.email));
                                        }
                                    }}
                                    className="cursor-pointer"
                                >
                                    {option.name}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </div>
                    </ScrollArea>
                    <DropdownMenuSeparator className="m-0" />
                    <div className="p-2 bg-slate-50 dark:bg-slate-900/50">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs font-semibold bg-white dark:bg-slate-950 border-slate-300"
                            onClick={() => setOpen(false)}
                        >
                            Done
                        </Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

// --- Summary Card ---
function SummaryCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
    return (
        <Card className="shadow-sm border-slate-200 bg-white dark:bg-slate-900/50 h-[72px] py-0 gap-0">
            <CardContent className="p-4 py-2 flex flex-col justify-center h-full">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</span>
                        <div className="opacity-70">
                            {icon}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// --- Project Card ---
function ProjectCard({ project, isAdmin, onStatusChange }: {
    project: ProjectItem;
    isAdmin: boolean;
    onStatusChange: (id: string, status: string, name: string) => void;
}) {
    const status = project.Project_Status || project.Status || "active";
    const startDate = project.Start_Date
        ? new Date(project.Start_Date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "No start date";

    // Build team summary
    const teamRoles = [
        { label: "RM", value: project.Project_RM },
        { label: "RM2", value: project.Project_RM2 },
        { label: "FDD", value: project.Project_FDD },
        { label: "CDD", value: project.Project_CDD },
        { label: "PC", value: project.Project_PC },
        { label: "AM", value: project.Project_AM },
    ].filter(r => {
        if (!r.value) return false;
        if (Array.isArray(r.value)) return r.value.length > 0;
        return typeof r.value === "string" && r.value.trim() !== "";
    });

    return (
        <Card className="py-0 gap-0">
            <CardHeader className="py-3 pb-1">
                <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-medium leading-tight">
                            {project.Project_Name || "Unnamed Project"}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                            ID: {project.id} • Started: {startDate}
                        </CardDescription>
                    </div>
                    <Badge className={
                        status === "active" ? "bg-green-600 hover:bg-green-700 text-white" :
                            status === "on_hold" ? "bg-amber-500 hover:bg-amber-600 text-white" :
                                "bg-blue-600 hover:bg-blue-700 text-white"
                    }>
                        {status.replace("_", " ")}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="py-2 pb-3">
                {/* Team Summary */}
                {teamRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {teamRoles.map(r => (
                            <span key={r.label} className="inline-flex items-center text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5">
                                <span className="font-medium mr-1">{r.label}:</span>
                                {Array.isArray(r.value) ? r.value.join(", ") : r.value}
                            </span>
                        ))}
                    </div>
                )}

                {/* Admin Actions */}
                {isAdmin && (
                    <div className="flex justify-end gap-2">
                        {status === "active" && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => onStatusChange(project.id, "on_hold", project.Project_Name)}>
                                    Put On Hold
                                </Button>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => onStatusChange(project.id, "completed", project.Project_Name)}>
                                    Mark Complete
                                </Button>
                            </>
                        )}
                        {status === "on_hold" && (
                            <Button size="sm" onClick={() => onStatusChange(project.id, "active", project.Project_Name)}>
                                Resume Project
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
