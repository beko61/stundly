"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import SignatureCanvas from "react-signature-canvas";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image/compressImage";
import { dataUrlToFile, shareOrDownload } from "@/lib/share/shareFile";
import { buildBerichtText } from "@/lib/notdienst/berichtText";
import {
  generateNotdienstReportPdf, reportFileName, fotoFileName, type NotdienstReportInput,
} from "@/lib/pdf/notdienstReportPdf";
import {
  MAX_FOTOS, useAddFoto, useDeleteAnhang, useNotdienstAnhaenge, useSaveUnterschrift,
} from "@/hooks/queries/useNotdienstAnhaenge";

/** Formularwerte des Einsatzes, die in den Bericht gehen. */
export type BerichtDaten = Pick<NotdienstReportInput,
  "date" | "start" | "end" | "duration" | "kunde" | "telefon" | "adresse" | "problem" | "ergebnis" | "note">;

interface Props {
  /** null = Einsatz noch nicht gespeichert (Anhänge brauchen die ID) */
  notdienstId: string | null;
  bericht: BerichtDaten;
}

const box: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 12, padding: 14,
  display: "flex", flexDirection: "column", gap: 12,
};
const smallBtn: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 10, fontFamily: "'Syne',sans-serif",
  fontSize: 12, fontWeight: 700, cursor: "pointer", background: "var(--surface2)",
  border: "1px solid var(--border)", color: "var(--text)",
};
const bigBtn: React.CSSProperties = {
  width: "100%", padding: 14, borderRadius: 12, border: "none", color: "white",
  fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};

/** Leeren Rand der Unterschrift abschneiden (sonst wirkt sie im PDF winzig). */
function trimmedSignature(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      if (px[(yy * width + xx) * 4 + 3]! > 0) {
        if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
        if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
      }
    }
  }
  if (maxX < 0) return canvas.toDataURL("image/png");
  const PAD = 6;
  const x = Math.max(0, minX - PAD), y = Math.max(0, minY - PAD);
  const w = Math.min(width, maxX + PAD + 1) - x, h = Math.min(height, maxY + PAD + 1) - y;
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  out.getContext("2d")?.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return out.toDataURL("image/png");
}

