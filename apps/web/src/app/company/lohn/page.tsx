import { redirect } from "next/navigation";
import Link from "next/link";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { loadLohnMonth } from "@/lib/company/lohnData";
import { hm, STATUS_LABEL } from "@/lib/company/lohn";
import { LohnActions, LohnSettingsCard } from "./LohnClient";

interface Props { searchParams: Promise<{ month?: string; year?: string }> }

/**
 * Lohn-Vorbereitung: eine Zeile pro Mitarbeiter (Soll, Ist, Notdienst, Saldo, Urlaub, Krank),
 * Export CSV/PDF und Versand an den Steuerberater. Standard: Vormonat (der wird abgerechnet).
 */
export default async function LohnPage({ searchParams }: Props) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/onboarding/type");
  const { admin, companyId } = ctx;
  const sp = await searchParams;

  const now = new Date();
  const defY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const defM = now.getMonth() === 0 ? 12 : now.getMonth();
  const rawY = parseInt(sp.year ?? "", 10), rawM = parseInt(sp.month ?? "", 10);
  const year  = rawY >= 2020 && rawY <= 2100 ? rawY : defY;
  const month = rawM >= 1 && rawM <= 12 ? rawM : defM;

  const { company, rows, monthLabel } = await loadLohnMonth(admin, companyId, year, month);
  const approved = rows.filter((r) => r.status === "approved").length;
  const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const th: React.CSSProperties = { textAlign: "right", padding: "10px 10px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { textAlign: "right", padding: "10px 10px", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" };

  return (
    <div>
      <h1 className="sa-title">Lohn-Vorbereitung</h1>
      <p className="sa-sub">Alles, was dein Lohnbüro oder Steuerberater für den Monat braucht.</p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Link href={`/company/lohn?year=${prev.y}&month=${prev.m}`} className="btn" style={{ padding: "6px 10px", fontSize: 12 }} aria-label="Vorheriger Monat">‹</Link>
        <h2 style={{ fontSize: 16, fontWeight: 700, minWidth: 150, textAlign: "center" }}>{monthLabel}</h2>
        <Link href={`/company/lohn?year=${next.y}&month=${next.m}`} className="btn" style={{ padding: "6px 10px", fontSize: 12 }} aria-label="Nächster Monat">›</Link>
        <span style={{ fontSize: 12, color: approved === rows.length && rows.length ? "var(--green)" : "var(--orange)", fontWeight: 700 }}>
          {rows.length ? `${approved}/${rows.length} freigegeben` : ""}
        </span>
      </div>

      {rows.length > 0 && approved < rows.length && (
        <div className="card" style={{ padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--muted)" }}>
          ⚠️ {rows.length - approved} Monat{rows.length - approved === 1 ? " ist" : "e sind"} noch nicht freigegeben — Werte können sich noch ändern.{" "}
          <Link href="/company/employees" style={{ color: "var(--accent2)" }}>Zu den Mitarbeitern →</Link>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 24, color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Keine Mitarbeiter-Daten für {monthLabel}.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                <th style={{ ...th, textAlign: "left" }}>Mitarbeiter</th>
                <th style={th}>Soll</th><th style={th}>Arbeit</th><th style={th}>Urlaub/Krank/FT</th><th style={th}>Ist</th>
                <th style={th}>Notdienst</th><th style={th}>Saldo</th><th style={th}>Urlaub</th><th style={th}>Krank</th>
                {company.notdienst_pauschale != null && <th style={th}>Pauschale</th>}
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>
                    <Link href={`/company/employees/${r.user_id}?year=${year}&month=${month}`} style={{ color: "var(--text)", fontWeight: 700, textDecoration: "none" }}>{r.name}</Link>
                    {r.personal_nr && <span style={{ color: "var(--muted)", fontSize: 11 }}> · {r.personal_nr}</span>}
                  </td>
                  <td style={td}>{hm(r.sollMin)}</td>
                  <td style={td}>{hm(r.arbeitMin)}</td>
                  <td style={td}>{hm(r.bezahltAbwMin)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{hm(r.istMin)}</td>
                  <td style={{ ...td, color: r.ndCount ? "var(--orange)" : "var(--muted)" }}>{r.ndCount ? `${r.ndCount}× ${hm(r.ndMin)}` : "–"}</td>
                  <td style={{ ...td, fontWeight: 700, color: r.diffMin >= 0 ? "var(--green)" : "var(--red)" }}>{r.diffMin >= 0 ? "+" : ""}{hm(r.diffMin)}</td>
                  <td style={td}>{r.urlaubDays || "–"}</td>
                  <td style={{ ...td, color: r.krankDays ? "var(--red)" : "var(--muted)" }}>{r.krankDays || "–"}</td>
                  {company.notdienst_pauschale != null && (
                    <td style={td}>{r.pauschaleSum ? `${r.pauschaleSum.toFixed(2).replace(".", ",")} €` : "–"}</td>
                  )}
                  <td style={{ ...td, fontFamily: "inherit", fontSize: 11, fontWeight: 800, color: r.status === "approved" ? "var(--green)" : r.status === "submitted" ? "var(--accent2)" : "var(--muted)" }}>
                    {r.status ? STATUS_LABEL[r.status] : "offen"}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "var(--surface2)", fontWeight: 800 }}>
                <td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>Summe</td>
                <td style={td}>{hm(sum((r) => r.sollMin))}</td>
                <td style={td}>{hm(sum((r) => r.arbeitMin))}</td>
                <td style={td}>{hm(sum((r) => r.bezahltAbwMin))}</td>
                <td style={td}>{hm(sum((r) => r.istMin))}</td>
                <td style={td}>{sum((r) => r.ndCount)}× {hm(sum((r) => r.ndMin))}</td>
                <td style={td}>{hm(sum((r) => r.diffMin))}</td>
                <td style={td}>{sum((r) => r.urlaubDays)}</td>
                <td style={td}>{sum((r) => r.krankDays)}</td>
                {company.notdienst_pauschale != null && <td style={td}>{sum((r) => r.pauschaleSum ?? 0).toFixed(2).replace(".", ",")} €</td>}
                <td style={td} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <LohnActions
        rows={rows} year={year} month={month} monthLabel={monthLabel} firma={company.name}
        steuerberaterEmail={company.steuerberater_email}
      />
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "10px 0 28px", lineHeight: 1.6 }}>
        Ist = Arbeit + Urlaub/Krank/Feiertag (als Sollstunden). Saldo = Ist + Notdienst − Soll. Notdienst zählt zum Monat,
        in dem der Sonntag seiner Woche liegt. CSV mit Dezimalstunden für Excel und Lohnprogramme.
      </p>

      <div id="mail-einstellungen">
        <LohnSettingsCard
          email={company.steuerberater_email} auto={company.steuerberater_auto}
          digest={company.team_digest_enabled} supported={company.settingsSupported}
        />
      </div>
    </div>
  );
}
