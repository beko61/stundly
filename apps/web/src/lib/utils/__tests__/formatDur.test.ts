// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatDur, formatDayMonth } from "../formatDur";

describe("formatDur", () => {
  it("einheitliche Dauer", () => {
    expect(formatDur(0)).toBe("0h");
    expect(formatDur(30)).toBe("30m");
    expect(formatDur(60)).toBe("1h");
    expect(formatDur(495)).toBe("8h 15m");
    expect(formatDur(6195)).toBe("103h 15m");
    expect(formatDur(-65)).toBe("−1h 5m");
  });

  it("mit Vorzeichen für Differenzen", () => {
    expect(formatDur(1380, true)).toBe("+23h");
    expect(formatDur(-90, true)).toBe("−1h 30m");
    expect(formatDur(0, true)).toBe("+0h");
  });

  it("Datum TT.MM.", () => {
    expect(formatDayMonth("2026-09-01")).toBe("01.09.");
  });
});