export function NotdienstBerichtPanel({ notdienstId, bericht }: Props) {
  const anhaenge = useNotdienstAnhaenge(notdienstId);
  const addFoto = useAddFoto(notdienstId);
  const delAnhang = useDeleteAnhang(notdienstId);
  const saveSig = useSaveUnterschrift(notdienstId);

  const fotos = (anhaenge.data ?? []).filter(a => a.art === "foto");
  const unterschrift = (anhaenge.data ?? []).find(a => a.art === "unterschrift") ?? null;

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);

  // ── Unterschrift ──
  const [sigOpen, setSigOpen] = useState(false);
  const [sigName, setSigName] = useState(bericht.kunde);
  const sigRef = useRef<SignatureCanvas>(null);
  const sigWrap = useRef<HTMLDivElement>(null);
  const [sigWidth, setSigWidth] = useState(320);
  useLayoutEffect(() => {
    // Canvas-Pixelbreite = sichtbare Breite, sonst sind die Striche versetzt
    if (sigOpen && sigWrap.current) setSigWidth(Math.max(200, sigWrap.current.clientWidth));
  }, [sigOpen]);

  // ── Bericht: erst erzeugen, dann (in eigener Klick-Geste) teilen ──
  // report = [PDF, Foto-1.jpg, …] — Fotos als einzelne Dateien (Auftraggeber leiten sie weiter)
  const [report, setReport] = useState<File[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [shareInfo, setShareInfo] = useState<string | null>(null);
  const stamp = JSON.stringify([bericht, (anhaenge.data ?? []).map(a => a.id)]);
  useEffect(() => { setReport(null); setShareInfo(null); }, [stamp]);

  if (!notdienstId) {
    return (
      <div style={{ ...box, color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
        📎 Speichere den Notdienst zuerst — danach kannst du Fotos, die Unterschrift des Kunden
        und einen PDF-Bericht hinzufügen.
      </div>
    );
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_FOTOS - fotos.length);
    e.target.value = "";
    setError(null);
    for (const f of files) {
      setUploading(n => n + 1);
      try {
        await addFoto.mutateAsync(await compressImage(f));
      } catch (err) {
        setError(err instanceof Error && err.message === "Foto ist zu groß"
          ? "Foto ist zu groß." : "Foto konnte nicht gespeichert werden.");
      } finally {
        setUploading(n => n - 1);
      }
    }
  }

  async function handleSaveSig() {
    const pad = sigRef.current;
    if (!pad || pad.isEmpty()) { setError("Bitte zuerst unterschreiben lassen."); return; }
    setError(null);
    try {
      await saveSig.mutateAsync({ data: trimmedSignature(pad.getCanvas()), name: sigName });
      setSigOpen(false);
    } catch {
      setError("Unterschrift konnte nicht gespeichert werden.");
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const { data: p } = session?.user
        ? await supabase.from("profiles")
            .select("vorname,nachname,email,company_name,firma_strasse,firma_plz,firma_ort,firma_telefon,logo_data,signature_data")
            .eq("user_id", session.user.id).maybeSingle()
        : { data: null };
      const blob = await generateNotdienstReportPdf({
        ...bericht,
        fotoAnzahl: fotos.length,
        signature: unterschrift
          ? { data: unterschrift.data, name: unterschrift.unterzeichner ?? "", signedAt: unterschrift.created_at }
          : null,
        firma: {
          name: p?.company_name ?? "", strasse: p?.firma_strasse ?? "", plz: p?.firma_plz ?? "",
          ort: p?.firma_ort ?? "", telefon: p?.firma_telefon ?? "", email: p?.email ?? "", logo: p?.logo_data ?? null,
        },
        techniker: {
          name: [p?.vorname, p?.nachname].filter(Boolean).join(" ") || session?.user?.email || "",
          signature: p?.signature_data ?? null,
        },
      });
      const pdf = new File([blob], reportFileName(bericht.date, bericht.kunde), { type: "application/pdf" });
      const bilder = fotos.map((f, i) => {
        const mime = f.data.match(/^data:([^;]+)/)?.[1] ?? "image/jpeg";
        return dataUrlToFile(f.data, fotoFileName(bericht.date, bericht.kunde, i + 1, mime));
      });
      setReport([pdf, ...bilder]);
    } catch {
      setError("PDF-Bericht konnte nicht erstellt werden.");
    } finally {
      setGenerating(false);
    }
  }

  function handleShare() {
    if (!report) return;
    // Direkt in der Klick-Geste — kein await davor (sonst blockiert der Browser das Teilen-Menü)
    // Betreff + kompletter Bericht als Mail-Text (Outlook/Mail übernehmen ihn), PDF + Fotos als Anhänge
    const { subject, body } = buildBerichtText({ ...bericht, fotoAnzahl: report.length - 1 });
    void shareOrDownload(report, { title: subject, text: body }).then(r => {
      if (r === "downloaded") {
        setShareInfo(report.length > 1
          ? `📥 PDF + ${report.length - 1} Fotos heruntergeladen — im Mail-Programm als Anhänge hinzufügen.`
          : "📥 PDF heruntergeladen — im Mail-Programm als Anhang hinzufügen.");
      }
    });
  }

  const dbFehler = anhaenge.isError;

  return (
    <div style={box}>
      <div className="label" style={{ margin: 0 }}>📎 Fotos, Unterschrift &amp; Bericht</div>

      {error && (
        <div role="alert" style={{
          padding: "8px 10px", borderRadius: 8, fontSize: 12, color: "var(--red)",
          background: "color-mix(in srgb, var(--red) 12%, transparent)",
        }}>⚠️ {error}</div>
      )}
      {dbFehler && (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Fotos &amp; Unterschrift sind gerade nicht verfügbar.
        </div>
      )}

      {/* Fotos */}
      {!dbFehler && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8, marginBottom: 8 }}>
            {fotos.map((f, i) => (
              <div key={f.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: "var(--surface2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.data} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button type="button" aria-label={`Foto ${i + 1} löschen`} onClick={() => delAnhang.mutate(f.id)} style={{
                  position: "absolute", top: 2, right: 2, width: 26, height: 26, borderRadius: 13,
                  border: "none", background: "rgba(0,0,0,0.65)", color: "white", fontSize: 13, cursor: "pointer",
                }}>✕</button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`up-${i}`} role="status" aria-label="Foto wird gespeichert" style={{
                aspectRatio: "1", borderRadius: 8, background: "var(--surface2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)",
              }}>…</div>
            ))}
          </div>
          {fotos.length + uploading < MAX_FOTOS ? (
            <label style={{ ...smallBtn, display: "inline-flex", gap: 6, alignItems: "center" }}>
              📷 Foto hinzufügen
              <input type="file" accept="image/*" multiple onChange={handleFiles}
                aria-label="Foto hinzufügen" style={{ display: "none" }} />
            </label>
          ) : (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Maximal {MAX_FOTOS} Fotos.</span>
          )}
        </div>
      )}

      {/* Unterschrift */}
      {!dbFehler && (sigOpen ? (
        <div>
          <label className="label" htmlFor="nd-sig-name">Name des Kunden</label>
          <input id="nd-sig-name" className="input" value={sigName} onChange={e => setSigName(e.target.value)}
            placeholder="z.B. Frau Kraft" style={{ marginBottom: 8 }} />
          <div ref={sigWrap} style={{ background: "white", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
            <SignatureCanvas ref={sigRef} penColor="#111"
              canvasProps={{ width: sigWidth, height: 160, "aria-label": "Unterschriftfeld", style: { display: "block", width: "100%", height: 160, touchAction: "none" } }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 8px" }}>
            Kunde unterschreibt mit dem Finger im weißen Feld.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ ...smallBtn, flex: 1 }} onClick={() => sigRef.current?.clear()}>Leeren</button>
            <button type="button" style={{ ...smallBtn, flex: 1 }} onClick={() => setSigOpen(false)}>Abbrechen</button>
            <button type="button" style={{ ...smallBtn, flex: 1, background: "var(--green)", color: "white", border: "none" }}
              onClick={() => void handleSaveSig()} disabled={saveSig.isPending}>
              {saveSig.isPending ? "Speichert…" : "Übernehmen"}
            </button>
          </div>
        </div>
      ) : unterschrift ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ background: "white", borderRadius: 8, padding: 4, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={unterschrift.data} alt="Unterschrift des Kunden" style={{ height: 40, maxWidth: 120, display: "block" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--muted)" }}>
            ✅ Unterschrieben{unterschrift.unterzeichner ? ` von ${unterschrift.unterzeichner}` : ""}
          </div>
          <button type="button" style={smallBtn} onClick={() => { setSigName(unterschrift.unterzeichner ?? bericht.kunde); setSigOpen(true); }}>
            Neu
          </button>
        </div>
      ) : (
        <button type="button" style={smallBtn} onClick={() => { setSigName(bericht.kunde); setSigOpen(true); }}>
          ✍️ Kunde unterschreiben lassen
        </button>
      ))}

      {/* Bericht */}
      {report ? (
        <>
          <button type="button" onClick={handleShare} style={{ ...bigBtn, background: "var(--green)" }}>
            📤 Bericht teilen
          </button>
          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
            {shareInfo ?? `PDF${report.length > 1 ? ` + ${report.length - 1} Foto${report.length > 2 ? "s" : ""} als einzelne Dateien` : ""} · per Mail, WhatsApp … senden`}
          </div>
        </>
      ) : (
        <button type="button" onClick={() => void handleGenerate()} disabled={generating || anhaenge.isLoading} style={{
          ...bigBtn, background: "var(--accent)", cursor: generating ? "wait" : "pointer", opacity: generating ? 0.7 : 1,
        }}>
          {generating ? "Bericht wird erstellt…" : "📄 PDF-Bericht erstellen"}
        </button>
      )}
    </div>
  );
}
