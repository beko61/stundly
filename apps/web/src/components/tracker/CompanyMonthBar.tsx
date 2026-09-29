"use client";

import { useState } from "react";
import type React from "react";
import {
  describeEntry, monthKey, useEntryCorrections, useMarkCorrectionsSeen, useMonthClosings, useSubmitMonth,
} from "@/hooks/queries/useCompanyWorkflow";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const dateDE = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const dayDE = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

const box: React.CSSProperties = {
  margin: "0 16px 12px", padding: "12px 14px", borderRadius: 12, fontSize: 12, lineHeight: 1.5,
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
};
const btn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer",
  fontFamily: "'Syne',sans-serif", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)",
};
const tint = (c: string): React.CSSProperties => ({
  background: `color-mix(in srgb, ${c} 10%, var(--surface))`,
  border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
});

/**
 * Nur für Firmen-Mitarbeiter: Monat bei der Firma einreichen, Status (eingereicht/freigegeben)
 * und ungesehene Korrekturen der Firma mit Begründung.
 */
export function CompanyMonthBar({ year, month }: { year: number; month: number }) {
  const closings = useMonthClosings(true);
  const corrections = useEntryCorrections(true);
  const submit = useSubmitMonth();
  const seen = useMarkCorrectionsSeen();
  const [error, setError] = useState<string | null>(null);

  const closing = closings.data?.get(monthKey(year, month)) ?? null;
  const unseen = (corrections.data ?? []).filter((c) => !c.seen_at);

  const now = new Date();
  const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

  function run(action: "submit" | "withdraw") {
    setError(null);
    submit.mutate({ year, month, action }, { onError: (e) => setError(e instanceof Error ? e.message : "Fehlgeschlagen") });
  }

  return (
    <>
      {unseen.length > 0 && (
        <div role="status" style={{ ...box, ...tint("var(--yellow)"), alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, color: "var(--yellow)", marginBottom: 4 }}>
              ✏️ Deine Firma hat {unseen.length === 1 ? "einen Eintrag" : `${unseen.length} Einträge`} korrigiert
            </div>
            {unseen.slice(0, 5).map((c) => (
              <div key={c.id} style={{ color: "var(--text)" }}>
                <strong>{dayDE(c.entry_date)}</strong>{" "}
                <span style={{ color: "var(--muted)" }}>{describeEntry(c.before)} →</span> {describeEntry(c.after)}
                <div style={{ color: "var(--muted)", fontSize: 11 }}>Grund: „{c.reason}“</div>
              </div>
            ))}
            {unseen.length > 5 && <div style={{ color: "var(--muted)" }}>… und {unseen.length - 5} weitere</div>}
          </div>
          <button type="button" style={btn} disabled={seen.isPending} onClick={() => seen.mutate()}>
            {seen.isPending ? "…" : "Verstanden"}
          </button>
        </div>
      )}

      {closing?.status === "approved" ? (
        <div role="status" style={{ ...box, ...tint("var(--green)") }}>
          <span>
            🔒 <strong style={{ color: "var(--green)" }}>{MONTHS[month - 1]} von deiner Firma freigegeben</strong>
            {closing.approved_at && <> am {dateDE(closing.approved_at)}</>}
            <span style={{ color: "var(--muted)" }}> · Änderungen nur noch durch die Firma</span>
          </span>
        </div>
      ) : closing?.status === "submitted" ? (
        <div role="status" style={{ ...box, ...tint("var(--accent2)") }}>
          <span>
            📤 <strong style={{ color: "var(--accent2)" }}>{MONTHS[month - 1]} eingereicht</strong>
            {closing.submitted_at && <> am {dateDE(closing.submitted_at)}</>}
            <span style={{ color: "var(--muted)" }}> · wartet auf Freigabe</span>
          </span>
          <button type="button" style={btn} disabled={submit.isPending} onClick={() => run("withdraw")}>
            {submit.isPending ? "…" : "Zurückziehen"}
          </button>
        </div>
      ) : !isFuture && closings.isSuccess ? (
        <div style={{ ...box, ...tint("var(--accent)") }}>
          <span style={{ color: "var(--muted)" }}>
            Alles eingetragen? Reiche <strong style={{ color: "var(--text)" }}>{MONTHS[month - 1]}</strong> bei deiner Firma ein.
          </span>
          <button type="button" style={{ ...btn, background: "var(--accent)", color: "white", border: "none" }}
            disabled={submit.isPending} onClick={() => run("submit")}>
            {submit.isPending ? "…" : "📤 Monat einreichen"}
          </button>
        </div>
      ) : null}
      {error && <div role="alert" style={{ margin: "-6px 16px 12px", fontSize: 12, color: "var(--red)" }}>⚠️ {error}</div>}
    </>
  );
}
