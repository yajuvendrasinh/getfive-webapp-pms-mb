import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's role from our users table (keyed by email)
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("email", user.email)
    .single();

  const roleRaw = userData?.role || "employee";
  const role = Array.isArray(roleRaw) ? roleRaw : [roleRaw];
  const isAdmin = role.some(r => r === "admin" || r === "master_admin" || r === "RM");

  if (isAdmin) {
    redirect("/projects");
  } else {
    redirect("/tasks");
  }
}
