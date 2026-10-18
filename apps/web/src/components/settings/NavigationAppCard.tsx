"use client";

import { useEffect, useState } from "react";
import { NAV_APPS, getNavApp, setNavApp, type NavAppId } from "@/lib/navigation/navApps";

/** Profil: Navigations-App für Notdienst-Adressen (wird sofort auf diesem Gerät gespeichert). */
export function NavigationAppCard() {
  const [app, setApp] = useState<NavAppId>("google");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setApp(getNavApp()); }, []);

  function choose(id: NavAppId) {
    setApp(id);
    setNavApp(id);
    setSaved(true);
  }

  return (
    <div className="card">
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🧭 Navigation</h2>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
        Mit dieser App startet der 📍-Knopf im Notdienst-Fenster die Navigation. Gilt nur für dieses Gerät;
        auf dem iPhone öffnet sich die App direkt und muss installiert sein.
      </p>
      <div role="radiogroup" aria-label="Navigations-App" style={{ display: "grid", gap: 6 }}>
        {NAV_APPS.map((a) => {
          const active = app === a.id;
          return (
            <label key={a.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              background: active ? "color-mix(in srgb, var(--accent) 10%, var(--surface))" : "transparent",
            }}>
              <input type="radio" name="nav-app" value={a.id} checked={active} onChange={() => choose(a.id)} />
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</span>
                {a.hint && <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {saved && <p role="status" style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>✓ Gespeichert</p>}
    </div>
  );
}
