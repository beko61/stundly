"use client";

import { useState, useRef } from "react";
import type { TimeEntry } from "@workly/shared";

interface ScanEntry {
  datum:           string;
  beginn:          string;
  ende:            string;
  pause_minuten:   number;
  notiz?:          string;
}

interface ScanResult {
  eintraege: ScanEntry[];
  hinweis:   string;
}

interface Props {
  onCreate: (entry: Omit<TimeEntry, "id" | "user_id" | "created_at" | "updated_at" | "synced_at">) => Promise<{ error: string | null } | undefined>;
  onClose:  () => void;
}

export function PhotoScanModal({ onCreate, onClose }: Props) {
  const [preview,    setPreview]    = useState<string | null>(null);
  const [imageData,  setImageData]  = useState<string | null>(null);
  const [mediaType,  setMediaType]  = useState("image/jpeg");
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<ScanResult | null>(null);
  const [rawText,    setRawText]    = useState<string>("");
  const [applying,   setApplying]   = useState(false);
  const [applied,    setApplied]    = useState<number>(0);
  const [error,      setError]      = useState<string | null>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaType(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      setImageData(data);
      setPreview(data);
      setResult(null);
      setRawText("");
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    if (!imageData) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, mediaType }),
      });

      const data = await res.json() as { result?: string; parsed?: ScanResult | null; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Scan fehlgeschlagen.");
        setLoading(false);
        return;
      }

      setRawText(data.result ?? "");
      if (data.parsed && typeof data.parsed === "object") {
        setResult(data.parsed as ScanResult);
      }
    } catch (err) {
      setError("Netzwerkfehler beim Scannen.");
      console.error(err);
    }

    setLoading(false);
  }

  async function handleApply() {
    if (!result?.eintraege?.length) return;
    setApplying(true);

    let count = 0;
    for (const e of result.eintraege) {
      if (!e.datum || e.datum === "unbekannt" || !e.beginn || !e.ende) continue;
      const r = await onCreate({
        date:           e.datum,
        day_type:       "arbeiten",
        start_time:     e.beginn,
        end_time:       e.ende,
        break_minutes:  e.pause_minuten ?? 60,
        is_night_shift: false,
        note:           e.notiz ?? null,
        tags:           [],
      });
      if (!r?.error) count++;
    }

    setApplied(count);
    setApplying(false);
    if (count > 0) setTimeout(onClose, 1500);
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>📷 Foto scannen</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>KI liest Stundenzettel automatisch ein</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "6px 10px" }}>✕</button>
        </div>

        {/* Photo preview */}
        {preview && (
          <div style={{ marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Vorschau"
              style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", maxHeight: 220, objectFit: "cover" }} />
          </div>
        )}

        {/* Pick photo buttons */}
        {!loading && !result && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div
              onClick={() => cameraRef.current?.click()}
              style={{
                border: "2px dashed var(--border)", borderRadius: 12, padding: "20px 10px",
                textAlign: "center", cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Kamera</div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                style={{ display: "none" }} onChange={handleFile} />
            </div>
            <div
              onClick={() => galleryRef.current?.click()}
              style={{
                border: "2px dashed var(--border)", borderRadius: 12, padding: "20px 10px",
                textAlign: "center", cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Galerie</div>
              <input ref={galleryRef} type="file" accept="image/*"
                style={{ display: "none" }} onChange={handleFile} />
            </div>
          </div>
        )}

        {/* Scan button */}
        {imageData && !loading && !result && (
          <button
            onClick={handleScan}
            style={{
              width: "100%", padding: 14, background: "var(--accent)", border: "none",
              borderRadius: 12, color: "white", fontFamily: "'Syne',sans-serif",
              fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 10,
            }}
          >
            🔍 KI scannen
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8, display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</div>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>KI liest...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{
            color: "var(--red)", fontSize: 13,
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            padding: "10px 12px", borderRadius: 8, marginBottom: 10,
          }}>
            {error}
          </p>
        )}

        {/* Results */}
        {result && (
          <div>
            {result.hinweis && (
              <div style={{
                background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10,
                padding: "10px 12px", marginBottom: 12, fontSize: 13, color: "var(--muted)",
              }}>
                💬 {result.hinweis}
              </div>
            )}

            {result.eintraege.length > 0 ? (
              <>
                <div className="label" style={{ marginBottom: 8 }}>Erkannte Einträge ({result.eintraege.length})</div>
                {result.eintraege.map((e, i) => (
                  <div key={i} style={{
                    background: "var(--surface2)", border: "1px solid var(--green)",
                    borderRadius: 10, padding: "10px 12px", marginBottom: 8,
                    display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                  }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "var(--green)", fontWeight: 700 }}>
                      {e.datum !== "unbekannt" ? e.datum : "?"}
                    </span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>
                      {e.beginn} – {e.ende}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>Pause: {e.pause_minuten} min</span>
                    {e.notiz && <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "pre-line" }}>📝 {e.notiz}</span>}
                  </div>
                ))}

                {applied > 0 ? (
                  <div style={{ textAlign: "center", padding: "12px 0", color: "var(--green)", fontWeight: 700 }}>
                    ✅ {applied} Einträge übernommen!
                  </div>
                ) : (
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    style={{
                      width: "100%", padding: 14, background: "var(--green)", border: "none",
                      borderRadius: 12, color: "white", fontFamily: "'Syne',sans-serif",
                      fontSize: 15, fontWeight: 800, cursor: "pointer",
                    }}
                  >
                    {applying ? "Übernehme..." : "✅ Einträge übernehmen"}
                  </button>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0", color: "var(--muted)" }}>
                Keine Arbeitszeiten erkannt. Bitte ein klareres Foto machen.
              </div>
            )}

            {/* Retry */}
            <button
              onClick={() => { setResult(null); setRawText(""); setPreview(null); setImageData(null); }}
              style={{
                width: "100%", marginTop: 10, padding: 12, background: "transparent",
                border: "1px solid var(--border)", borderRadius: 12,
                color: "var(--muted)", fontFamily: "'Syne',sans-serif", fontSize: 13, cursor: "pointer",
              }}
            >
              Neues Foto scannen
            </button>
          </div>
        )}

        {/* Raw text (debug) */}
        {rawText && !result?.eintraege?.length && (
          <div style={{
            background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10,
            padding: "10px 12px", marginTop: 10, maxHeight: 160, overflowY: "auto",
          }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>KI-ANTWORT</div>
            <pre style={{ fontSize: 11, color: "var(--text)", whiteSpace: "pre-wrap", fontFamily: "'DM Mono',monospace" }}>
              {rawText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
