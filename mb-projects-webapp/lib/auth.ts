import { SupabaseClient } from "@supabase/supabase-js";
import { getISTDate } from "./utils";

// Hardcoded Master Admin email — single source of truth
export const MASTER_ADMIN_EMAIL = "yajuvendra.sinh@getfive.in";

// Available roles in the system
export const ROLES = [
    "employee",
    "RM",
    "FDD",
    "CDD",
    "PC",
    "AM",
    "admin",
    "master_admin",
] as const;

export type UserRole = (typeof ROLES)[number];

// Roles that non-master admins can assign
export const ASSIGNABLE_ROLES_BY_ADMIN: UserRole[] = [
    "employee",
    "RM",
    "FDD",
    "CDD",
    "PC",
    "AM",
];

// Roles that master admin can assign (all except master_admin itself)
export const ASSIGNABLE_ROLES_BY_MASTER_ADMIN: UserRole[] = [
    "employee",
    "RM",
    "FDD",
    "CDD",
    "PC",
    "AM",
    "admin",
];

/** Check if the role array contains admin or master_admin */
export function isAdmin(role: string | string[] | null | undefined): boolean {
    if (!role) return false;
    if (Array.isArray(role)) {
        return role.some(r => r === "admin" || r === "master_admin");
    }
    return role === "admin" || role === "master_admin";
}

/** Check if the email matches the hardcoded master admin */
export function isMasterAdmin(email: string | null | undefined): boolean {
    return email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
}

/** Human-friendly single role label */
export function getSingleRoleLabel(role: string): string {
    switch (role) {
        case "master_admin":
            return "Master Admin";
        case "admin":
            return "Admin";
        case "RM":
            return "Relationship Manager";
        case "FDD":
            return "Financial Due Diligence";
        case "CDD":
            return "Customer Due Diligence";
        case "PC":
            return "Project Coordinator";
        case "AM":
            return "Account Manager";
        case "employee":
            return "Employee";
        default:
            return role;
    }
}

/** Human-friendly role label */
export function getRoleLabel(role: string | string[]): string {
    const roles = Array.isArray(role) ? role : [role];
    const labels = roles.map(r => getSingleRoleLabel(r));
    return labels.join(", ");
}

/**
 * Get the current user's role from the users table.
 * Auto-provisions the master admin record on first login.
 */
export async function getUserRole(
    supabase: SupabaseClient,
    email: string,
    fullName?: string
): Promise<{ role: UserRole[]; name: string; email: string } | null> {
    // Check if the user exists
    const { data: userRecord, error } = await supabase
        .from("users")
        .select("role, name, email")
        .eq("email", email)
        .single();

    if (userRecord) {
        // Ensure role is treated as an array
        const userRole = Array.isArray(userRecord.role) ? userRecord.role : [userRecord.role];

        // If this is the master admin email, ensure role is correct
        if (isMasterAdmin(email) && !userRole.includes("master_admin")) {
            const updatedRoles = [...new Set([...userRole, "master_admin" as UserRole])];
            await supabase
                .from("users")
                .update({ role: updatedRoles, updated_at: getISTDate() })
                .eq("email", email);
            return { ...userRecord, role: updatedRoles };
        }
        return { ...userRecord, role: userRole };
    }

    // User not found — auto-provision if master admin
    if (isMasterAdmin(email)) {
        const newUser = {
            email: MASTER_ADMIN_EMAIL,
            name: fullName || "Master Admin",
            role: ["master_admin" as UserRole],
            created_at: getISTDate(),
            updated_at: getISTDate(),
        };
        await supabase.from("users").insert(newUser);
        return newUser;
    }

    // Not found and not master admin
    return null;
}
