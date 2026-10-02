"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { calculateWorkDuration } from "@workly/shared";
import { createClient } from "@/lib/supabase/client";
import { formatDur } from "@/lib/utils/formatDur";
import { dataUrlToFile, downloadFile } from "@/lib/share/shareFile";
import { generateNotdienstReportPdf, reportFileName, fotoFileName, formatDateDE } from "@/lib/pdf/notdienstReportPdf";
import { applyBriefkopf, loadMyBriefkopf } from "@/lib/company/briefkopf";

export interface TeamNotdienst {
  id:            string;
  date:          string;
  start_time:    string;
  end_time:      string;
  kunde:         string | null;
  kunde_telefon: string | null;
  adresse:       string | null;
  problem:       string | null;
  ergebnis:      string | null;
  note:          string | null;
  erledigt:      boolean;
  /** Team-Ansicht (Notdienst-Zentrale): wem gehört der Einsatz */
  user_id?:      string;
  name?:         string;
}

interface Anhang { id: string; art: "foto" | "unterschrift"; data: string; unterzeichner: string | null; created_at: string }

interface Props {
  /** Einzelansicht: Mitarbeiter-ID. Team-Ansicht: null (dann entry.user_id) */
  userId:  string | null;
  entries: TeamNotdienst[];
}

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "–");
const durOf = (e: TeamNotdienst) => formatDur(calculateWorkDuration(hhmm(e.start_time), hhmm(e.end_time), 0).net_minutes);

const smallBtn: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
  background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
  fontFamily: "'Syne',sans-serif",
};

