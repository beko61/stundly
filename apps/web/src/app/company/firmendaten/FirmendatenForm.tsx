"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Briefkopf } from "@/lib/company/briefkopf";
import { resizeLogo } from "@/lib/image/resizeLogo";

export function FirmendatenForm({ initial, supported, prefilled }: { initial: Briefkopf; supported: boolean; prefilled: boolean }) {
  const router = useRouter();
  const [bk, setBk] = useState<Briefkopf>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    prefilled ? { ok: true, text: "Aus deinem Profil übernommen — prüfen und speichern." } : null,
  );
  const set = (k: keyof Briefkopf, v: string | null) => { setBk((b) => ({ ...b, [k]: v })); setMsg(null); };

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg({ ok: false, text: "Datei zu groß (max. 5 MB)." }); return; }
    try { set("logo", await resizeLogo(file, 400, 0.85)); }
    catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Logo konnte nicht verarbeitet werden." }); }
  }

  async function save() {
    if (bk.name.trim().length < 2) { setMsg({ ok: false, text: "Bitte einen Firmennamen eingeben." }); return; }
    setBusy(true); setMsg(null);
    const body: Record<string, unknown> = {
      name: bk.name, address_line1: bk.strasse, postal_code: bk.plz, city: bk.ort,
      ...(supported ? { phone: bk.telefon, logo_data: bk.logo } : {}),
    };
    try {
      const res = await fetch("/api/company/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setMsg({ ok: false, text: json.error ?? "Speichern fehlgeschlagen" }); return; }
      setMsg({ ok: true, text: "Gespeichert — gilt ab sofort für alle PDFs deines Teams." });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Netzwerkfehler" }); } finally { setBusy(false); }
  }

  const ortLine = [bk.plz, bk.ort].filter(Boolean).join(" ");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="label" htmlFor="fd-name">Firmenname</label>
          <input id="fd-name" className="input" value={bk.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="z.B. Mustermann Sanitär GmbH" />
        </div>
        <div>
          <label className="label" htmlFor="fd-str">Adresse</label>
          <input id="fd-str" className="input" value={bk.strasse} maxLength={120} onChange={(e) => set("strasse", e.target.value)} placeholder="Musterstraße 1" style={{ marginBottom: 8 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <input className="input" aria-label="PLZ" inputMode="numeric" value={bk.plz} maxLength={10} onChange={(e) => set("plz", e.target.value)} placeholder="30159" />
            <input className="input" aria-label="Ort" value={bk.ort} maxLength={80} onChange={(e) => set("ort", e.target.value)} placeholder="Hannover" />
          </div>
        </div>
        {supported ? (
          <>
            <div>
              <label className="label" htmlFor="fd-tel">Telefon (optional)</label>
              <input id="fd-tel" className="input" type="tel" value={bk.telefon} maxLength={40} onChange={(e) => set("telefon", e.target.value)} placeholder="0511 123456" />
            </div>
            <div>
              <span className="label">Logo</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {bk.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bk.logo} alt="Firmenlogo" style={{ maxHeight: 52, maxWidth: 140, objectFit: "contain", background: "white", padding: 4, borderRadius: 6, border: "1px solid var(--border)" }} />
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, border: "2px dashed var(--border)", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                  🏷 {bk.logo ? "Anderes Logo" : "Logo hochladen (PNG / JPG)"}
                  <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => void onLogo(e)} />
                </label>
                {bk.logo && (
                  <button type="button" onClick={() => set("logo", null)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--red)", background: "transparent", color: "var(--red)", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑 Entfernen</button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Telefon und Logo sind in Kürze verfügbar.</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "Speichert…" : "Speichern"}</button>
          {msg && <span role={msg.ok ? "status" : "alert"} style={{ fontSize: 12, color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</span>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Vorschau Briefkopf</div>
        <div style={{ background: "white", color: "#111", borderRadius: 10, padding: "18px 16px", textAlign: "center", border: "1px solid var(--border)" }}>
          {bk.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bk.logo} alt="" style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain", marginBottom: 6 }} />
          )}
          <div style={{ fontWeight: 800, fontSize: 15 }}>{bk.name || "Firmenname"}</div>
          <div style={{ fontSize: 11, color: "#555" }}>{[bk.strasse, ortLine, bk.telefon].filter(Boolean).join(" · ")}</div>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
          🔒 Deine Mitarbeiter sehen den Briefkopf in ihrem Profil, können ihn aber nicht ändern.
        </p>
      </div>
    </div>
  );
}
