import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/ui/Sidebar";
import { BottomNav } from "@/components/ui/BottomNav";
import { OfflineSync } from "@/components/ui/OfflineSync";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Soft-delete / deaktiviert / must_change_password gate
  // — fail-open: profile fetch fail olursa engelleme.
  // Super-Admin: löschen/deaktivieren durch eine Firma sperrt das Konto nicht (Daten bleiben sichtbar).
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, deleted_at, must_change_password, is_super_admin")
    .eq("user_id", user.id)
    .single();
  const firmaSperrt = profile?.is_super_admin !== true;
  if (firmaSperrt && profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect("/login?blocked=deleted");
  }
  if (firmaSperrt && profile?.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?blocked=inactive");
  }
  if (profile?.must_change_password) {
    redirect("/password-change");
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-content">
        {children}
      </main>
      <div className="mobile-bottom-nav">
        <BottomNav />
      </div>
      <OfflineSync />
    </div>
  );
}
