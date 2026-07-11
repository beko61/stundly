"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDemoState, computeStats } from "./state";
import { UebersichtTab } from "./UebersichtTab";
import { ZeitTab } from "./ZeitTab";
import { LohnTab } from "./LohnTab";
import { UrlaubTab } from "./UrlaubTab";

/**
 * Stundly Demo v2 — interactive.
 *
 * Mevcut (v1): read-only showcase.
 * Yeni (v2): Zeit tab tam interactive (gün tıkla → modal → entry save).
 *            Übersicht + Lohn KPI'ları kullanıcının entry'lerinden live hesaplanır.
 *            Urlaub tab showcase kalır ama Urlaub-Tage count live.
 *            State localStorage'da persist edilir, "Reset" butonu var.
 *
 * Hedef: read-only showcase'in conversion zayıflığını çözmek (v0.8.2 → %1.5).
 *        Interactive demo = WOW moment = "kayıt ol" friction kalkar.
 */

type Tab = "uebersicht" | "zeit" | "lohn" | "urlaub";
const VALID_TABS: Tab[] = ["uebersicht", "zeit", "lohn", "urlaub"];

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "uebersicht", label: "Übersicht", icon: "🏠" },
  { id: "zeit",       label: "Zeit",      icon: "⏱"  },
  { id: "lohn",       label: "Lohn",      icon: "💰" },
  { id: "urlaub",     label: "Urlaub",    icon: "🏖" },
];

function isTab(s: string | null): s is Tab {
  return !!s && (VALID_TABS as string[]).includes(s);
}

export default function DemoPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>Laden…</div>
    }>
      <DemoPage />
    </Suspense>
  );
}

function DemoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "zeit";

  const [tab, setTabState] = useState<Tab>(initialTab); // Default: Zeit (interactive)
  const { state, upsertEntry, removeEntry, resetAll, hasEdits, ready } = useDemoState();
  const [confirmReset, setConfirmReset] = useState(false);

  // Tab değişince URL ?tab=X ile senkron (shareable link)
  function setTab(next: Tab) {
    setTabState(next);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", next);
    router.replace(`/demo?${sp.toString()}`, { scroll: false });
  }

  // Browser back/forward'da URL → tab sync
  useEffect(() => {
    const fromUrl = params.get("tab");
    if (isTab(fromUrl) && fromUrl !== tab) setTabState(fromUrl as Tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const stats = useMemo(() => computeStats(state), [state]);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100dvh", color: "var(--text)" }}>

      {/* DEMO BANNER — context-aware */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: hasEdits
          ? "linear-gradient(90deg, var(--green) 0%, var(--accent2) 100%)"
          : "linear-gradient(90deg, var(--accent) 0%, var(--accent2) 100%)",
        color: "white", padding: "10px 14px",
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700,
      }}>
        {hasEdits ? (
          <>
            <span>🎉 <strong>Du hast eigene Daten!</strong> Bei Anmeldung werden sie automatisch übernommen.</span>
            <Link href="/register" style={{
              background: "white", color: "var(--accent)",
              padding: "7px 14px", borderRadius: 8,
              textDecoration: "none", fontWeight: 800, fontSize: 13,
              whiteSpace: "nowrap",
            }}>
              💾 Daten sichern →
            </Link>
          </>
        ) : (
          <>
            <span>👀 <strong>Demo</strong> · Tippe einen Tag → eigene Zeiten setzen</span>
            <Link href="/register" style={{
              background: "white", color: "var(--accent)",
              padding: "7px 14px", borderRadius: 8,
              textDecoration: "none", fontWeight: 800, fontSize: 13,
              whiteSpace: "nowrap",
            }}>
              Kostenlos starten →
            </Link>
          </>
        )}
      </div>

      {/* HEADER */}
      <header style={{
        padding: "16px 14px 8px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8,
      }}>
        <Link href="/" style={{
          color: "var(--accent2)", fontWeight: 800, fontSize: 18,
          letterSpacing: 3, textDecoration: "none",
        }}>STUNDLY</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
            Juni 2026 · Max Mustermann
          </span>
          {hasEdits && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              title="Demo zurücksetzen"
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                padding: "6px 10px", borderRadius: 8,
                fontSize: 11, fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ↻ Reset
            </button>
          )}
        </div>
      </header>

      {/* TAB BAR */}
      <div style={{
        position: "sticky", top: 41, zIndex: 90,
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
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
        {!ready ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
            Laden…
          </div>
        ) : (
          <>
            {tab === "uebersicht" && <UebersichtTab stats={stats} hasEdits={hasEdits} />}
            {tab === "zeit"       && <ZeitTab state={state} onUpsert={upsertEntry} onRemove={removeEntry} />}
            {tab === "lohn"       && <LohnTab stats={stats} state={state} />}
            {tab === "urlaub"     && <UrlaubTab stats={stats} />}
          </>
        )}
      </div>

      {/* CONVERSION CTA — am Ende */}
      <section style={{ padding: "40px 16px 60px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent), color-mix(in srgb, var(--accent2) 16%, transparent))",
          border: "1px solid color-mix(in srgb, var(--accent2) 35%, transparent)",
          borderRadius: 16, padding: "28px 22px",
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>{hasEdits ? "💾" : "🎁"}</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            {hasEdits
              ? "Bereit, deine Daten zu sichern?"
              : "Gefällt's dir? Starte kostenlos."}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            {hasEdits
              ? "Konto erstellen und du bekommst alle Funktionen 3 Monate gratis. Deine Daten bleiben in der Cloud, synchron auf Handy & Desktop."
              : "3 Monate Beta-Zugang gratis. Keine Kreditkarte, keine Verpflichtung. Sofort loslegen mit deinen echten Daten."
            }
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

      {/* Reset confirm modal */}
      {confirmReset && (
        <div
          role="dialog"
          aria-label="Demo zurücksetzen"
          onClick={() => setConfirmReset(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 14, padding: 24, maxWidth: 360, width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>↻</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Demo zurücksetzen?</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
              Deine eigenen Einträge werden gelöscht und die Beispieldaten geladen.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="btn"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  minHeight: 44,
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => { resetAll(); setConfirmReset(false); }}
                className="btn"
                style={{
                  flex: 1,
                  background: "color-mix(in srgb, var(--red) 15%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)",
                  color: "var(--red)",
                  minHeight: 44,
                }}
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
