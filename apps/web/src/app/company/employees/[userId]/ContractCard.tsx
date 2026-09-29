"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { monthlyTargetFromWeekly, type Contract } from "@/lib/company/contract";

interface Props {
  userId:    string;
  contract:  Contract | null;
  /** false = Migration 033 fehlt noch → Karte nur als Hinweis */
  supported: boolean;
}

const numOrNull = (s: string): number | null => {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

export function ContractCard({ userId, contract, supported }: Props) {
  const router = useRouter();
  const [weekly, setWeekly] = useState(contract?.weekly_hours != null ? String(contract.weekly_hours).replace(".", ",") : "");
  const [vacation, setVacation] = useState(contract?.vacation_days != null ? String(contract.vacation_days) : "");
  const [start, setStart] = useState(contract?.start_date ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const weeklyNum = numOrNull(weekly);

  async function save(body: Contract) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/company/employees/${userId}/contract`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: (json as { error?: string }).error ?? "Speichern fehlgeschlagen" });
        return;
      }
      setMsg({ ok: true, text: "Gespeichert" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Netzwerkfehler" });
    } finally {
      setBusy(false);
    }
  }

  function onSave() {
    const vac = numOrNull(vacation);
    if (weekly.trim() && (weeklyNum == null || weeklyNum < 1 || weeklyNum > 60)) {
      setMsg({ ok: false, text: "Wochenstunden zwischen 1 und 60" }); return;
    }
    if (vacation.trim() && (vac == null || !Number.isInteger(vac) || vac < 0 || vac > 60)) {
      setMsg({ ok: false, text: "Urlaubstage als ganze Zahl zwischen 0 und 60" }); return;
    }
    void save({
      weekly_hours:  weekly.trim() ? weeklyNum : null,
      vacation_days: vacation.trim() ? vac : null,
      start_date:    start || null,
    });
  }

  function onReset() {
    setWeekly(""); setVacation(""); setStart("");
    void save({ weekly_hours: null, vacation_days: null, start_date: null });
  }

  if (!supported) {
    return (
      <div className="card" style={{ padding: "16px 20px", marginBottom: 28, fontSize: 13, color: "var(--muted)" }}>
        📄 Vertragsdaten sind in Kürze verfügbar.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "18px 20px", marginBottom: 28 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
        Was du hier festlegst, gilt für Soll-Stunden, Überstunden und Urlaubskonto — der Mitarbeiter sieht die Werte,
        kann sie aber nicht mehr selbst ändern. Leer lassen = Mitarbeiter trägt selbst ein.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div>
          <label className="label" htmlFor="ct-weekly">Wochenstunden</label>
          <input id="ct-weekly" className="input" inputMode="decimal" placeholder="z. B. 40"
            value={weekly} onChange={e => setWeekly(e.target.value)} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            {weeklyNum != null && weeklyNum >= 1 && weeklyNum <= 60
              ? `= ${monthlyTargetFromWeekly(weeklyNum).toLocaleString("de-DE")} h Soll pro Monat`
              : "Soll pro Monat = Wochenstunden × 52 ÷ 12"}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ct-vac">Urlaubstage / Jahr</label>
          <input id="ct-vac" className="input" inputMode="numeric" placeholder="z. B. 30"
            value={vacation} onChange={e => setVacation(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
        <div>
          <label className="label" htmlFor="ct-start">Beschäftigt seit</label>
          <input id="ct-start" className="input" type="date" value={start} onChange={e => setStart(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={busy} style={{ fontSize: 13 }}>
          {busy ? "Speichert…" : "Speichern"}
        </button>
        {contract && (
          <button type="button" className="btn" onClick={onReset} disabled={busy} style={{ fontSize: 13 }}>
            Zurücksetzen
          </button>
        )}
        {msg && (
          <span role={msg.ok ? "status" : "alert"} style={{ fontSize: 12, color: msg.ok ? "var(--green)" : "var(--red)" }}>
            {msg.ok ? "✓ " : "⚠️ "}{msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
