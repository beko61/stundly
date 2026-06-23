"use client";

import Link from "next/link";
import type { DemoStats } from "./state";

interface Props {
  stats: DemoStats;
}

export function UrlaubTab({ stats }: Props) {
  const anspruch  = 30;
  const genommen  = stats.urlaubCnt;
  const uebrig    = Math.max(0, anspruch - genommen);

  // Showcase requests — read-only örnek (henüz interactive değil v2'de)
  const requests = [
    { from: "03.06.2026", to: "03.06.2026", days: 1, status: "genehmigt",  comment: "Arzttermin" },
    { from: "22.07.2026", to: "02.08.2026", days: 10, status: "beantragt", comment: "Sommerurlaub" },
    { from: "23.12.2026", to: "30.12.2026", days: 6, status: "geplant",    comment: "Weihnachten" },
  ];

  const STATUS_COLOR: Record<string, string> = {
    genehmigt: "var(--green)", beantragt: "var(--yellow)", geplant: "var(--muted)",
  };
  const STATUS_LABEL: Record<string, string> = {
    genehmigt: "✓ Genehmigt", beantragt: "⏳ Wartet auf Freigabe", geplant: "📝 Geplant",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🏖 Urlaub</h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Antrag stellen, signieren, PDF herunterladen — alles im Browser.
        </p>
      </div>

      {/* Saldo — live from state */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: 18,
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
      }}>
        <UrlaubStat label="Anspruch" value={String(anspruch)} sub="Tage / Jahr" />
        <UrlaubStat label="Genommen" value={String(genommen)} sub="Tage" color="var(--blue)" />
        <UrlaubStat label="Übrig"    value={String(uebrig)}   sub="Tage" color="var(--green)" />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
          <span>Verbraucht</span>
          <span>{genommen} / {anspruch} Tage</span>
        </div>
        <div style={{ height: 10, background: "var(--surface2)", borderRadius: 5, overflow: "hidden" }}>
          <div style={{
            width: `${Math.min(100, (genommen / anspruch) * 100)}%`,
            height: "100%",
            background: "linear-gradient(90deg, var(--accent) 0%, var(--accent2) 100%)",
          }} />
        </div>
      </div>

      {/* Showcase anträge */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Beispiel-Anträge
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {requests.map((r, i) => (
            <div key={i} className="day-entry" style={{ borderColor: STATUS_COLOR[r.status], padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {r.from === r.to ? r.from : `${r.from} – ${r.to}`}
                </span>
                <span style={{
                  fontSize: 11, color: STATUS_COLOR[r.status], fontWeight: 700,
                  padding: "3px 9px", borderRadius: 12,
                  background: `color-mix(in srgb, ${STATUS_COLOR[r.status]} 12%, transparent)`,
                  whiteSpace: "nowrap",
                }}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {r.days} Tag{r.days > 1 ? "e" : ""} · {r.comment}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 8, padding: 12, background: "var(--surface)", borderRadius: 10, border: "1px dashed var(--border)" }}>
        💡 In der echten App: digitale Unterschrift + PDF-Export · BUrlG-konform ·
        Admin-Freigabe per Klick · automatisch in der Zeiterfassung.
        <br/>
        <Link href="/register" style={{ color: "var(--accent2)", fontWeight: 700 }}>
          Konto erstellen, um Anträge zu stellen →
        </Link>
      </div>
    </div>
  );
}

function UrlaubStat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 700, color: color ?? "var(--text)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}
