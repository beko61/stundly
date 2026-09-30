import { redirect } from "next/navigation";
import Link from "next/link";
import { calculateWorkDuration } from "@workly/shared";
import { getCompanyAdminContext, formatMinutes } from "@/lib/company/admin";
import { notdienstBelongsToMonth, notdienstLoadRange } from "@/lib/utils/weekMonth";
import { addDays, berlinNowLocal, mondayOf, restUntil, type CsvEinsatz } from "@/lib/company/notdienstZentrale";
import { TeamNotdienstList, type TeamNotdienst } from "../employees/[userId]/TeamNotdienstList";
import { CsvButton, PauschaleCard, RotaCard } from "./ZentraleClient";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

interface Props { searchParams: Promise<{ month?: string; year?: string }> }

/**
 * Notdienst-Zentrale: Rufbereitschafts-Plan, Pauschale, alle Einsätze des Teams im Monat
 * (Wochen-Sonntag-Regel), Bezahlt setzen, CSV zum Abrechnen, Ruhezeit-Hinweise.
 */
export default async function NotdienstZentralePage({ searchParams }: Props) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/onboarding/type");
  const { admin, companyId } = ctx;
  const sp = await searchParams;

  const nowLocal = berlinNowLocal();
  const todayISO = nowLocal.slice(0, 10);
  const rawY = parseInt(sp.year ?? "", 10), rawM = parseInt(sp.month ?? "", 10);
  const year  = rawY >= 2020 && rawY <= 2100 ? rawY : Number(todayISO.slice(0, 4));
  const month = rawM >= 1 && rawM <= 12 ? rawM : Number(todayISO.slice(5, 7));

  // Mitarbeiter
  const { data: emps } = await admin
    .from("profiles").select("user_id, full_name, email, is_active")
    .eq("company_id", companyId).is("deleted_at", null);
  const employees = ((emps ?? []) as { user_id: string; full_name: string | null; email: string | null; is_active: boolean }[])
    .map((e) => ({ user_id: e.user_id, name: e.full_name ?? e.email ?? "—", is_active: e.is_active }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const nameOf = new Map(employees.map((e) => [e.user_id, e.name]));
  const userIds = employees.map((e) => e.user_id);

  // Pauschale + Plan (Migration 034 — tolerant, falls noch nicht ausgeführt)
  const { data: compRow, error: compErr } = await admin.from("companies").select("notdienst_pauschale").eq("id", companyId).maybeSingle();
  const pauschaleSupported = !compErr;
  const pauschale = compRow && (compRow as { notdienst_pauschale: number | null }).notdienst_pauschale != null
    ? Number((compRow as { notdienst_pauschale: number | null }).notdienst_pauschale) : null;

  const current = mondayOf(todayISO);
  const weeks = Array.from({ length: 9 }, (_, i) => addDays(current, (i - 1) * 7)); // letzte Woche + 8
  const { data: rotaRows, error: rotaErr } = await admin
    .from("notdienst_rota").select("week_start, user_id")
    .eq("company_id", companyId).gte("week_start", addDays(weeks[0]!, -7)).lte("week_start", weeks[weeks.length - 1]!);
  const rotaSupported = !rotaErr;
  const rota: Record<string, string | undefined> = {};
  for (const r of (rotaRows ?? []) as { week_start: string; user_id: string }[]) rota[r.week_start] = r.user_id;
  const previous = rota[addDays(current, -7)];
  const onDutyNow = rota[current];

  // Einsätze des Monats (Woche zählt zum Monat ihres Sonntags) + letzte 2 Tage für Ruhezeit
  const range = notdienstLoadRange(year, month);
  const [{ data: ndRaw }, { data: recentRaw }] = await Promise.all([
    userIds.length ? admin.from("notdienst_entries").select("*").in("user_id", userIds)
      .gte("date", range.start).lte("date", range.end).order("date").order("start_time") : Promise.resolve({ data: [] }),
    userIds.length ? admin.from("notdienst_entries").select("user_id, date, start_time, end_time").in("user_id", userIds)
      .gte("date", addDays(todayISO, -1)).lte("date", todayISO) : Promise.resolve({ data: [] }),
  ]);
  const entries: TeamNotdienst[] = ((ndRaw ?? []) as Record<string, unknown>[])
    .filter((n) => notdienstBelongsToMonth(n.date as string, year, month))
    .map((n) => ({
      id: n.id as string, date: n.date as string, start_time: n.start_time as string, end_time: n.end_time as string,
      kunde: (n.kunde as string | null) ?? null, kunde_telefon: (n.kunde_telefon as string | null) ?? null,
      adresse: (n.adresse as string | null) ?? null, problem: (n.problem as string | null) ?? null,
      ergebnis: (n.ergebnis as string | null) ?? null, note: (n.note as string | null) ?? null,
      erledigt: !!n.erledigt, user_id: n.user_id as string, name: nameOf.get(n.user_id as string) ?? "—",
    }));
  const minutesOf = (e: TeamNotdienst) => calculateWorkDuration(e.start_time.slice(0, 5), e.end_time.slice(0, 5), 0).net_minutes;
  const totalMin = entries.reduce((s, e) => s + minutesOf(e), 0);
  const offen = entries.filter((e) => !e.erledigt).length;
  const csvRows: CsvEinsatz[] = entries.map((e) => ({
    date: e.date, name: e.name ?? "—", start_time: e.start_time, end_time: e.end_time, minutes: minutesOf(e),
    kunde: e.kunde, kunde_telefon: e.kunde_telefon, adresse: e.adresse, problem: e.problem, ergebnis: e.ergebnis, erledigt: e.erledigt,
  }));

  const rest = restUntil((recentRaw ?? []) as { user_id: string; date: string; start_time: string | null; end_time: string | null }[], nowLocal);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div>
      <h1 className="sa-title">Notdienst</h1>
      <p className="sa-sub">
        {onDutyNow ? <>Diese Woche: <strong style={{ color: "var(--text)" }}>{nameOf.get(onDutyNow) ?? "—"}</strong></> : "Diese Woche ist niemand eingeteilt."}
      </p>

      {/* Ruhezeit nach nächtlichem Einsatz (§5 ArbZG) */}
      {[...rest.entries()].map(([uid, until]) => (
        <div key={uid} role="status" className="card" style={{
          padding: "12px 16px", marginBottom: 12, fontSize: 13,
          background: "color-mix(in srgb, var(--red) 8%, var(--surface))", border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
        }}>
          🌙 <strong>{nameOf.get(uid) ?? "—"}</strong>: Ruhezeit bis{" "}
          <strong>{until.slice(0, 10) === todayISO ? "" : `${until.slice(8, 10)}.${until.slice(5, 7)}. `}{until.slice(11, 16)} Uhr</strong>
          <span style={{ color: "var(--muted)" }}> · 11 h nach dem Einsatz (§5 ArbZG)</span>
        </div>
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
        <RotaCard
          weeks={weeks} current={current}
          employees={employees.filter((e) => e.is_active).map(({ user_id, name }) => ({ user_id, name }))}
          rota={rota} previous={previous} supported={rotaSupported}
        />
        <PauschaleCard value={pauschale} count={entries.length} offen={offen} supported={pauschaleSupported} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <Link href={`/company/notdienst?year=${prev.y}&month=${prev.m}`} className="btn" style={{ padding: "6px 10px", fontSize: 12 }} aria-label="Vorheriger Monat">‹</Link>
        <h2 style={{ fontSize: 16, fontWeight: 700, minWidth: 150, textAlign: "center" }}>{MONTHS[month - 1]} {year}</h2>
        <Link href={`/company/notdienst?year=${next.y}&month=${next.m}`} className="btn" style={{ padding: "6px 10px", fontSize: 12 }} aria-label="Nächster Monat">›</Link>
        <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
          {entries.length} Einsätze · {formatMinutes(totalMin)}{offen ? ` · ${offen} offen` : ""}
        </span>
        <CsvButton rows={csvRows} pauschale={pauschale} fileName={`Notdienst-Einsaetze_${year}-${String(month).padStart(2, "0")}.csv`} />
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        Eine Notdienst-Woche zählt zu dem Monat, in dem ihr Sonntag liegt.
      </p>
      <TeamNotdienstList key={`${year}-${month}`} userId={null} entries={entries} />
    </div>
  );
}
