"use client";

import { useEffect, useState } from "react";
import type React from "react";

/**
 * Settings → "Datenschutz & Konto" (DSGVO Art. 15/17/20).
 *   - Daten herunterladen: GET /api/dsgvo/export → JSON-Datei
 *   - Konto löschen: POST /api/dsgvo/delete (30 Tage Wartefrist, Cron löscht danach)
 *   - Löschantrag widerrufen: DELETE /api/dsgvo/delete
 * Firmenkonten löschen nicht selbst (Arbeitgeber = Verantwortlicher, Aufbewahrungspflicht).
 */

interface DeleteStatus {
  pending: { scheduled_for: string } | null;
  selfService: boolean;
}

const CONFIRM_WORD = "LÖSCHEN";

const btn: React.CSSProperties = {
  width: "100%", padding: "12px", borderRadius: 10,
  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function Notice({ tone, children }: { tone: "red" | "green" | "orange"; children: React.ReactNode }) {
  return (
    <div role={tone === "red" ? "alert" : "status"} style={{
      marginBottom: 12, padding: "10px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.6,
      background: `color-mix(in srgb, var(--${tone}) 12%, transparent)`,
      border: `1px solid color-mix(in srgb, var(--${tone}) 30%, transparent)`,
      color: `var(--${tone})`,
    }}>
      {children}
    </div>
  );
}

export function PrivacyAccountCard() {
  const [status, setStatus]         = useState<DeleteStatus | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [info, setInfo]             = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dsgvo/delete")
      .then(r => (r.ok ? r.json() as Promise<DeleteStatus> : null))
      .then(d => { if (!cancelled && d) setStatus(d); })
      .catch(() => { /* Status optional — Export bleibt nutzbar */ });
    return () => { cancelled = true; };
  }, []);

  async function handleExport() {
    setExportBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dsgvo/export");
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? "Export fehlgeschlagen.");
        return;
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "stundly-daten.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen.");
    } finally {
      setExportBusy(false);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dsgvo/delete", { method: "POST" });
      const d = await res.json().catch(() => ({})) as { error?: string; scheduled_for?: string };
      if (!res.ok || !d.scheduled_for) {
        setError(d.error ?? "Löschantrag fehlgeschlagen.");
        return;
      }
      setStatus(s => ({ selfService: s?.selfService ?? true, pending: { scheduled_for: d.scheduled_for! } }));
      setConfirmOpen(false);
      setConfirmText("");
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleRevoke() {
    setError(null);
    try {
      const res = await fetch("/api/dsgvo/delete", { method: "DELETE" });
      if (!res.ok) { setError("Widerruf fehlgeschlagen."); return; }
      setStatus(s => ({ selfService: s?.selfService ?? true, pending: null }));
      setInfo("✅ Löschantrag widerrufen — dein Konto bleibt bestehen.");
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen.");
    }
  }

  const confirmed = confirmText === CONFIRM_WORD;

  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 8 }}>🔒 Datenschutz & Konto</div>

      {error && <Notice tone="red">❌ {error}</Notice>}
      {info && <Notice tone="green">{info}</Notice>}

      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 }}>
        Alle deine Daten (Profil, Zeiteinträge, Notdienste, Urlaub, Lohn) als JSON-Datei —
        DSGVO Art. 15 &amp; 20.
      </p>
      <button type="button" onClick={() => void handleExport()} disabled={exportBusy} style={{
        ...btn, marginBottom: 14,
        background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
        cursor: exportBusy ? "wait" : "pointer",
      }}>
        {exportBusy ? "Wird erstellt…" : "📦 Meine Daten herunterladen"}
      </button>

      {status?.pending ? (
        <>
          <Notice tone="orange">
            ⏳ Dein Konto wird am <strong>{formatDate(status.pending.scheduled_for)}</strong> mit
            allen Daten endgültig gelöscht. Bis dahin kannst du den Antrag widerrufen.
          </Notice>
          <button type="button" onClick={() => void handleRevoke()} style={{
            ...btn, background: "transparent", border: "1px solid var(--green)", color: "var(--green)",
          }}>
            Löschantrag widerrufen
          </button>
        </>
      ) : status && !status.selfService ? (
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          Dein Konto gehört zu einem Firmenkonto. Die Löschung beantragst du bei deinem
          Arbeitgeber (Firmen-Admin) — Arbeitszeitnachweise unterliegen gesetzlichen
          Aufbewahrungspflichten.
        </p>
      ) : status ? (
        <button type="button" onClick={() => { setConfirmOpen(true); setConfirmText(""); setError(null); setInfo(null); }} style={{
          ...btn, background: "transparent", border: "1px solid var(--red)", color: "var(--red)",
        }}>
          🗑 Konto löschen…
        </button>
      ) : null}

      {confirmOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !deleteBusy) setConfirmOpen(false); }}>
          <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="delete-account-title" style={{ maxWidth: 480 }}>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <h2 id="delete-account-title" style={{ fontSize: 18, fontWeight: 800, textAlign: "center", marginBottom: 12 }}>
              Konto wirklich löschen?
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, marginBottom: 14, textAlign: "center" }}>
              Dein Konto und <strong style={{ color: "var(--red)" }}>alle Daten</strong> werden nach
              30 Tagen unwiderruflich gelöscht. Bis dahin kannst du den Antrag hier widerrufen.
              <br />
              Tipp: Lade vorher deine Daten herunter.
            </p>
            <label htmlFor="delete-confirm" style={{ display: "block", fontSize: 12, color: "var(--text)", fontWeight: 700, marginBottom: 6 }}>
              Tippe <code style={{ background: "var(--surface2)", padding: "2px 8px", borderRadius: 4, color: "var(--red)" }}>{CONFIRM_WORD}</code> ein, um fortzufahren:
            </label>
            <input id="delete-confirm" className="input" value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD} autoComplete="off" spellCheck={false} style={{ marginBottom: 12 }} />
            {error && <Notice tone="red">❌ {error}</Notice>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={deleteBusy} style={{
                ...btn, flex: 1, background: "transparent", border: "1px solid var(--border)", color: "var(--muted)",
              }}>
                Abbrechen
              </button>
              <button type="button" onClick={() => void handleDelete()} disabled={deleteBusy || !confirmed} style={{
                ...btn, flex: 1, border: "1px solid var(--red)", color: "white",
                background: confirmed ? "var(--red)" : "color-mix(in srgb, var(--red) 30%, transparent)",
                cursor: deleteBusy || !confirmed ? "not-allowed" : "pointer",
                opacity: deleteBusy || !confirmed ? 0.6 : 1,
              }}>
                {deleteBusy ? "Wird beantragt…" : "Konto löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
