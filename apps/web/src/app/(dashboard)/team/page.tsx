"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Employee {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
}

export default function TeamPage() {
  const router = useRouter();
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [companyId, setCompanyId]   = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]  = useState<"employee" | "company_admin">("employee");
  const [loading, setLoading]        = useState(true);
  const [inviting, setInviting]      = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase
      .from("profiles").select("company_id, role").eq("user_id", user.id).single();

    // Sadece company_admin erişebilir
    if (profile?.role !== "company_admin") { router.push("/tracker"); return; }
    if (!profile?.company_id) { router.push("/onboarding/type"); return; }

    setCompanyId(profile.company_id);

    const [{ data: company }, { data: emps }, { data: invs }] = await Promise.all([
      supabase.from("companies").select("name").eq("id", profile.company_id).single(),
      supabase.from("profiles").select("user_id, full_name, email, role, is_active, last_seen_at, created_at")
        .eq("company_id", profile.company_id).order("created_at"),
      supabase.from("invitations").select("id, email, role, status, expires_at")
        .eq("company_id", profile.company_id).eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    setCompanyName(company?.name ?? "");
    setEmployees(emps ?? []);
    setInvitations(invs ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setInviting(true);
    setMsg(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("invitations").insert({
      company_id: companyId,
      invited_by: user?.id,
      email: inviteEmail,
      role: inviteRole,
    });

    if (error) {
      setMsg({ type: "err", text: error.code === "23505" ? "Bu e-posta zaten davet edilmiş." : "Davet gönderilemedi." });
    } else {
      setMsg({ type: "ok", text: `${inviteEmail} adresine davet gönderildi.` });
      setInviteEmail("");
      void load();
    }
    setInviting(false);
  }

  async function toggleEmployee(userId: string, isActive: boolean) {
    const supabase = createClient();
    await supabase.from("profiles").update({ is_active: !isActive }).eq("user_id", userId);
    void load();
  }

  async function revokeInvitation(id: string) {
    const supabase = createClient();
    await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    void load();
  }

  if (loading) {
    return <div style={{ color: "var(--muted)", padding: 32, fontSize: 14 }}>Laden...</div>;
  }

  const activeCount  = employees.filter(e => e.is_active).length;
  const pendingCount = invitations.length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 32px" }}>
      {/* Başlık */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Mein Team</h1>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>{companyName} · Mitarbeiterverwaltung</p>
      </div>

      {/* Özet */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Aktif Üye",      value: activeCount,  color: "var(--green)" },
          { label: "Tüm Üyeler",     value: employees.length, color: "var(--blue)" },
          { label: "Bekleyen Davet", value: pendingCount,  color: "var(--yellow)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 20px", minWidth: 110 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Davet Formu */}
      <div className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Mitarbeiter einladen</h2>
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="mitarbeiter@firma.de"
            required
            style={{
              flex: 2, minWidth: 200, padding: "9px 14px",
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 10, color: "var(--text)", fontSize: 13, outline: "none",
            }}
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as "employee" | "company_admin")}
            style={{
              flex: 1, minWidth: 130, padding: "9px 12px",
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 10, color: "var(--text)", fontSize: 13, cursor: "pointer",
            }}
          >
            <option value="employee">Mitarbeiter</option>
            <option value="company_admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            style={{
              padding: "9px 20px", borderRadius: 10,
              background: inviting ? "var(--surface2)" : "var(--accent)",
              color: "#fff", fontWeight: 700, fontSize: 13,
              border: "none", cursor: inviting ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            }}
          >
            {inviting ? "..." : "Einladen"}
          </button>
        </form>
        {msg && (
          <p style={{ fontSize: 12, marginTop: 8, color: msg.type === "ok" ? "var(--green)" : "var(--red)" }}>
            {msg.type === "ok" ? "✓ " : "✗ "}{msg.text}
          </p>
        )}
      </div>

      {/* Üyeler Listesi */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
          Teammitglieder ({employees.length})
        </h2>
        {employees.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Noch keine Mitarbeiter.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {employees.map(emp => (
              <div
                key={emp.user_id}
                className="card"
                style={{
                  padding: "14px 18px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  opacity: emp.is_active ? 1 : 0.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "var(--accent2)", flexShrink: 0,
                  }}>
                    {(emp.full_name ?? emp.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.full_name ?? "–"}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                      {emp.email} ·{" "}
                      <span style={{ color: emp.role === "company_admin" ? "var(--accent2)" : "var(--blue)", fontWeight: 600 }}>
                        {emp.role === "company_admin" ? "Admin" : "Mitarbeiter"}
                      </span>
                      {emp.last_seen_at && ` · Zuletzt: ${new Date(emp.last_seen_at).toLocaleDateString("de-DE")}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleEmployee(emp.user_id, emp.is_active)}
                  style={{
                    padding: "5px 12px", borderRadius: 8, border: "none",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: emp.is_active
                      ? "color-mix(in srgb, var(--red) 12%, transparent)"
                      : "color-mix(in srgb, var(--green) 12%, transparent)",
                    color: emp.is_active ? "var(--red)" : "var(--green)",
                  }}
                >
                  {emp.is_active ? "Deaktivieren" : "Aktivieren"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bekleyen Davetler */}
      {invitations.length > 0 && (
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
            Offene Einladungen ({invitations.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invitations.map(inv => (
              <div
                key={inv.id}
                className="card"
                style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                    {inv.role === "company_admin" ? "Admin" : "Mitarbeiter"} ·
                    Läuft ab: {new Date(inv.expires_at).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <button
                  onClick={() => revokeInvitation(inv.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", background: "transparent",
                    color: "var(--muted)", border: "1px solid var(--border)",
                  }}
                >
                  Widerrufen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
