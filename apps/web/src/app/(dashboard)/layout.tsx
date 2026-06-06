import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/ui/Sidebar";
import { BottomNav } from "@/components/ui/BottomNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-content">
        {children}
      </main>
      <div className="mobile-bottom-nav">
        <BottomNav />
      </div>
    </div>
  );
}
