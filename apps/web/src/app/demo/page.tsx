"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Stundly Demo — kayıt olmadan görülebilen showcase.
 *
 * Read-only ama tam ürün hissi: gerçek bileşen stilleri, sahte ama gerçekçi Juni 2026 verisi.
 * 4 sekme (Übersicht / Zeit / Lohn / Urlaub) tek sayfada, mobile-first, hızlı.
 *
 * Hedef: Reddit/Selbststaendig launch'larında "kayıt ol" sürtünmesini düşürmek.
 * Conversion target: 1.5% → 5%+ (5x).
 */

type Tab = "uebersicht" | "zeit" | "lohn" | "urlaub";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "uebersicht", label: "Übersicht", icon: "🏠" },
  { id: "zeit",       label: "Zeit",      icon: "⏱"  },
  { id: "lohn",       label: "Lohn",      icon: "💰" },
  { id: "urlaub",     label: "Urlaub",    icon: "🏖" },
];

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>("uebersicht");

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>

      {/* DEMO BANNER — sticky top */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "linear-gradient(90deg, var(--accent) 0%, var(--accent2) 100%)",
        color: "white", padding: "12px 16px",
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        alignItems: "center", gap: 12, fontSize: 13, fontWeight: 700,
      }}>
        <span>👀 <strong>Demo-Modus</strong> · Beispieldaten · Daten werden nicht gespeichert</span>
        <Link href="/register" style={{
          background: "white", color: "var(--accent)",
          padding: "8px 16px", borderRadius: 8,
          textDecoration: "none", fontWeight: 800, fontSize: 13,
          whiteSpace: "nowrap",
        }}>
          Kostenlos starten →
        </Link>
      </div>

      {/* HEADER — minimal */}
      <header style={{
        padding: "20px 16px 8px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8,
      }}>
        <Link href="/" style={{
          color: "var(--accent2)", fontWeight: 800, fontSize: 18,
          letterSpacing: 3, textDecoration: "none",
        }}>STUNDLY</Link>
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
          Juni 2026 · Max Mustermann
        </div>
      </header>

      {/* TAB BAR */}
      <div style={{
        position: "sticky", top: 49, zIndex: 90,
        background: "var(--bg)", borderBottom: "1px solid var(--border)",
        padding: "10px 12px",
        display: "flex", gap: 6, overflowX: "auto",
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 999,
                background: active ? "var(--accent)" : "var(--surface)",
                color: active ? "white" : "var(--muted)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap",
                minHeight: 40,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
        {tab === "uebersicht" && <UebersichtTab />}
        {tab === "zeit"       && <ZeitTab />}
        {tab === "lohn"       && <LohnTab />}
        {tab === "urlaub"     && <UrlaubTab />}
      </div>

      {/* CONVERSION CTA — am Ende */}
      <section style={{ padding: "40px 16px 60px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent), color-mix(in srgb, var(--accent2) 16%, transparent))",
          border: "1px solid color-mix(in srgb, var(--accent2) 35%, transparent)",
          borderRadius: 16, padding: "28px 22px",
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎁</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            Gefällt&apos;s dir? Starte kostenlos.
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            3 Monate Beta-Zugang gratis. Keine Kreditkarte, keine Verpflichtung.
            Sofort loslegen mit deinen echten Daten.
          </p>
          <Link href="/register" className="btn btn-primary" style={{
            display: "inline-block", padding: "12px 24px", fontSize: 14,
          }}>
            Jetzt Konto erstellen →
          </Link>
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)" }}>
            Bereits Kunde? <Link href="/login" style={{ color: "var(--accent2)", fontWeight: 700 }}>Anmelden</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB 1 — ÜBERSICHT (Dashboard mini)
   ════════════════════════════════════════════════════════════ */
function UebersichtTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Guten Morgen, Max 👋</h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>So sieht dein Monat aus.</p>
      </div>

      {/* HERO: 2 grosse KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }} className="demo-hero-grid">
        <KpiHero label="Stundensaldo" value="+04:15" sub="Überstunden im Juni" color="var(--green)" />
        <KpiHero label="Brutto-Lohn (Schätzung)" value="€ 2.847" sub="Juni 2026 · noch nicht abgerechnet" color="var(--accent2)" />
      </div>

      {/* 4 kleine KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }} className="demo-kpi-grid">
        <KpiSmall icon="⏱" label="Gearbeitet" value="178h 15" sub="von 174h Soll" />
        <KpiSmall icon="🚨" label="Notdienst" value="3 Wochen" sub="2 bezahlt · 1 offen" />
        <KpiSmall icon="🏖" label="Urlaub übrig" value="22 Tage" sub="von 30 Tagen" />
        <KpiSmall icon="🎉" label="Nächster Feiertag" value="03.10." sub="Tag der Einheit" />
      </div>

      {/* 7-Tage Mini-Chart */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>📊 Letzte 7 Tage</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
          {[
            { d: "Mo", h: 8.25, weekend: false },
            { d: "Di", h: 8.5,  weekend: false },
            { d: "Mi", h: 9.0,  weekend: false },
            { d: "Do", h: 8.0,  weekend: false },
            { d: "Fr", h: 6.25, weekend: false },
            { d: "Sa", h: 0,    weekend: true  },
            { d: "So", h: 0,    weekend: true  },
          ].map((b, i) => {
            const pct = b.h === 0 ? 4 : (b.h / 10) * 100;
            return (
              <div key={i} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 6, height: "100%",
                justifyContent: "flex-end",
              }}>
                <div style={{
                  width: "100%",
                  height: `${pct}%`,
                  background: b.weekend
                    ? "color-mix(in srgb, var(--muted) 30%, transparent)"
                    : "linear-gradient(180deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, transparent) 100%)",
                  borderRadius: "4px 4px 0 0",
                  minHeight: 4,
                }} />
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{b.d}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 4 }}>
        💡 In der echten App: Live-Berechnung, Klick auf Tag = Editieren, Sync übers Handy.
      </div>
    </div>
  );
}

function KpiHero({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 22,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 38, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: "-0.02em", color, marginTop: 4,
      }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function KpiSmall({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB 2 — ZEIT (Tracker preview)
   ════════════════════════════════════════════════════════════ */
function ZeitTab() {
  const days = [
    { d: "01", dow: "Mo", type: "Arbeiten",  start: "07:45", end: "17:00", pause: "01:00", hours: "08:15", color: "var(--green)",  icon: "✓" },
    { d: "02", dow: "Di", type: "Arbeiten",  start: "07:45", end: "17:30", pause: "01:00", hours: "08:45", color: "var(--green)",  icon: "✓" },
    { d: "03", dow: "Mi", type: "Urlaub",    start: "08:00", end: "17:00", pause: "01:00", hours: "08:00", color: "var(--blue)",   icon: "🏖" },
    { d: "04", dow: "Do", type: "Arbeiten",  start: "07:45", end: "17:00", pause: "01:00", hours: "08:15", color: "var(--green)",  icon: "✓" },
    { d: "05", dow: "Fr", type: "Arbeiten",  start: "07:45", end: "14:30", pause: "00:30", hours: "06:15", color: "var(--green)",  icon: "✓" },
    { d: "06", dow: "Sa", type: "Notdienst", start: "08:00", end: "20:00", pause: "00:00", hours: "12:00", color: "var(--orange)", icon: "🚨" },
    { d: "07", dow: "So", type: "Frei",      start: "—",     end: "—",     pause: "—",     hours: "—",     color: "var(--muted)",  icon: "—" },
    { d: "08", dow: "Mo", type: "Arbeiten",  start: "07:45", end: "17:00", pause: "01:00", hours: "08:15", color: "var(--green)",  icon: "✓" },
    { d: "09", dow: "Di", type: "Krank",     start: "08:00", end: "17:00", pause: "01:00", hours: "08:00", color: "var(--red)",    icon: "🤒" },
    { d: "10", dow: "Mi", type: "Arbeiten",  start: "07:45", end: "17:00", pause: "01:00", hours: "08:15", color: "var(--green)",  icon: "✓" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>⏱ Zeiterfassung</h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Tippe einen Tag, um Start / Ende / Pause zu ändern.</p>
      </div>

      {/* Mini-Summary */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8, padding: "12px", background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 12,
      }}>
        <SummaryCell label="Soll"      value="174:00" />
        <SummaryCell label="Ist"       value="178:15" color="var(--green)" />
        <SummaryCell label="Differenz" value="+04:15" color="var(--green)" />
      </div>

      {/* Day list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {days.map((day) => (
          <div key={day.d} className="day-entry" style={{ borderColor: day.type === "Frei" ? "var(--border)" : day.color, opacity: day.type === "Frei" ? 0.6 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 12 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "var(--muted)", width: 28, textAlign: "center" }}>{day.d}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{day.dow}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: day.color, marginTop: 1 }}>{day.icon} {day.type}</div>
              </div>
              {day.hours !== "—" && (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 600, color: day.color }}>{day.hours}</span>
              )}
            </div>
            {day.start !== "—" && (
              <div style={{ display: "flex", gap: 6, padding: "0 14px 10px", flexWrap: "wrap" }}>
                {[
                  { label: "Start", val: day.start },
                  { label: "Pause", val: day.pause },
                  { label: "Ende",  val: day.end },
                ].map((c) => (
                  <div key={c.label} className="time-chip">
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>{c.label}</span>
                    <span style={{ fontWeight: 500 }}>{c.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 8, padding: 12, background: "var(--surface)", borderRadius: 10, border: "1px dashed var(--border)" }}>
        … 21 weitere Tage im Juni — <Link href="/register" style={{ color: "var(--accent2)", fontWeight: 700 }}>Konto erstellen, um alle zu sehen</Link>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, marginTop: 2, color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB 3 — LOHN (Brutto-Netto)
   ════════════════════════════════════════════════════════════ */
function LohnTab() {
  const abzuege = [
    { label: "Lohnsteuer (St-Kl. I)", value: "318,40" },
    { label: "Solidaritätszuschlag",  value: "0,00",  hint: "unter Freigrenze" },
    { label: "Rentenversicherung (9,3 %)",  value: "264,77" },
    { label: "Arbeitslosenvers. (1,3 %)",   value: "37,01"  },
    { label: "Krankenvers. (8,15 %)",       value: "232,03" },
    { label: "Pflegevers. (2,35 %)",        value: "66,90"  },
  ];
  const totalAbzug = 919.11;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>💰 Juni 2026 — Schätzung</h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Brutto → Netto automatisch berechnet (Steuerklasse I, keine Kirche, ohne Kinder).</p>
      </div>

      {/* HERO: Brutto → Netto */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto 1fr",
        gap: 12, alignItems: "center",
        padding: 18, background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 16,
      }}>
        <div style={{
          textAlign: "center",
          background: "color-mix(in srgb, var(--green) 14%, transparent)",
          borderRadius: 12, padding: "16px 8px",
        }}>
          <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Brutto</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: "var(--green)" }}>€ 2.847</div>
        </div>
        <div style={{ fontSize: 20, color: "var(--muted)" }}>→</div>
        <div style={{
          textAlign: "center",
          background: "color-mix(in srgb, var(--accent2) 14%, transparent)",
          borderRadius: 12, padding: "16px 8px",
        }}>
          <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Netto</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: "var(--accent2)" }}>€ 1.928</div>
        </div>
      </div>

      {/* Abzüge breakdown */}
      <div style={{
        background: "color-mix(in srgb, var(--red) 6%, var(--surface))",
        border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)",
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--red)", textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.08em" }}>
          🧾 Abzüge
        </div>
        {abzuege.map((a) => (
          <div key={a.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            padding: "6px 0", borderBottom: "1px solid color-mix(in srgb, var(--red) 12%, transparent)",
            fontSize: 13,
          }}>
            <span style={{ color: "var(--text)" }}>
              {a.label}
              {a.hint && <span style={{ color: "var(--muted)", fontSize: 10, marginLeft: 6 }}>· {a.hint}</span>}
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--red)", fontWeight: 600 }}>−€ {a.value}</span>
          </div>
        ))}
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 10, paddingTop: 10, borderTop: "2px solid color-mix(in srgb, var(--red) 30%, transparent)",
          fontSize: 14, fontWeight: 800,
        }}>
          <span>Gesamt</span>
          <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--red)" }}>
            −€ {totalAbzug.toFixed(2).replace(".", ",")}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
        💡 Werte gemäß EStG §32a 2024. In der echten App: dein Stundenlohn, deine Steuerklasse, deine Kinder.
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB 4 — URLAUB
   ════════════════════════════════════════════════════════════ */
