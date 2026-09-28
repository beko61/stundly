"use client";

import { useEffect, useState } from "react";
import type { TimeEntry } from "@workly/shared";
import {
  useLiveEntryQuery,
  useTimeEntriesQuery,
  useCreateTimeEntry,
  useUpdateTimeEntry,
} from "@/hooks/queries/useTimeEntries";
import {
  FORGOTTEN_AFTER_MIN,
  bruttoSeconds,
  currentPauseMinutes,
  formatClock,
  hhmmOf,
  isLive,
  localDateStr,
  netSeconds,
  pausePatch,
  pauseSince,
  restartPatch,
  resumePatch,
  startPayload,
  stopPatch,
} from "@/lib/tracker/liveTimer";

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "--:--");

function fmtMin(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Start/Pause/Feierabend mit einem Tipp. Zustand liegt im Tages-Eintrag (siehe
 * lib/tracker/liveTimer) → läuft nach App-Neustart und auf anderen Geräten weiter.
 */
export function LiveTimerCard() {
  const [now, setNow] = useState(() => new Date());
  const liveQ = useLiveEntryQuery();
  const todayQ = useTimeEntriesQuery(now.getFullYear(), now.getMonth() + 1);
  const createMut = useCreateTimeEntry();
  const updateMut = useUpdateTimeEntry();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [manualEnd, setManualEnd] = useState("");

  const live = isLive(liveQ.data) ? (liveQ.data as TimeEntry) : null;
  const todayStr = localDateStr(now);
  const today = (todayQ.data ?? []).find((e) => e.date === todayStr) ?? null;

  // Sekundentakt nur solange der Timer läuft; sonst minütlich (Datumswechsel).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), live ? 1000 : 60_000);
    return () => clearInterval(id);
  }, [live]);

  async function run(action: () => Promise<unknown>, doneText?: string) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await action();
      if (doneText) setDone(doneText);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const update = (id: string, patch: Partial<TimeEntry>) => updateMut.mutateAsync({ id, patch });

  function handleStart() {
    const t = new Date();
    if (today && today.date === localDateStr(t)) {
      const was = today.start_time
        ? `${hhmm(today.start_time)}–${hhmm(today.end_time)}`
        : today.day_type;
      if (!confirm(`Heute ist schon ein Eintrag vorhanden (${was}).\nDurch Live-Zeit ab jetzt ersetzen?`)) return;
      void run(() => update(today.id, restartPatch(today, t)));
    } else {
      void run(() => createMut.mutateAsync(startPayload(t)));
    }
  }

  function handleStop(endAt?: string) {
    if (!live) return;
    const { patch, pauseAdded } = stopPatch(live, new Date(), endAt);
    const text =
      `✓ Gespeichert: ${hhmm(live.start_time)}–${patch.end_time}, Pause ${patch.break_minutes} min` +
      (pauseAdded > 0 ? ` (auf gesetzliche Mindestpause ergänzt, §4 ArbZG)` : "");
    void run(() => update(live.id, patch), text);
    setManualEnd("");
  }

  if (liveQ.isPending || todayQ.isPending) return null;

  // ── Timer läuft ────────────────────────────────────────────────────────────
  if (live) {
    const paused = pauseSince(live);
    const brutto = Math.floor(bruttoSeconds(live, now) / 60);
    const pauseTotal = live.break_minutes + currentPauseMinutes(live, now);
    const forgotten = brutto >= FORGOTTEN_AFTER_MIN;
    const sinceLabel = live.date === todayStr ? hhmm(live.start_time) : `${live.date.slice(8, 10)}.${live.date.slice(5, 7)}. ${hhmm(live.start_time)}`;

    return (
      <div className={`card ${paused ? "yellow" : "green"}`} style={{ margin: "0 0 14px" }} aria-live="polite">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: paused ? "var(--yellow)" : "var(--green)" }}>
              <span className={paused ? undefined : "live-dot"} aria-hidden="true">{paused ? "⏸" : "●"}</span>{" "}
              {paused ? `Pause seit ${paused}` : `Läuft seit ${sinceLabel}`}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 34, fontWeight: 500, lineHeight: 1.15, marginTop: 2 }}>
              {formatClock(netSeconds(live, now))}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              Arbeitszeit · Pause {fmtMin(pauseTotal)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {paused ? (
              <button className="btn btn-secondary" disabled={busy}
                onClick={() => void run(() => update(live.id, resumePatch(live, new Date())))}>
                ▶ Weiter
              </button>
            ) : (
              <button className="btn btn-secondary" disabled={busy}
                onClick={() => void run(() => update(live.id, pausePatch(live, new Date())))}>
                ⏸ Pause
              </button>
            )}
            {!forgotten && (
              <button className="btn btn-danger" disabled={busy} onClick={() => handleStop()}>
                ■ Feierabend
              </button>
            )}
          </div>
        </div>

        {forgotten && (
          <div role="alert" style={{
            marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.45,
            background: "color-mix(in srgb, var(--orange) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--orange) 35%, transparent)",
          }}>
            <div style={{ color: "var(--orange)", fontWeight: 700 }}>
              ⚠️ Läuft seit über {Math.floor(FORGOTTEN_AFTER_MIN / 60)} Std. — Feierabend vergessen?
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <label htmlFor="live-end" style={{ color: "var(--muted)" }}>Feierabend um</label>
              <input id="live-end" className="input" type="time" value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)} style={{ width: 120 }} />
              <button className="btn btn-primary" disabled={busy || !manualEnd} onClick={() => handleStop(manualEnd)}>
                Speichern
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => handleStop()}>
                Jetzt ({hhmmOf(now)})
              </button>
            </div>
          </div>
        )}
        {error && <p role="alert" style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>⚠️ {error}</p>}
      </div>
    );
  }

  // ── Heute schon erfasst ────────────────────────────────────────────────────
  if (today && (today.day_type !== "arbeiten" || (today.start_time && today.end_time))) {
    if (!done && today.day_type !== "arbeiten") return null; // Urlaub/Krank/Feiertag/Notdienst-Tag
    return (
      <div className="card green" style={{ margin: "0 0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13 }}>
          {done ? (
            <span style={{ color: "var(--green)", fontWeight: 600 }}>{done}</span>
          ) : (
            <>
              <span style={{ color: "var(--muted)" }}>Heute erfasst: </span>
              <strong style={{ fontFamily: "'DM Mono',monospace" }}>
                {hhmm(today.start_time)}–{hhmm(today.end_time)}
              </strong>
            </>
          )}
        </div>
        {!done && (
          <button className="btn btn-ghost" disabled={busy} onClick={handleStart} style={{ padding: "6px 10px", fontSize: 12 }}>
            ▶ Live neu starten
          </button>
        )}
        {error && <p role="alert" style={{ color: "var(--red)", fontSize: 12, width: "100%" }}>⚠️ {error}</p>}
      </div>
    );
  }

  // ── Noch nichts erfasst ────────────────────────────────────────────────────
  return (
    <div className="card purple" style={{ margin: "0 0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>⏱ Arbeitszeit live erfassen</div>
        <div style={{ fontSize: 12, color: done ? "var(--green)" : "var(--muted)", marginTop: 2 }}>
          {done ?? "Ein Tipp bei Arbeitsbeginn — Pause und Feierabend genauso."}
        </div>
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={handleStart} style={{ background: "var(--green)" }}>
        ▶ Arbeitsbeginn
      </button>
      {error && <p role="alert" style={{ color: "var(--red)", fontSize: 12, width: "100%" }}>⚠️ {error}</p>}
    </div>
  );
}
