"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { createClient } from "@/lib/supabase/client";
import { useOnline, useOutbox } from "@/hooks/useOffline";
import { flushOutbox } from "@/lib/offline/sync";
import { SYNC_REQUEST_EVENT } from "@/lib/offline/timeEntries";
import { clearFailed, clearOutbox, type OutboxOp } from "@/lib/offline/outbox";
import { clearPersistedCache } from "@/lib/offline/cachePersist";
import { rememberUserId } from "@/lib/offline/network";

/** Seiten, die für den Offline-Start vorab (inkl. JS/CSS) im Service Worker landen. */
const PRECACHE_PAGES = ["/dashboard", "/tracker", "/vacation", "/reports", "/salary", "/settings"];

function describe(op: OutboxOp): string {
  const date = "date" in op ? op.date : op.kind === "nd_upsert" ? op.row.date : "";
  const [y, m, d] = date.split("-");
  const when = d ? `${d}.${m}.${y}` : "";
  return `${op.kind.startsWith("te_") ? "Arbeitszeit" : "Notdienst"} ${when}`.trim();
}

const pill: React.CSSProperties = {
  position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 8px)", left: "50%",
  transform: "translateX(-50%)", zIndex: 1000, maxWidth: "calc(100vw - 32px)",
  padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
  fontFamily: "'Syne',sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,.25)",
  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center",
};

/**
 * Offline-Modus: sendet die Outbox, sobald Netz da ist, zeigt den Status als kleine
 * Pille oben und legt die wichtigsten Seiten für den Offline-Start in den SW-Cache.
 */
export function OfflineSync() {
  const online = useOnline();
  const { pending, failed } = useOutbox();
  const [justSynced, setJustSynced] = useState(0);
  const [showFailed, setShowFailed] = useState(false);

  // Senden: beim Start, bei "online", auf Anfrage, beim Zurückkehren in die App, minütlich
  useEffect(() => {
    let alive = true;
    const run = () => {
      void flushOutbox().then((n) => {
        if (alive && n > 0) {
          setJustSynced(n);
          setTimeout(() => alive && setJustSynced(0), 3000);
        }
      }).catch(() => { /* nächster Versuch */ });
    };
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    run();
    window.addEventListener("online", run);
    window.addEventListener(SYNC_REQUEST_EVENT, run);
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(run, 60_000);
    return () => {
      alive = false;
      window.removeEventListener("online", run);
      window.removeEventListener(SYNC_REQUEST_EVENT, run);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, []);

  // App-Seiten vorab cachen (einmal pro Sitzung), damit die App ohne Netz startet
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    try {
      if (sessionStorage.getItem("stundly_precached")) return;
    } catch { /* ignore */ }
    const t = setTimeout(() => {
      void navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: "precache", urls: PRECACHE_PAGES });
        try { sessionStorage.setItem("stundly_precached", "1"); } catch { /* ignore */ }
      });
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // Abmelden: Offline-Daten dieses Nutzers vom Gerät entfernen
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      clearOutbox();
      clearPersistedCache();
      rememberUserId(null);
      try { navigator.serviceWorker?.controller?.postMessage({ type: "clear" }); } catch { /* ignore */ }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const n = pending.length;
  const plural = (k: number) => (k === 1 ? "Änderung" : "Änderungen");

  if (failed.length > 0) {
    return (
      <div role="alert" style={{ ...pill, background: "var(--surface)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: 14 }}>
        <span>⚠️ {failed.length} {plural(failed.length)} nicht übertragen</span>
        <button onClick={() => setShowFailed((v) => !v)} className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 11 }}>
          {showFailed ? "Weniger" : "Details"}
        </button>
        <button
          onClick={() => {
            if (confirm("Nicht übertragene Änderungen verwerfen? Sie gehen verloren.")) clearFailed();
          }}
          className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 11, color: "var(--red)" }}
        >
          Verwerfen
        </button>
        {showFailed && (
          <ul style={{ width: "100%", margin: "4px 0 0", paddingLeft: 18, fontWeight: 500, color: "var(--text)", fontSize: 11 }}>
            {failed.map((f, i) => <li key={i}>{describe(f.op)}: {f.error}</li>)}
          </ul>
        )}
      </div>
    );
  }

  if (!online) {
    return (
      <div role="status" style={{ ...pill, background: "var(--surface)", border: "1px solid var(--yellow)", color: "var(--yellow)" }}>
        📴 Offline{n > 0 ? ` · ${n} ${plural(n)} gespeichert` : " — Eingaben werden gespeichert"}
      </div>
    );
  }

  if (n > 0) {
    return (
      <div role="status" style={{ ...pill, background: "var(--surface)", border: "1px solid var(--accent2)", color: "var(--accent2)" }}>
        🔄 {n} {plural(n)} {n === 1 ? "wird" : "werden"} übertragen…
      </div>
    );
  }

  if (justSynced > 0) {
    return (
      <div role="status" style={{ ...pill, background: "var(--surface)", border: "1px solid var(--green)", color: "var(--green)" }}>
        ✓ {justSynced} {plural(justSynced)} übertragen
      </div>
    );
  }

  return null;
}
