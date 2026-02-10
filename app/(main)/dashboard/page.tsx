import { MainDashboard } from "@/features/dashboard/MainDashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserRole } from "@/types";

const roleDefaultRoute: Record<UserRole, string> = {
  ADMIN: "/dashboard",
  MANAGER: "/feed-mill/dashboard",
  FEED_MILL_STAFF: "/feed-mill/dashboard",
  BSF_STAFF: "/bsf/dashboard",
  POULTRY_STAFF: "/poultry/dashboard",
  CATFISH_STAFF: "/catfish/dashboard",
  ACCOUNTANT: "/sales",
  PROCUREMENT_MANAGER: "/procurement",
  STORE_KEEPER: "/store",
  STAFF: "/store",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "ADMIN") {
    const fallback = profile?.role ? roleDefaultRoute[profile.role as UserRole] : "/store";
    redirect(fallback);
  }

  return <MainDashboard />;
}
