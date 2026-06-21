"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface EmployeeSummary {
  user_id:         string;
  full_name:       string | null;
  email:           string | null;
  role:            string;
  is_active:       boolean;
  last_seen_at:    string | null;
  deleted_at:      string | null;
  monthlyMinutes:  number;
  workDays:        number;
  vacationDays:    number;
  sickDays:        number;
}

interface Invitation {
  id:         string;
  email:      string;
  role:       string;
  status:     string;
  expires_at: string;
  created_at: string;
}

function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function EmployeesPage() {
  const [employees, setEmployees]     = useState<EmployeeSummary[]>([]);
  const [deletedEmployees, setDeletedEmployees] = useState<EmployeeSummary[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [companyId, setCompanyId]     = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<"employee" | "company_admin">("employee");
  const [inviteName, setInviteName]   = useState("");
  const [invitePwd, setInvitePwd]     = useState("");
  const [loading, setLoading]         = useState(true);
  const [inviting, setInviting]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [created, setCreated]         = useState<{ email: string; password: string; name: string } | null>(null);

  function genPassword(): string {
    // 12 char: A-Z + a-z + 0-9 + special — easy to type
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("user_id", user.id).single();

    if (!profile?.company_id) return;
    setCompanyId(profile.company_id);

    // Team summary — includeDeleted=true ile soft-deleted da gelir, frontend ayırır
    const [summaryRes, { data: invs }] = await Promise.all([
      fetch("/api/company/team-summary?includeDeleted=true"),
      supabase.from("invitations")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),
    ]);

    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      const all: EmployeeSummary[] = summary.employees ?? [];
      setEmployees(all.filter(e => !e.deleted_at));
      setDeletedEmployees(all.filter(e => e.deleted_at));
    }
    setInvitations(invs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/company/employees/create", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email:     inviteEmail,
        password:  invitePwd,
        full_name: inviteName,
        role:      inviteRole,
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Mitarbeiter konnte nicht erstellt werden");
      setInviting(false);
      return;
    }

    // Başarılı — şifreyi modal'da göster (admin mitarbeiter'a güvenli iletir)
    setCreated({ email: inviteEmail, password: invitePwd, name: inviteName });
    setInviteEmail("");
    setInviteName("");
    setInvitePwd("");
    setInviteRole("employee");
    load();
    setInviting(false);
  }

  async function revokeInvitation(id: string) {
    const supabase = createClient();
    await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    load();
  }

  async function toggleEmployee(userId: string) {
    setError(null);
    const res = await fetch("/api/company/employees/toggle", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Aktion fehlgeschlagen");
      return;
    }
    load();
  }

  async function deleteEmployee(userId: string, name: string) {
    if (!confirm(`„${name}" wirklich löschen?\n\nDie Zeitdaten bleiben erhalten (GoBD). Du kannst den Mitarbeiter später wiederherstellen.`)) {
      return;
    }
    setError(null);
    const res = await fetch("/api/company/employees/delete", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Löschen fehlgeschlagen");
      return;
    }
    load();
  }

  async function restoreEmployee(userId: string) {
    setError(null);
    const res = await fetch("/api/company/employees/restore", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Wiederherstellen fehlgeschlagen");
      return;
    }
    load();
  }

  if (loading) return <div style={{ color: "var(--muted)", padding: 32 }}>Laden...</div>;

  const monthName = new Date().toLocaleDateString("de-DE", { month: "long" });

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Mitarbeiter</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
        Team verwalten und Stunden im Blick behalten · {monthName}
      </p>

      {/* Direkt erstellen */}
      <div className="card" style={{ padding: "24px", marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Mitarbeiter direkt erstellen</h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Du legst ein vorläufiges Passwort fest. Beim ersten Login muss der Mitarbeiter es ändern.
        </p>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input" type="text" value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Vor- und Nachname"
              required
              style={{ flex: 2, minWidth: 180 }}
            />
            <select
              className="input"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "employee" | "company_admin")}
              style={{ flex: 1, minWidth: 130 }}
            >
              <option value="employee">Mitarbeiter</option>
              <option value="company_admin">Admin</option>
            </select>
          </div>
          <input
            className="input" type="email" value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="mitarbeiter@firma.de"
            required
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input" type="text" value={invitePwd}
              onChange={(e) => setInvitePwd(e.target.value)}
              placeholder="Temporäres Passwort (min. 8 Zeichen)"
              required
              minLength={8}
              style={{ flex: 1, fontFamily: "'DM Mono',monospace" }}
            />
            <button
              type="button"
              onClick={() => setInvitePwd(genPassword())}
              className="btn"
              style={{ whiteSpace: "nowrap", fontSize: 12 }}
              title="Sicheres Passwort generieren"
            >
              ⟲ Generieren
            </button>
          </div>
          <button className="btn btn-primary" type="submit" disabled={inviting}>
            {inviting ? "Wird erstellt..." : "+ Mitarbeiter erstellen"}
          </button>
        </form>
        {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{error}</p>}
        {success && <p style={{ color: "var(--green)", fontSize: 12, marginTop: 8 }}>{success}</p>}
      </div>

      {/* Erfolgs-Modal: Passwort anzeigen + kopieren */}
      {created && (
        <div
          onClick={(e) => e.target === e.currentTarget && setCreated(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: "24px 22px", maxWidth: 440, width: "100%",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: "50%",
              background: "color-mix(in srgb, var(--green) 18%, transparent)",
              color: "var(--green)", fontSize: 20, fontWeight: 800, marginBottom: 14,
            }}>✓</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              Mitarbeiter erstellt
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18, lineHeight: 1.6 }}>
              Teile diese Zugangsdaten <strong style={{ color: "var(--text)" }}>sicher</strong> mit
              {" "}<strong style={{ color: "var(--text)" }}>{created.name}</strong>.
              Sie erscheinen nur jetzt — beim ersten Login wird ein neues Passwort gesetzt.
            </p>

            <div style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 14px", marginBottom: 8,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em" }}>EMAIL</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {created.email}
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(created.email)}
                className="btn" style={{ fontSize: 11, padding: "5px 10px", flexShrink: 0 }}
              >Kopieren</button>
            </div>
            <div style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 14px", marginBottom: 18,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em" }}>PASSWORT</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, fontFamily: "'DM Mono',monospace", color: "var(--accent2)" }}>
                  {created.password}
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(created.password)}
                className="btn" style={{ fontSize: 11, padding: "5px 10px", flexShrink: 0 }}
              >Kopieren</button>
            </div>

            <button
              onClick={() => {
                const text = `Stundly-Zugang für ${created.name}\nE-Mail: ${created.email}\nPasswort: ${created.password}\n\nBeim ersten Login musst du ein neues Passwort setzen.`;
                navigator.clipboard.writeText(text);
                setSuccess("Zugangsdaten in Zwischenablage kopiert.");
              }}
              className="btn" style={{ width: "100%", fontSize: 12, marginBottom: 8 }}
            >
              Alles kopieren (für WhatsApp / SMS)
            </button>
            <button
              onClick={() => setCreated(null)}
              className="btn btn-primary" style={{ width: "100%" }}
            >
              Fertig
            </button>
          </div>
        </div>
      )}

      {/* Çalışanlar — tıklanabilir liste */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
          Aktive Mitarbeiter ({employees.filter(e => e.is_active).length})
        </h2>
        {employees.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Noch keine Mitarbeiter.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {employees.map((emp) => (
              <div
                key={emp.user_id}
                className="card"
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: emp.is_active ? 1 : 0.6,
                }}
              >
                <Link
                  href={`/company/employees/${emp.user_id}`}
                  style={{
                    flex: 1,
                    textDecoration: "none",
                    color: "var(--text)",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    minWidth: 0,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {emp.full_name ?? emp.email ?? "–"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {emp.email} · {emp.role === "company_admin" ? "Admin" : "Mitarbeiter"}
                      {emp.last_seen_at && ` · Letzte Aktivität: ${new Date(emp.last_seen_at).toLocaleDateString("de-DE")}`}
                    </div>
                  </div>

                  {/* Bu ay saatler */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--accent2)" }}>
                      {fmtMinutes(emp.monthlyMinutes)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>
                      {emp.workDays}T · {emp.vacationDays}🏖 · {emp.sickDays}🤒
                    </div>
                  </div>

                  <span style={{ fontSize: 18, color: "var(--muted)", flexShrink: 0 }}>›</span>
                </Link>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleEmployee(emp.user_id)}
                    className="btn"
                    style={{
                      fontSize: 11, padding: "6px 12px",
                      background: emp.is_active
                        ? "color-mix(in srgb, var(--yellow) 12%, transparent)"
                        : "color-mix(in srgb, var(--green) 12%, transparent)",
                      color: emp.is_active ? "var(--yellow)" : "var(--green)",
                      border: `1px solid ${emp.is_active
                        ? "color-mix(in srgb, var(--yellow) 25%, transparent)"
                        : "color-mix(in srgb, var(--green) 25%, transparent)"}`,
                    }}
                    title={emp.is_active ? "Vorübergehend deaktivieren — Daten bleiben" : "Wieder aktivieren"}
                  >
                    {emp.is_active ? "Deaktivieren" : "Aktivieren"}
                  </button>
                  <button
                    onClick={() => deleteEmployee(emp.user_id, emp.full_name ?? emp.email ?? "Mitarbeiter")}
                    className="btn"
                    style={{
                      fontSize: 11, padding: "6px 12px",
                      background: "transparent",
                      color: "var(--red)",
                      border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
                    }}
                    title="Soft-Delete — Zeitdaten bleiben erhalten (GoBD)"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Soft-deleted toggle */}
        {deletedEmployees.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowDeleted(v => !v)}
              style={{
                background: "transparent", border: "none",
                color: "var(--muted)", fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: "'Syne',sans-serif",
              }}
            >
              {showDeleted ? "▾" : "▸"} Gelöschte Mitarbeiter ({deletedEmployees.length})
            </button>
          </div>
        )}

        {/* Soft-deleted list */}
        {showDeleted && deletedEmployees.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {deletedEmployees.map((emp) => (
              <div
                key={emp.user_id}
                className="card"
                style={{
                  padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  opacity: 0.55,
                  borderLeft: "3px solid var(--red)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {emp.full_name ?? emp.email ?? "–"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    {emp.email} · gelöscht am {emp.deleted_at ? new Date(emp.deleted_at).toLocaleDateString("de-DE") : "—"}
                  </div>
                </div>
                <button
                  onClick={() => restoreEmployee(emp.user_id)}
                  className="btn"
                  style={{
                    fontSize: 11, padding: "6px 12px", flexShrink: 0,
                    background: "color-mix(in srgb, var(--green) 12%, transparent)",
                    color: "var(--green)",
                    border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
                  }}
                >
                  Wiederherstellen
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
