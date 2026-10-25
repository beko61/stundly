import { describe, it, expect } from "vitest";
import { byEntryOrder } from "../order";

describe("byEntryOrder — Notdienste in Eingabe-Reihenfolge", () => {
  it("zuerst eingetragen = zuerst, unabhängig von der Uhrzeit; offline (ohne created_at) ans Ende", () => {
    const list = [
      { name: "Mehmet", start_time: "08:00", created_at: "2026-10-25T10:05:00Z" },
      { name: "offline", start_time: "06:00", created_at: undefined },
      { name: "Ahmet", start_time: "20:00", created_at: "2026-10-25T10:01:00Z" },
    ];
    expect([...list].sort(byEntryOrder).map((x) => x.name)).toEqual(["Ahmet", "Mehmet", "offline"]);
  });
});
