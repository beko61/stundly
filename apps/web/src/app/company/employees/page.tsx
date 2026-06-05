"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Employee {
  id: string;
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
  created_at: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"employee" | "company_admin">("employee");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) return;
    setCompanyId(profile.company_id);

    const [{ data: emps }, { data: invs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("company_id", profile.company_id).order("created_at"),
      supabase.from("invitations").select("*").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
    ]);

    setEmployees(emps ?? []);
    setInvitations(invs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setInviting(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Limit kontrolü
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("company_id", companyId)
      .maybeSingle();

    const { error: invErr } = await supabase.from("invitations").insert({
      company_id: companyId,
      invited_by: user?.id,
      email: inviteEmail,
      role: inviteRole,
    });

    if (invErr) {
      setError(invErr.code === "23505" ? "Diese E-Mail wurde bereits eingeladen." : "Fehler beim Einladen.");
    } else {
      setSuccess(`Einladung an ${inviteEmail} wurde gespeichert.`);
      setInviteEmail("");
      load();
    }
    setInviting(false);
  }

  async function revokeInvitation(id: string) {
    const supabase = createClient();
    await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    load();
  }

  async function toggleEmployee(userId: string, isActive: boolean) {
    const supabase = createClient();
    await supabase.from("profiles").update({ is_active: !isActive }).eq("user_id", userId);
    load();
  }

  if (loading) return <div style={{ color: "var(--muted)", padding: 32 }}>Laden...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Mitarbeiter</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
        Mitarbeiter verwalten und neue einladen.
      </p>

      {/* Einladen */}
      <div className="card" style={{ padding: "24px", marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Mitarbeiter einladen</h2>
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="mitarbeiter@firma.de"
            required
            style={{ flex: 2, minWidth: 200 }}
          />
          <select
            className="input"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "employee" | "company_admin")}
            style={{ flex: 1, minWidth: 140 }}
          >
            <option value="employee">Mitarbeiter</option>
            <option value="company_admin">Admin</option>
          </select>
          <button className="btn btn-primary" type="submit" disabled={inviting} style={{ whiteSpace: "nowrap" }}>
            {inviting ? "..." : "Einladen"}
          </button>
        </form>
        {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{error}</p>}
        {success && <p style={{ color: "var(--green)", fontSize: 12, marginTop: 8 }}>✓ {success}</p>}
      </div>

      {/* Çalışanlar */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
          Aktive Mitarbeiter ({employees.filter(e => e.is_active).length})
        </h2>
        {employees.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Noch keine Mitarbeiter.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {employees.map((emp) => (
              <div key={emp.id} className="card" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.full_name ?? emp.email ?? "–"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {emp.email} · {emp.role === "company_admin" ? "Admin" : "Mitarbeiter"} ·{" "}
                    {emp.last_seen_at ? `Zuletzt aktiv: ${new Date(emp.last_seen_at).toLocaleDateString("de-DE")}` : "Noch nie eingeloggt"}
                  </div>
                </div>
                <button
                  onClick={() => toggleEmployee(emp.user_id, emp.is_active)}
                  className="btn"
                  style={{
                    fontSize: 11, padding: "6px 12px",
                    background: emp.is_active ? "color-mix(in srgb, var(--red) 12%, transparent)" : "color-mix(in srgb, var(--green) 12%, transparent)",
                    color: emp.is_active ? "var(--red)" : "var(--green)",
                    border: `1px solid ${emp.is_active ? "color-mix(in srgb, var(--red) 25%, transparent)" : "color-mix(in srgb, var(--green) 25%, transparent)"}`,
                  }}
                >
                  {emp.is_active ? "Deaktivieren" : "Aktivieren"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bekleyen davetler */}
      {invitations.filter(i => i.status === "pending").length > 0 && (
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Offene Einladungen</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invitations.filter(i => i.status === "pending").map((inv) => (
              <div key={inv.id} className="card" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    Läuft ab: {new Date(inv.expires_at).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <button
                  onClick={() => revokeInvitation(inv.id)}
                  className="btn"
                  style={{ fontSize: 11, padding: "6px 12px", background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }}
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
