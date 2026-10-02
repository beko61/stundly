"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * "QR-Code zeigen": Vollbild mit großem QR-Code zum Abscannen vor Ort
 * (Kollege hält die Handykamera drauf → Registrierung mit deinem Code).
 * PNG wird vorab erzeugt, damit "Als Bild speichern" synchron im Klick bleibt (iOS).
 */
export function QrCodeButton({ url, title, hint, fileName, primary = false }: {
  url: string;
  title: string;
  hint: string;
  fileName: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const opts = { errorCorrectionLevel: "M" as const, margin: 1, color: { dark: "#111111", light: "#ffffff" } };
    void Promise.all([
      QRCode.toString(url, { ...opts, type: "svg" }),
      QRCode.toDataURL(url, { ...opts, margin: 2, width: 1024 }),
    ]).then(([s, p]) => { if (!cancelled) { setSvg(s); setPng(p); } }).catch(() => { /* ohne QR */ });
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  if (!svg) return null;

  return (
    <>
      <button type="button" className={primary ? "btn btn-primary" : "btn btn-secondary"} onClick={() => setOpen(true)}>
        📱 QR-Code zeigen
      </button>
      {open && (
        <div
          role="dialog" aria-modal="true" aria-label={title}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 10000, background: "#ffffff", color: "#111111",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "calc(env(safe-area-inset-top) + 20px) 20px calc(env(safe-area-inset-bottom) + 20px)", textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "#6b5cdb", marginBottom: 6 }}>STUNDLY</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 18, maxWidth: 360 }}>{title}</div>
          <div
            aria-label="QR-Code"
            style={{ width: "min(78vw, 46vh, 380px)", aspectRatio: "1 / 1" }}
            // SVG stammt aus der qrcode-Bibliothek (kein Nutzer-HTML)
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 18 }}>{hint}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 6, overflowWrap: "anywhere", maxWidth: 360 }}>{url}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap", justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
            {png && (
              <a href={png} download={fileName} style={{
                padding: "11px 16px", borderRadius: 10, border: "1px solid #ccc", color: "#111",
                textDecoration: "none", fontSize: 14, fontWeight: 700,
              }}>⬇ Als Bild speichern</a>
            )}
            <button type="button" onClick={() => setOpen(false)} style={{
              padding: "11px 18px", borderRadius: 10, border: 0, background: "#111", color: "#fff",
              fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>Schließen</button>
          </div>
        </div>
      )}
    </>
  );
}
