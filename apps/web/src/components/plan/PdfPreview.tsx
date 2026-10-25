"use client";

import { useEffect, useState } from "react";
import { PlusBadge, PlusSheet } from "./PlusSheet";

/**
 * Basic: PDF (mit "VORSCHAU"-Wasserzeichen) auf dem Bildschirm ansehen — Senden/Speichern ist Plus.
 * iPhone zeigt im Rahmen meist die erste Seite; das reicht als Vorschau.
 */
export function PdfPreview({ file, onClose, preview }: { file: Blob; onClose: () => void; preview?: boolean | undefined }) {
  const [url, setUrl] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1050, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, height: "min(86vh, 820px)", background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 16, padding: 12,
          display: "flex", flexDirection: "column", gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div id="pdf-preview-title" style={{ fontSize: 15, fontWeight: 800 }}>👁 Vorschau</div>
          <button type="button" onClick={onClose} aria-label="Schließen" style={{
            background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)",
          }}>✕</button>
        </div>
        {url && (
          <iframe src={url} title="PDF-Vorschau" style={{ flex: 1, width: "100%", border: "1px solid var(--border)", borderRadius: 8, background: "white" }} />
        )}
        <button type="button" onClick={() => setPlusOpen(true)} className="btn btn-primary" style={{ width: "100%" }}>
          Senden &amp; Speichern <PlusBadge />
        </button>
      </div>
      {plusOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <PlusSheet feature="share" onClose={() => setPlusOpen(false)} preview={preview} />
        </div>
      )}
    </div>
  );
}