export function TeamNotdienstList({ userId, entries }: Props) {
  const router = useRouter();
  const [paid, setPaid] = useState<Record<string, boolean>>(() => Object.fromEntries(entries.map(e => [e.id, e.erledigt])));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const offen = entries.filter(e => !paid[e.id]);

  async function setBezahlt(id: string, value: boolean): Promise<boolean> {
    const res = await fetch(`/api/company/notdienst/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ erledigt: value }),
    }).catch(() => null);
    if (!res?.ok) return false;
    setPaid(p => ({ ...p, [id]: value }));
    return true;
  }

  async function toggle(id: string) {
    setBusy(id); setError(null);
    const ok = await setBezahlt(id, !paid[id]);
    setBusy(null);
    if (!ok) setError("Bezahlt-Status konnte nicht gespeichert werden.");
    else router.refresh();
  }

  async function alleBezahlt() {
    setBusy("all"); setError(null);
    let failed = 0;
    for (const e of offen) if (!(await setBezahlt(e.id, true))) failed++;
    setBusy(null);
    if (failed) setError(`${failed} Einsatz/Einsätze konnten nicht gespeichert werden.`);
    router.refresh();
  }

  if (entries.length === 0) {
    return (
      <div className="card" style={{ padding: 24, color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
        Keine Notdienste in diesem Monat.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 32 }}>
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>⚠️ {error}</div>}
      {offen.length > 1 && (
        <button type="button" onClick={() => void alleBezahlt()} disabled={busy !== null}
          style={{ ...smallBtn, marginBottom: 10, borderColor: "var(--green)", color: "var(--green)" }}>
          {busy === "all" ? "Speichert…" : `✅ Alle ${offen.length} offenen als bezahlt markieren`}
        </button>
      )}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {entries.map((e, i) => {
          const isOpen = open === e.id;
          const bezahlt = !!paid[e.id];
          const dow = new Date(`${e.date}T00:00:00`).getDay();
          return (
            <div key={e.id} style={{ borderBottom: i < entries.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : e.id)} aria-expanded={isOpen}
                  style={{
                    flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none",
                    color: "var(--text)", cursor: "pointer", padding: 0, fontFamily: "inherit",
                  }}>
                  {e.name && <div style={{ fontSize: 11, fontWeight: 800, color: "var(--accent2)", marginBottom: 1 }}>{e.name}</div>}
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {WD[dow]} {formatDateDE(e.date)} · {hhmm(e.start_time)}–{hhmm(e.end_time)}
                    <span style={{ color: "var(--orange)", marginLeft: 6, whiteSpace: "nowrap" }}>{durOf(e)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[e.kunde, e.adresse].filter(Boolean).join(" · ") || "Ohne Kundenangabe"}
                  </div>
                </button>
                <button type="button" onClick={() => void toggle(e.id)} disabled={busy !== null}
                  aria-label={bezahlt ? "Als unbezahlt markieren" : "Als bezahlt markieren"}
                  style={{
                    padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: "pointer", flexShrink: 0,
                    background: `color-mix(in srgb, ${bezahlt ? "var(--green)" : "var(--orange)"} 14%, transparent)`,
                    color: bezahlt ? "var(--green)" : "var(--orange)",
                    border: `1px solid color-mix(in srgb, ${bezahlt ? "var(--green)" : "var(--orange)"} 35%, transparent)`,
                    fontFamily: "'Syne',sans-serif",
                  }}>
                  {busy === e.id ? "…" : bezahlt ? "✅ Bezahlt" : "⏳ Offen"}
                </button>
              </div>
              {isOpen && <EinsatzDetails userId={e.user_id ?? userId ?? ""} entry={e} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 13, whiteSpace: "pre-line", overflowWrap: "anywhere", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function EinsatzDetails({ userId, entry }: { userId: string; entry: TeamNotdienst }) {
  const [anhaenge, setAnhaenge] = useState<Anhang[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [big, setBig] = useState<string | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Anhänge erst beim Aufklappen laden (je Foto ~100 KB)
  useEffect(() => {
    let cancelled = false;
    void createClient()
      .from("notdienst_anhaenge")
      .select("id, art, data, unterzeichner, created_at")
      .eq("notdienst_id", entry.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadError(true);
        else setAnhaenge((data ?? []) as Anhang[]);
      });
    return () => { cancelled = true; };
  }, [entry.id]);

  const fotos = (anhaenge ?? []).filter(a => a.art === "foto");
  const unterschrift = (anhaenge ?? []).find(a => a.art === "unterschrift") ?? null;
  const kunde = entry.kunde ?? "";

  async function erstellen() {
    setGenerating(true); setPdfError(null);
    try {
      const supabase = createClient();
      const [{ data: pRaw }, briefkopf] = await Promise.all([
        supabase.from("profiles")
          .select("vorname,nachname,email,company_name,firma_strasse,firma_plz,firma_ort,firma_telefon,logo_data,signature_data")
          .eq("user_id", userId).maybeSingle(),
        loadMyBriefkopf(supabase),
      ]);
      // Briefkopf der Firma (Chef und Mitarbeiter gehören zur selben Firma)
      const p = pRaw ? applyBriefkopf(pRaw, briefkopf) : pRaw;
      const blob = await generateNotdienstReportPdf({
        date: entry.date, start: hhmm(entry.start_time), end: hhmm(entry.end_time), duration: durOf(entry),
        kunde, telefon: entry.kunde_telefon ?? "", adresse: entry.adresse ?? "",
        problem: entry.problem ?? "", ergebnis: entry.ergebnis ?? "", note: entry.note ?? "",
        fotoAnzahl: fotos.length,
        signature: unterschrift
          ? { data: unterschrift.data, name: unterschrift.unterzeichner ?? "", signedAt: unterschrift.created_at }
          : null,
        firma: {
          name: p?.company_name ?? "", strasse: p?.firma_strasse ?? "", plz: p?.firma_plz ?? "",
          ort: p?.firma_ort ?? "", telefon: p?.firma_telefon ?? "", email: p?.email ?? "", logo: p?.logo_data ?? null,
        },
        techniker: {
          name: [p?.vorname, p?.nachname].filter(Boolean).join(" ") || (p?.email ?? ""),
          signature: p?.signature_data ?? null,
        },
      });
      const pdf = new File([blob], reportFileName(entry.date, kunde), { type: "application/pdf" });
      const bilder = fotos.map((f, i) => {
        const mime = f.data.match(/^data:([^;]+)/)?.[1] ?? "image/jpeg";
        return dataUrlToFile(f.data, fotoFileName(entry.date, kunde, i + 1, mime));
      });
      setFiles([pdf, ...bilder]);
    } catch {
      setPdfError("PDF-Bericht konnte nicht erstellt werden.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ padding: "4px 14px 16px", display: "flex", flexDirection: "column", gap: 12, background: "var(--surface2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, paddingTop: 10 }}>
        <Field label="Kunde" value={entry.kunde} />
        <Field label="Telefon" value={entry.kunde_telefon} />
        <Field label="Adresse" value={entry.adresse} />
      </div>
      <Field label="Problem" value={entry.problem} />
      <Field label="Ergebnis" value={entry.ergebnis} />
      <Field label="Notiz" value={entry.note} />

      {loadError && <div style={{ fontSize: 12, color: "var(--muted)" }}>Fotos &amp; Unterschrift sind gerade nicht verfügbar.</div>}
      {!anhaenge && !loadError && <div style={{ fontSize: 12, color: "var(--muted)" }}>Fotos werden geladen…</div>}

      {fotos.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Fotos ({fotos.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
            {fotos.map((f, i) => (
              <button key={f.id} type="button" onClick={() => setBig(big === f.id ? null : f.id)}
                aria-label={`Foto ${i + 1} vergrößern`}
                style={{ padding: 0, border: "none", borderRadius: 8, overflow: "hidden", aspectRatio: "1", cursor: "zoom-in", background: "var(--surface)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.data} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
          {big && (
            <button type="button" onClick={() => setBig(null)} aria-label="Foto schließen"
              style={{ marginTop: 8, padding: 0, border: "none", background: "transparent", cursor: "zoom-out", width: "100%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotos.find(f => f.id === big)?.data} alt="Foto groß" style={{ maxWidth: "100%", maxHeight: 480, borderRadius: 8, display: "block", margin: "0 auto" }} />
            </button>
          )}
        </div>
      )}

      {unterschrift && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "white", borderRadius: 8, padding: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={unterschrift.data} alt="Unterschrift des Kunden" style={{ height: 40, maxWidth: 140, display: "block" }} />
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            ✍️ Unterschrieben{unterschrift.unterzeichner ? ` von ${unterschrift.unterzeichner}` : ""}
          </span>
        </div>
      )}

      {pdfError && <div role="alert" style={{ fontSize: 12, color: "var(--red)" }}>⚠️ {pdfError}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {files ? (
          <>
            <button type="button" style={{ ...smallBtn, borderColor: "var(--green)", color: "var(--green)" }}
              onClick={() => downloadFile(files[0]!)}>
              📥 PDF herunterladen
            </button>
            {files.length > 1 && (
              <button type="button" style={smallBtn} onClick={() => files.slice(1).forEach(downloadFile)}>
                📷 {files.length - 1} Foto{files.length > 2 ? "s" : ""} herunterladen
              </button>
            )}
          </>
        ) : (
          <button type="button" style={smallBtn} onClick={() => void erstellen()} disabled={generating || (!anhaenge && !loadError)}>
            {generating ? "Bericht wird erstellt…" : "📄 PDF-Bericht erstellen"}
          </button>
        )}
      </div>
    </div>
  );
}
