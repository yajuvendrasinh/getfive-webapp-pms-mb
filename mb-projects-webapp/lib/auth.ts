import { SupabaseClient } from "@supabase/supabase-js";

// Hardcoded Master Admin email — single source of truth
export const MASTER_ADMIN_EMAIL = "yajuvendra.sinh@getfive.in";

// Available roles in the system
export const ROLES = [
    "employee",
    "RM",
    "FDD",
    "Sec",
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
    "Sec",
    "PC",
    "AM",
];

// Roles that master admin can assign (all except master_admin itself)
export const ASSIGNABLE_ROLES_BY_MASTER_ADMIN: UserRole[] = [
    "employee",
    "RM",
    "FDD",
    "Sec",
    "PC",
    "AM",
    "admin",
];

/** Check if the role is admin or master_admin */
export function isAdmin(role: string | null | undefined): boolean {
    return role === "admin" || role === "master_admin";
}

/** Check if the email matches the hardcoded master admin */
export function isMasterAdmin(email: string | null | undefined): boolean {
    return email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
}

/** Human-friendly role label */
export function getRoleLabel(role: string): string {
    switch (role) {
        case "master_admin":
            return "Master Admin";
        case "admin":
            return "Admin";
        case "RM":
            return "RM";
        case "FDD":
            return "FDD";
        case "Sec":
            return "Secretary";
        case "PC":
            return "PC";
        case "AM":
            return "AM";
        case "employee":
            return "Employee";
        default:
            return role;
    }
}

/**
 * Get the current user's role from the users table.
 * Auto-provisions the master admin record on first login.
 */
export async function getUserRole(
    supabase: SupabaseClient,
    email: string,
    fullName?: string
): Promise<{ role: UserRole; name: string; email: string } | null> {
    // Check if the user exists
    const { data: userRecord, error } = await supabase
        .from("users")
        .select("role, name, email")
        .eq("email", email)
        .single();

    if (userRecord) {
        // If this is the master admin email, ensure role is correct
        if (isMasterAdmin(email) && userRecord.role !== "master_admin") {
            await supabase
                .from("users")
                .update({ role: "master_admin" })
                .eq("email", email);
            return { ...userRecord, role: "master_admin" };
        }
        return userRecord;
    }

    // User not found — auto-provision if master admin
    if (isMasterAdmin(email)) {
        const newUser = {
            email: MASTER_ADMIN_EMAIL,
            name: fullName || "Master Admin",
            role: "master_admin" as UserRole,
        };
        await supabase.from("users").insert(newUser);
        return newUser;
    }

    // Not found and not master admin
    return null;
}
