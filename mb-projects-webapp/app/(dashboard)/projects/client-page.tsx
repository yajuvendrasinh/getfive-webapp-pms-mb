"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
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
import { Building2, Calendar, Users, Clock, FolderPlus, X } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectItem = Record<string, any>;
type UserItem = { name: string; email: string; role: string };

interface ProjectsClientPageProps {
    initialProjects: ProjectItem[];
    userRole: string;
    allUsers: UserItem[];
}

export function ProjectsClientPage({ initialProjects, userRole, allUsers }: ProjectsClientPageProps) {
    const [projects, setProjects] = useState<ProjectItem[]>(initialProjects);
    const supabase = useMemo(() => createClient(), []);
    const searchParams = useSearchParams();

    const isAdmin = userRole === "admin" || userRole === "master_admin";
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        if (searchParams.get("action") === "add" && isAdmin) {
            setShowAddForm(true);
        }
    }, [searchParams, isAdmin]);

    const [addLoading, setAddLoading] = useState(false);
    const [newProject, setNewProject] = useState({
        Project_Name: "",
        Start_Date: "",
        Project_RM: "",
        Project_FDD: "",
        Project_Sec: "",
        Project_PC: "",
        Project_AM: "",
    });

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

    const handleStatusChange = async (projectId: string, newStatus: string) => {
        const updates: Record<string, string | null> = { Project_Status: newStatus, Status: newStatus };
        if (newStatus === "completed") {
            updates.completionTime = new Date().toISOString();
        }
        await supabase.from("projects").update(updates).eq("id", projectId);
        setProjects(prev =>
            prev.map(p => p.id === projectId ? { ...p, Project_Status: newStatus, Status: newStatus } : p)
        );
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
                Project_FDD: newProject.Project_FDD || null,
                Project_Sec: newProject.Project_Sec || null,
                Project_PC: newProject.Project_PC || null,
                Project_AM: newProject.Project_AM || null,
                created_at: new Date().toISOString(),
            };

            const { error } = await supabase.from("projects").insert(projectData);
            if (error) throw error;

            setProjects(prev => [projectData, ...prev]);
            setNewProject({ Project_Name: "", Start_Date: "", Project_RM: "", Project_FDD: "", Project_Sec: "", Project_PC: "", Project_AM: "" });
            setShowAddForm(false);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            alert("Failed to add project: " + msg);
        } finally {
            setAddLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <SummaryCard title="Total Projects" value={projects.length} icon={<Building2 className="h-4 w-4 text-slate-500" />} />
                <SummaryCard title="Active" value={activeProjects.length} icon={<Clock className="h-4 w-4 text-green-500" />} />
                <SummaryCard title="On Hold" value={onHoldProjects.length} icon={<Calendar className="h-4 w-4 text-amber-500" />} />
                <SummaryCard title="Completed" value={completedProjects.length} icon={<Users className="h-4 w-4 text-blue-500" />} />
            </div>

            {/* Add Project Button */}
            {isAdmin && (
                <div className="flex justify-end">
                    <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
                        <FolderPlus className="h-4 w-4" />
                        Add Project
                    </Button>
                </div>
            )}

            {/* Add Project Form */}
            {showAddForm && isAdmin && (
                <Card className="border-2 border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Add New Project</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="proj-name">Project Name *</Label>
                                <Input
                                    id="proj-name"
                                    placeholder="Enter project name"
                                    value={newProject.Project_Name}
                                    onChange={(e) => setNewProject(prev => ({ ...prev, Project_Name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="proj-date">Start Date *</Label>
                                <Input
                                    id="proj-date"
                                    type="date"
                                    value={newProject.Start_Date}
                                    onChange={(e) => setNewProject(prev => ({ ...prev, Start_Date: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                            {(["Project_RM", "Project_FDD", "Project_Sec", "Project_PC", "Project_AM"] as const).map((field) => {
                                const label = field.replace("Project_", "");
                                return (
                                    <div key={field} className="space-y-2">
                                        <Label>{label}</Label>
                                        <Select
                                            value={newProject[field] || "__none__"}
                                            onValueChange={(val) => setNewProject(prev => ({ ...prev, [field]: val === "__none__" ? "" : val }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={`Select ${label}`} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">None</SelectItem>
                                                {allUsers.map((u) => (
                                                    <SelectItem key={u.email} value={u.email}>
                                                        {u.name} ({u.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                            <Button onClick={handleAddProject} disabled={addLoading}>
                                {addLoading ? "Creating..." : "Create Project"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Project Tabs */}
            <Tabs defaultValue="active" className="w-full">
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

                <TabsContent value="active" className="mt-4 space-y-3">
                    {activeProjects.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No active projects.</p>
                    ) : (
                        activeProjects.map(project => (
                            <ProjectCard key={project.id} project={project} isAdmin={isAdmin}
                                onStatusChange={handleStatusChange} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="on-hold" className="mt-4 space-y-3">
                    {onHoldProjects.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No projects on hold.</p>
                    ) : (
                        onHoldProjects.map(project => (
                            <ProjectCard key={project.id} project={project} isAdmin={isAdmin}
                                onStatusChange={handleStatusChange} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="completed" className="mt-4 space-y-3">
                    {completedProjects.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center italic">No completed projects.</p>
                    ) : (
                        completedProjects.map(project => (
                            <ProjectCard key={project.id} project={project} isAdmin={isAdmin}
                                onStatusChange={handleStatusChange} />
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

// --- Summary Card ---
function SummaryCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    );
}

// --- Project Card ---
function ProjectCard({ project, isAdmin, onStatusChange }: {
    project: ProjectItem;
    isAdmin: boolean;
    onStatusChange: (id: string, status: string) => void;
}) {
    const status = project.Project_Status || project.Status || "active";
    const startDate = project.Start_Date
        ? new Date(project.Start_Date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "No start date";

    // Build team summary
    const teamRoles = [
        { label: "RM", value: project.Project_RM },
        { label: "FDD", value: project.Project_FDD },
        { label: "Sec", value: project.Project_Sec },
        { label: "PC", value: project.Project_PC },
        { label: "AM", value: project.Project_AM },
    ].filter(r => r.value && r.value.trim() !== "");

    return (
        <Card>
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
                                {r.value}
                            </span>
                        ))}
                    </div>
                )}

                {/* Admin Actions */}
                {isAdmin && (
                    <div className="flex justify-end gap-2">
                        {status === "active" && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => onStatusChange(project.id, "on_hold")}>
                                    Put On Hold
                                </Button>
                                <Button size="sm" onClick={() => onStatusChange(project.id, "completed")}>
                                    Mark Complete
                                </Button>
                            </>
                        )}
                        {status === "on_hold" && (
                            <Button size="sm" onClick={() => onStatusChange(project.id, "active")}>
                                Resume Project
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