function UrlaubTab() {
  const requests = [
    { from: "03.06.2026", to: "03.06.2026", days: 1, status: "genehmigt",  comment: "Arzttermin" },
    { from: "22.07.2026", to: "02.08.2026", days: 10, status: "beantragt", comment: "Sommerurlaub" },
    { from: "23.12.2026", to: "30.12.2026", days: 6, status: "geplant",    comment: "Weihnachten" },
  ];

  const STATUS_COLOR: Record<string, string> = {
    genehmigt: "var(--green)",
    beantragt: "var(--yellow)",
    geplant:   "var(--muted)",
  };
  const STATUS_LABEL: Record<string, string> = {
    genehmigt: "✓ Genehmigt",
    beantragt: "⏳ Wartet auf Freigabe",
    geplant:   "📝 Geplant",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🏖 Urlaub</h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Antrag stellen, signieren, PDF herunterladen — alles im Browser.</p>
      </div>

      {/* Urlaub Saldo */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: 18,
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
      }}>
        <UrlaubStat label="Anspruch"  value="30" sub="Tage / Jahr" />
        <UrlaubStat label="Genommen"  value="8"  sub="Tage" color="var(--blue)" />
        <UrlaubStat label="Übrig"     value="22" sub="Tage" color="var(--green)" />
      </div>

      {/* Progress bar */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
          <span>Verbraucht</span>
          <span>8 / 30 Tage</span>
        </div>
        <div style={{ height: 10, background: "var(--surface2)", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ width: `${(8/30)*100}%`, height: "100%", background: "linear-gradient(90deg, var(--accent) 0%, var(--accent2) 100%)" }} />
        </div>
      </div>

      {/* Anträge */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Meine Anträge
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
        💡 In der echten App: digitale Unterschrift + PDF-Export · BUrlG-konform · Admin-Freigabe per Klick
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
