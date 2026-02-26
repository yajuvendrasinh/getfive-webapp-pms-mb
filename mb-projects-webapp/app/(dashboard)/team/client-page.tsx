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
    isMasterAdmin,
    ASSIGNABLE_ROLES_BY_ADMIN,
    ASSIGNABLE_ROLES_BY_MASTER_ADMIN,
    type UserRole,
} from "@/lib/auth";
import { UserPlus, Pencil, Trash2, X, Shield, Users } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserRecord = Record<string, any>;

interface TeamClientPageProps {
    initialUsers: UserRecord[];
    currentUserRole: string;
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
                role,
            });

            if (error) throw error;

            setUsers(prev => [{
                name: name.trim(),
                email: email.trim(),
                role,
                created_at: new Date().toISOString(),
            }, ...prev]);

            resetForm();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error";
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
                .update({ name: name.trim(), role, updated_at: new Date().toISOString() })
                .eq("email", editingEmail);

            if (error) throw error;

            setUsers(prev =>
                prev.map(u =>
                    u.email === editingEmail ? { ...u, name: name.trim(), role } : u
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
        setFormData({ name: user.name || "", email: user.email, role: user.role || "employee" });
        setShowAddForm(false);
    };

    const startAdd = () => {
        resetForm();
        setShowAddForm(true);
    };

    // Counts by role
    const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
        const r = u.role || "employee";
        acc[r] = (acc[r] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <p className="text-2xl font-bold">{users.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-medium text-slate-500">Admins</CardTitle>
                        <Shield className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <p className="text-2xl font-bold">
                            {(roleCounts["admin"] || 0) + (roleCounts["master_admin"] || 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-medium text-slate-500">RMs</CardTitle>
                        <Shield className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <p className="text-2xl font-bold">{roleCounts["RM"] || 0}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-medium text-slate-500">Employees</CardTitle>
                        <Users className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <p className="text-2xl font-bold">{roleCounts["employee"] || 0}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Add User Button */}
            <div className="flex justify-end">
                <Button onClick={startAdd} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add User
                </Button>
            </div>

            {/* Add / Edit Form */}
            {(showAddForm || editingEmail) && (
                <Card className="border-2 border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                                {editingEmail ? `Edit User — ${editingEmail}` : "Add New User"}
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={resetForm}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                        <div className="flex justify-end gap-2 pt-2">
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
            <Card>
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
                                                <Badge variant="outline" className={roleBadgeClass(user.role)}>
                                                    {getRoleLabel(user.role || "employee")}
                                                </Badge>
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
                                            No users found. Add your first team member above.
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
