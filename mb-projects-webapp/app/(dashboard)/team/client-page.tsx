"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    getRoleLabel,
    getSingleRoleLabel,
    isMasterAdmin,
    ASSIGNABLE_ROLES_BY_ADMIN,
    ASSIGNABLE_ROLES_BY_MASTER_ADMIN,
    type UserRole,
} from "@/lib/auth";
import { UserPlus, Pencil, Trash2, X, Shield, Users } from "lucide-react";
import { cn, getISTDate } from "@/lib/utils";
import { Agreement03Icon } from "@/components/icons/hugeicons-agreement-03";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserRecord = Record<string, any>;

interface TeamClientPageProps {
    initialUsers: UserRecord[];
    currentUserRole: string | string[];
    currentUserEmail: string;
}

export function TeamClientPage({ initialUsers, currentUserRole, currentUserEmail }: TeamClientPageProps) {
    const [users, setUsers] = useState<UserRecord[]>(initialUsers);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingEmail, setEditingEmail] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: "", email: "", role: "employee" });
    const [loading, setLoading] = useState(false);

    const supabase = useMemo(() => createClient(), []);
    const searchParams = useSearchParams();
    const isMaster = currentUserRole === "master_admin";

    useEffect(() => {
        if (searchParams.get("action") === "add") {
            startAdd();
        }
    }, [searchParams]);

    // Roles the current user can assign
    const assignableRoles = isMaster ? ASSIGNABLE_ROLES_BY_MASTER_ADMIN : ASSIGNABLE_ROLES_BY_ADMIN;

    // Role badge color
    const roleBadgeClass = (role: string) => {
        switch (role) {
            case "master_admin":
                return "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700";
            case "admin":
                return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
            case "RM":
                return "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700";
            case "CDD":
                return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700";
            default:
                return "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
        }
    };

    const resetForm = () => {
        setFormData({ name: "", email: "", role: "employee" });
        setShowAddForm(false);
        setEditingEmail(null);
    };

    const handleAddUser = async () => {
        const { name, email, role } = formData;
        if (!name.trim() || !email.trim()) {
            alert("Name and Email are required.");
            return;
        }

        setLoading(true);
        try {
            // Check for existing user
            const { data: existing } = await supabase
                .from("users")
                .select("email")
                .eq("email", email.trim())
                .single();

            if (existing) {
                alert(`A user with email "${email}" already exists.`);
                setLoading(false);
                return;
            }

            const { error } = await supabase.from("users").insert({
                name: name.trim(),
                email: email.trim(),
                role: [role],
                created_at: getISTDate(),
                updated_at: getISTDate(),
            });

            if (error) throw error;

            setUsers(prev => [{
                name: name.trim(),
                email: email.trim(),
                role: [role],
                created_at: getISTDate(),
            }, ...prev]);

            resetForm();
        } catch (e: any) {
            console.error("DEBUG: Full Error Object:", e);
            console.error("DEBUG: Error Keys:", Object.keys(e));
            if (e.code) console.error("DEBUG: Error Code:", e.code);
            if (e.details) console.error("DEBUG: Error Details:", e.details);
            if (e.hint) console.error("DEBUG: Error Hint:", e.hint);

            const msg = e.message || (typeof e === 'object' ? JSON.stringify(e) : "Unknown error");
            alert("Failed to add user: " + msg);
        } finally {
            setLoading(false);
        }
    };

    const handleEditUser = async () => {
        if (!editingEmail) return;
        const { name, role } = formData;

        if (!name.trim()) {
            alert("Name is required.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from("users")
                .update({
                    name: name.trim(),
                    role: [role],
                    updated_at: getISTDate()
                })
                .eq("email", editingEmail);

            if (error) throw error;

            setUsers(prev =>
                prev.map(u =>
                    u.email === editingEmail ? { ...u, name: name.trim(), role: [role] } : u
                )
            );

            resetForm();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            alert("Failed to update user: " + msg);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (email: string) => {
        if (isMasterAdmin(email)) {
            alert("Cannot delete the Master Admin.");
            return;
        }
        if (email === currentUserEmail) {
            alert("Cannot delete yourself.");
            return;
        }
        if (!confirm(`Are you sure you want to delete user "${email}"? This cannot be undone.`)) {
            return;
        }

        try {
            const { error } = await supabase.from("users").delete().eq("email", email);
            if (error) throw error;
            setUsers(prev => prev.filter(u => u.email !== email));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            alert("Failed to delete user: " + msg);
        }
    };

    const startEdit = (user: UserRecord) => {
        // Cannot edit master admin's role if not master admin
        setEditingEmail(user.email);

        // Ensure role is a scalar string for the Select component
        let roleVal = "employee";
        if (Array.isArray(user.role)) {
            roleVal = user.role[0] || "employee";
        } else if (typeof user.role === 'string') {
            roleVal = user.role;
        }

        setFormData({
            name: user.name || "",
            email: user.email,
            role: roleVal
        });
        setShowAddForm(false);
    };

    const startAdd = () => {
        resetForm();
        setShowAddForm(true);
    };

    // Counts by role (users can be in multiple counts)
    const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
        const roles = Array.isArray(u.role) ? u.role : [u.role || "employee"];
        roles.forEach(r => {
            acc[r] = (acc[r] || 0) + 1;
        });
        return acc;
    }, {});

    const nonMasterEmployees = users.filter(u => {
        const roles = Array.isArray(u.role) ? u.role : [u.role];
        return !roles.includes("master_admin");
    });

    return (
        <div className="space-y-4 -mt-4">
            {/* Summary */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                <SummaryCard
                    title="Total"
                    value={nonMasterEmployees.length}
                    icon={<Users className="h-4 w-4 text-slate-500" />}
                />
                <SummaryCard
                    title="Relationship Managers"
                    value={roleCounts["RM"] || 0}
                    icon={<Shield className="h-4 w-4 text-emerald-500" />}
                />
                <SummaryCard
                    title="Project Coordinators"
                    value={roleCounts["PC"] || 0}
                    icon={<Users className="h-4 w-4 text-blue-500" />}
                />
                <SummaryCard
                    title="FFDs"
                    value={roleCounts["FDD"] || 0}
                    icon={<Shield className="h-4 w-4 text-orange-500" />}
                />
                <SummaryCard
                    title="CDDs"
                    value={roleCounts["CDD"] || 0}
                    icon={<Agreement03Icon className="h-4 w-4 text-purple-500" />}
                />
            </div>

            {/* Sub-header Removal Note: redundant header is removed, sticky header remains */}

            {/* Add Employee Button */}
            <div className="flex justify-end">
                <Button onClick={startAdd} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
                    <UserPlus className="h-4 w-4" />
                    Add Employee
                </Button>
            </div>

            {/* Add / Edit Form */}
            {(showAddForm || editingEmail) && (
                <Card className="border-2 border-blue-200 dark:border-blue-800 mb-6 bg-blue-50/20 py-0 gap-0 overflow-hidden">
                    <CardHeader className="p-4 px-6 pb-0">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base leading-none">
                                {editingEmail ? `Edit Employee — ${editingEmail}` : "Add New Employee"}
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="px-6 pt-0 pb-5">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="user-name">Name</Label>
                                <Input
                                    id="user-name"
                                    placeholder="Full name"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="user-email">Email</Label>
                                <Input
                                    id="user-email"
                                    type="email"
                                    placeholder="user@example.com"
                                    value={formData.email}
                                    disabled={!!editingEmail}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    className={editingEmail ? "opacity-60" : ""}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="user-role">Role</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, role: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assignableRoles.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {getRoleLabel(r)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" onClick={resetForm}>Cancel</Button>
                            <Button
                                onClick={editingEmail ? handleEditUser : handleAddUser}
                                disabled={loading}
                            >
                                {loading ? "Saving..." : editingEmail ? "Update User" : "Add User"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Users Table */}
            <Card className="py-0 gap-0">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="text-left font-medium text-slate-500 px-4 py-3">Name</th>
                                    <th className="text-left font-medium text-slate-500 px-4 py-3">Email</th>
                                    <th className="text-left font-medium text-slate-500 px-4 py-3">Role</th>
                                    <th className="text-left font-medium text-slate-500 px-4 py-3">Created</th>
                                    <th className="text-right font-medium text-slate-500 px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => {
                                    const isMe = user.email === currentUserEmail;
                                    const isMasterRow = isMasterAdmin(user.email);
                                    const canEdit = isMaster || (!isMasterRow && user.role !== "master_admin");
                                    const canDelete = isMaster && !isMasterRow && !isMe;

                                    return (
                                        <tr
                                            key={user.email}
                                            className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                                        >
                                            <td className="px-4 py-3 font-medium">
                                                {user.name || "—"}
                                                {isMe && (
                                                    <span className="ml-2 text-xs text-slate-400">(you)</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                {user.email}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(Array.isArray(user.role) ? user.role : [user.role || "employee"]).map((r: string) => (
                                                        <Badge
                                                            key={r}
                                                            variant="outline"
                                                            className={cn("text-[10px] font-medium px-2 py-0 border", roleBadgeClass(r))}
                                                        >
                                                            {getSingleRoleLabel(r)}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">
                                                {user.created_at
                                                    ? new Date(user.created_at).toLocaleDateString("en-IN", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                    })
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => startEdit(user)}
                                                            className="h-7 w-7 p-0"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteUser(user.email)}
                                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                                            No employees found. Add your first team member above.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
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
