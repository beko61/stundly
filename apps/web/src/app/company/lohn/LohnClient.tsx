"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { lohnCsv, type LohnRow } from "@/lib/company/lohn";
import { downloadFile } from "@/lib/share/shareFile";

function slug(s: string) {
  return s.replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "Firma";
}

/* ── Export + Versand ──────────────────────────────────────────────────── */

export function LohnActions({ rows, year, month, monthLabel, firma, steuerberaterEmail }: {
  rows: LohnRow[]; year: number; month: number; monthLabel: string; firma: string; steuerberaterEmail: string | null;
}) {
  const base = `Lohn-Vorbereitung_${slug(firma)}_${year}-${String(month).padStart(2, "0")}`;
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // PDF vorab erzeugen — der Download-Klick muss synchron bleiben (iOS blockt nach await)
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    if (rows.length === 0) return;
    void import("@/lib/pdf/lohnPdf")
      .then(({ generateLohnPdf }) => generateLohnPdf({ firma, monthLabel, rows }))
      .then((blob) => { if (!cancelled) setPdf(new File([blob], `${base}.pdf`, { type: "application/pdf" })); })
      .catch(() => { /* PDF optional */ });
    return () => { cancelled = true; };
  }, [rows, firma, monthLabel, base]);

  async function send() {
    if (!steuerberaterEmail) return;
    if (!confirm(`Lohn-Vorbereitung ${monthLabel} jetzt an ${steuerberaterEmail} senden?`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/company/lohn/send", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, month }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      setMsg(res.ok ? { ok: true, text: `Gesendet an ${steuerberaterEmail}` } : { ok: false, text: json.error ?? "Senden fehlgeschlagen" });
    } catch { setMsg({ ok: false, text: "Netzwerkfehler" }); } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" style={{ fontSize: 13 }} disabled={rows.length === 0}
          onClick={() => downloadFile(new File([lohnCsv(rows)], `${base}.csv`, { type: "text/csv;charset=utf-8" }))}>
          📊 CSV
        </button>
        <button type="button" className="btn" style={{ fontSize: 13 }} disabled={!pdf} onClick={() => pdf && downloadFile(pdf)}>
          {pdf || rows.length === 0 ? "📄 PDF" : "PDF wird erstellt…"}
        </button>
        {steuerberaterEmail ? (
          <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} disabled={busy || rows.length === 0} onClick={() => void send()}>
            {busy ? "Wird gesendet…" : "✉️ An Steuerberater senden"}
          </button>
        ) : (
          <a href="#mail-einstellungen" className="btn" style={{ fontSize: 13, textDecoration: "none" }}>✉️ Steuerberater eintragen</a>
        )}
      </div>
      {msg && <div role={msg.ok ? "status" : "alert"} style={{ fontSize: 12, marginTop: 8, color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.ok ? "✓ " : "⚠️ "}{msg.text}</div>}
    </div>
  );
}

/* ── Mail-Einstellungen ───────────────────────────────────────────────── */

export function LohnSettingsCard({ email, auto, digest, supported }: { email: string | null; auto: boolean; digest: boolean; supported: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(email ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(patch: Record<string, unknown>, key: string) {
    setBusy(key); setMsg(null);
    try {
      const res = await fetch("/api/company/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setMsg({ ok: false, text: json.error ?? "Speichern fehlgeschlagen" }); return; }
      setMsg({ ok: true, text: "Gespeichert" });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Netzwerkfehler" }); } finally { setBusy(null); }
  }

  if (!supported) {
    return <div className="card" style={{ padding: "16px 18px", fontSize: 12, color: "var(--muted)" }}>✉️ E-Mail-Einstellungen in Kürze verfügbar.</div>;
  }

  const row: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, cursor: "pointer" };
  return (
    <div className="card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 14 }}>✉️ E-Mails</div>
      <div>
        <label className="label" htmlFor="stb-mail">Steuerberater / Lohnbüro</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input id="stb-mail" className="input" type="email" inputMode="email" placeholder="lohn@steuerbuero.de"
            value={value} onChange={(e) => setValue(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} disabled={busy !== null}
            onClick={() => void save({ steuerberater_email: value.trim() || null }, "mail")}>
            {busy === "mail" ? "…" : "Speichern"}
          </button>
        </div>
      </div>
      <label style={{ ...row, opacity: email ? 1 : 0.5 }}>
        <input type="checkbox" checked={auto} disabled={!email || busy !== null}
          onChange={(e) => void save({ steuerberater_auto: e.target.checked }, "auto")} style={{ width: 18, height: 18, marginTop: 1 }} />
        <span>
          <strong>Automatisch am 5. senden</strong>
          <span style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>
            Die Lohn-Vorbereitung des Vormonats geht dann jeden Monat von selbst an das Lohnbüro.
          </span>
        </span>
      </label>
      <label style={row}>
        <input type="checkbox" checked={digest} disabled={busy !== null}
          onChange={(e) => void save({ team_digest_enabled: e.target.checked }, "digest")} style={{ width: 18, height: 18, marginTop: 1 }} />
        <span>
          <strong>Montags-Überblick an mich</strong>
          <span style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>
            Jeden Montag früh: Team-Stunden der letzten Woche, Rufbereitschaft und was zu erledigen ist.
          </span>
        </span>
      </label>
      {msg && <div role={msg.ok ? "status" : "alert"} style={{ fontSize: 12, color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</div>}
    </div>
  );
}
