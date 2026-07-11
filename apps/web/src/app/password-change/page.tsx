import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordChangeForm } from "./form";

export const metadata = {
  title: "Passwort ändern · Stundly",
  description: "Setze dein Passwort, bevor du fortfährst.",
};

export default async function PasswordChangePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password, full_name, deleted_at, is_active")
    .eq("user_id", user.id)
    .single();

  // Silinmiş / deaktive — login'e dön
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect("/login?blocked=deleted");
  }
  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?blocked=inactive");
  }

  // Flag set değilse — bu sayfaya gelmesine gerek yok. Role-bazlı yönlendir.
  if (!profile?.must_change_password) {
    const role = profile?.role ?? "individual";
    if (role === "super_admin")        redirect("/superadmin");
    else if (role === "company_admin") redirect("/company/dashboard");
    else                                redirect("/dashboard");
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{
            color: "var(--accent2)", fontSize: 13, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            STUNDLY
          </span>
        </div>
        <PasswordChangeForm
          email={user.email ?? ""}
          fullName={profile?.full_name ?? ""}
          role={profile?.role ?? "individual"}
        />
      </div>
    </div>
  );
}
