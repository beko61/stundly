// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  LIVE_TAG,
  bruttoSeconds,
  formatClock,
  isLive,
  netSeconds,
  pausePatch,
  pauseSince,
  requiredPauseMinutes,
  restartPatch,
  resumePatch,
  startPayload,
  stopPatch,
} from "../liveTimer";

const at = (d: string, t: string) => {
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi, s] = t.split(":").map(Number);
  return new Date(y!, mo! - 1, da!, h!, mi!, s ?? 0);
};

const base = { date: "2026-09-28", start_time: "07:00", end_time: null, break_minutes: 0, tags: [LIVE_TAG] };

describe("liveTimer", () => {
  it("startPayload: lokales Datum + Minute, live-Tag, kein Ende", () => {
    const p = startPayload(at("2026-09-28", "07:12:45"));
    expect(p).toMatchObject({ date: "2026-09-28", start_time: "07:12", end_time: null, day_type: "arbeiten", tags: [LIVE_TAG] });
    expect(isLive({ ...p })).toBe(true);
  });

  it("startPayload kurz nach Mitternacht → heutiges (lokales) Datum", () => {
    expect(startPayload(at("2026-09-29", "00:30")).date).toBe("2026-09-29");
  });

  it("isLive: nur mit Tag, Start und ohne Ende", () => {
    expect(isLive(base)).toBe(true);
    expect(isLive({ ...base, end_time: "16:00" })).toBe(false);
    expect(isLive({ ...base, tags: [] })).toBe(false);
    expect(isLive(null)).toBe(false);
  });

  it("netSeconds zieht abgeschlossene und laufende Pause ab", () => {
    const now = at("2026-09-28", "12:15:30");
    expect(bruttoSeconds(base, now)).toBe(5 * 3600 + 15 * 60 + 30);
    const paused = { ...base, break_minutes: 10, ...pausePatch(base, at("2026-09-28", "12:00")) } as typeof base;
    expect(pauseSince(paused)).toBe("12:00");
    // 5:15:30 brutto − 10 min − 15 min laufende Pause
    expect(formatClock(netSeconds(paused, now))).toBe("4:50:30");
  });

  it("Pause → Weiter addiert die Pausenminuten und entfernt den Pause-Tag", () => {
    const paused = { ...base, ...pausePatch(base, at("2026-09-28", "12:00")) } as typeof base;
    const resumed = resumePatch(paused, at("2026-09-28", "12:32"));
    expect(resumed.break_minutes).toBe(32);
    expect(resumed.tags).toEqual([LIVE_TAG]);
  });

  it("Feierabend: Ende = jetzt, Tags weg, Pause bleibt wenn ausreichend", () => {
    const e = { ...base, break_minutes: 45, tags: ["x", LIVE_TAG] };
    const { patch, pauseAdded } = stopPatch(e, at("2026-09-28", "16:30"));
    expect(patch).toEqual({ end_time: "16:30", break_minutes: 45, tags: ["x"] });
    expect(pauseAdded).toBe(0);
  });

  it("Feierabend: ergänzt §4-ArbZG-Mindestpause", () => {
    const r1 = stopPatch({ ...base, break_minutes: 10 }, at("2026-09-28", "14:00")); // 7h brutto
    expect(r1.patch.break_minutes).toBe(30);
    expect(r1.pauseAdded).toBe(20);
    const r2 = stopPatch(base, at("2026-09-28", "16:30")); // 9,5h brutto
    expect(r2.patch.break_minutes).toBe(45);
    const r3 = stopPatch(base, at("2026-09-28", "12:00")); // 5h → keine Pflicht
    expect(r3.patch.break_minutes).toBe(0);
  });

  it("Feierabend während der Pause zählt die laufende Pause mit", () => {
    const paused = { ...base, ...pausePatch(base, at("2026-09-28", "15:00")) } as typeof base;
    const { patch } = stopPatch(paused, at("2026-09-28", "16:00"));
    expect(patch.break_minutes).toBe(60);
    expect(patch.tags).toEqual([]);
  });

  it("Nachtschicht über Mitternacht", () => {
    const night = { ...base, start_time: "22:00" };
    const now = at("2026-09-29", "06:00");
    expect(bruttoSeconds(night, now)).toBe(8 * 3600);
    const { patch } = stopPatch(night, now);
    expect(patch).toMatchObject({ end_time: "06:00", break_minutes: 30 });
  });

  it("vergessener Stopp: manuelle Endzeit am Starttag", () => {
    const { patch } = stopPatch(base, at("2026-09-29", "08:00"), "16:00");
    expect(patch).toMatchObject({ end_time: "16:00", break_minutes: 30 }); // 9h brutto → 30
  });

  it("restartPatch ersetzt Zeiten, behält fremde Tags", () => {
    const e = { date: "2026-09-28", start_time: "07:00", end_time: "16:00", break_minutes: 30, tags: ["sample"] };
    expect(restartPatch(e, at("2026-09-28", "08:05"))).toEqual({
      day_type: "arbeiten", start_time: "08:05", end_time: null, break_minutes: 0, tags: ["sample", LIVE_TAG],
    });
  });

  it("requiredPauseMinutes Grenzen", () => {
    expect(requiredPauseMinutes(360)).toBe(0);
    expect(requiredPauseMinutes(361)).toBe(30);
    expect(requiredPauseMinutes(540)).toBe(30);
    expect(requiredPauseMinutes(541)).toBe(45);
  });
});
