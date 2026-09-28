// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import {
  decideReminder, buildReminderEmail, unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl,
  type ReminderInput,
} from "../reminders";

const NOW = new Date("2026-09-28T08:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const base: ReminderInput = { now: NOW, signupAt: daysAgo(3), lastDataAt: null, lastSignInAt: null, lastType: null, lastSentAt: null };

beforeAll(() => { process.env.CRON_SECRET = "test-secret"; });

describe("decideReminder", () => {
  it("noch nie etwas eingetragen: nach 2 Tagen 'start', vorher nichts", () => {
    expect(decideReminder({ ...base, signupAt: daysAgo(1) })).toBeNull();
    expect(decideReminder(base)).toEqual({ type: "start" });
  });

  it("'start2' erst nach 7 Tagen und ≥ 4 Tage nach 'start'; danach Schluss", () => {
    const afterStart = { ...base, lastType: "start" as const };
    expect(decideReminder({ ...afterStart, signupAt: daysAgo(6), lastSentAt: daysAgo(4) })).toBeNull();
    expect(decideReminder({ ...afterStart, signupAt: daysAgo(8), lastSentAt: daysAgo(2) })).toBeNull();
    expect(decideReminder({ ...afterStart, signupAt: daysAgo(8), lastSentAt: daysAgo(5) })).toEqual({ type: "start2" });
    expect(decideReminder({ ...base, signupAt: daysAgo(40), lastType: "start2", lastSentAt: daysAgo(30) })).toBeNull();
  });

  it("aktive Nutzer bekommen nichts", () => {
    expect(decideReminder({ ...base, signupAt: daysAgo(90), lastDataAt: daysAgo(3) })).toBeNull();
    // Daten alt, aber kürzlich angemeldet → zählt als aktiv
    expect(decideReminder({ ...base, signupAt: daysAgo(90), lastDataAt: daysAgo(30), lastSignInAt: daysAgo(2) })).toBeNull();
  });

  it("'comeback' nach 14 Tagen Pause — einmal pro Pause", () => {
    const idle = { ...base, signupAt: daysAgo(90), lastDataAt: daysAgo(20) };
    expect(decideReminder({ ...idle, lastDataAt: daysAgo(13) })).toBeNull();
    expect(decideReminder(idle)).toEqual({ type: "comeback", inactiveDays: 20 });
    // schon für diese Pause erinnert
    expect(decideReminder({ ...idle, lastType: "comeback", lastSentAt: daysAgo(6) })).toBeNull();
    // danach wieder aktiv gewesen, jetzt erneut 14+ Tage still → neue Erinnerung
    expect(decideReminder({ ...idle, lastDataAt: daysAgo(15), lastType: "comeback", lastSentAt: daysAgo(40) }))
      .toEqual({ type: "comeback", inactiveDays: 15 });
  });

  it("'start' zählt nicht als Erinnerung für eine spätere Pause", () => {
    expect(decideReminder({ ...base, signupAt: daysAgo(60), lastDataAt: daysAgo(20), lastType: "start", lastSentAt: daysAgo(58) }))
      .toEqual({ type: "comeback", inactiveDays: 20 });
  });
});

describe("Abmelde-Token", () => {
  it("gültig nur für die eigene User-ID", () => {
    const t = unsubscribeToken("u1");
    expect(verifyUnsubscribeToken("u1", t)).toBe(true);
    expect(verifyUnsubscribeToken("u2", t)).toBe(false);
    expect(verifyUnsubscribeToken("u1", t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"))).toBe(false);
    expect(verifyUnsubscribeToken("u1", "")).toBe(false);
    expect(unsubscribeUrl("u1")).toContain(`/api/email/unsubscribe?u=u1&t=${t}`);
  });
});

describe("buildReminderEmail", () => {
  it("Inhalte + Abmelde-Link, Name wird escaped", () => {
    const start = buildReminderEmail("start", { name: "Yusuf <b>", unsubUrl: "https://x/u" });
    expect(start.subject).toMatch(/startklar/);
    expect(start.html).toContain("Hallo Yusuf &lt;b&gt;,");
    expect(start.html).toContain('href="https://x/u"');
    expect(start.text).toContain("https://x/u");

    const back = buildReminderEmail("comeback", { name: "", inactiveDays: 21, unsubUrl: "https://x/u" });
    expect(back.subject).toBe("Seit 21 Tagen nichts eingetragen — fehlen Stunden?");
    expect(back.html).toContain("Hallo,");
  });
});
