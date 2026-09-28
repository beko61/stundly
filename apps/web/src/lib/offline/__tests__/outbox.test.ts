import { describe, it, expect, beforeEach } from "vitest";
import { enqueue, getOutbox, removeOp, markFailed, getFailed, clearOutbox, hasPending, type OutboxOp } from "../outbox";

const te = (date: string, start: string, at = Date.now()): OutboxOp => ({
  kind: "te_upsert", key: `te:${date}`, userId: "u1", date, at,
  row: { date, day_type: "arbeiten", start_time: start, end_time: "16:00", break_minutes: 30, is_night_shift: false, note: null, tags: [] },
});
const nd = (id: string, isNew: boolean, row: Record<string, unknown>, at = Date.now()): OutboxOp => ({
  kind: "nd_upsert", key: `nd:${id}`, userId: "u1", id, isNew, row: { date: "2026-09-28", ...row }, at,
});

describe("offline outbox", () => {
  beforeEach(() => { localStorage.clear(); });

  it("gleicher Tag: letzte Änderung gewinnt, Position bleibt", () => {
    enqueue(te("2026-09-01", "07:00"));
    enqueue(te("2026-09-02", "07:00"));
    enqueue(te("2026-09-01", "08:00"));
    const list = getOutbox();
    expect(list.map((o) => o.key)).toEqual(["te:2026-09-01", "te:2026-09-02"]);
    expect(list[0]!.kind === "te_upsert" && list[0]!.row.start_time).toBe("08:00");
  });

  it("Notdienst: offline angelegt + geändert → bleibt Insert mit zusammengeführten Feldern", () => {
    enqueue(nd("a", true, { kunde: "Kraft", problem: "Heizung" }));
    enqueue(nd("a", false, { erledigt: true }));
    const [op] = getOutbox();
    expect(op).toMatchObject({ kind: "nd_upsert", isNew: true, row: { kunde: "Kraft", problem: "Heizung", erledigt: true } });
  });

  it("Notdienst: offline angelegt + offline gelöscht → nichts senden", () => {
    enqueue(nd("a", true, { kunde: "Kraft" }));
    enqueue({ kind: "nd_delete", key: "nd:a", userId: "u1", id: "a", at: Date.now() });
    expect(getOutbox()).toEqual([]);
  });

  it("Notdienst: bestehender Eintrag gelöscht → Delete bleibt", () => {
    enqueue(nd("b", false, { erledigt: true }));
    enqueue({ kind: "nd_delete", key: "nd:b", userId: "u1", id: "b", at: Date.now() });
    expect(getOutbox()).toEqual([expect.objectContaining({ kind: "nd_delete", id: "b" })]);
  });

  it("removeOp entfernt nur die gesendete Version (nicht eine neuere)", () => {
    const first = te("2026-09-01", "07:00", 1);
    enqueue(first);
    enqueue(te("2026-09-01", "09:00", 2)); // während des Sync geändert
    removeOp(first);
    expect(hasPending("te:2026-09-01")).toBe(true);
  });

  it("markFailed verschiebt in die Fehlerliste; filtert nach User", () => {
    const op = te("2026-09-01", "07:00");
    enqueue(op);
    enqueue({ ...te("2026-09-03", "07:00"), userId: "u2" });
    expect(getOutbox("u1")).toHaveLength(1);
    markFailed(op, "violates check");
    expect(getOutbox("u1")).toHaveLength(0);
    expect(getFailed()).toEqual([{ op, error: "violates check" }]);
    clearOutbox();
    expect(getOutbox()).toEqual([]);
    expect(getFailed()).toEqual([]);
  });
});
