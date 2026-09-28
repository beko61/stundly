import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  live: null as unknown,
  entries: [] as unknown[],
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/hooks/queries/useTimeEntries", () => ({
  useLiveEntryQuery:   () => ({ data: h.live, isPending: false }),
  useTimeEntriesQuery: () => ({ data: h.entries, isPending: false }),
  useCreateTimeEntry:  () => ({ mutateAsync: h.create }),
  useUpdateTimeEntry:  () => ({ mutateAsync: h.update }),
}));

import { LiveTimerCard } from "../LiveTimerCard";

const NOW = new Date(2026, 8, 28, 12, 15, 30);

describe("LiveTimerCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    h.live = null;
    h.entries = [];
    h.create.mockReset().mockResolvedValue({});
    h.update.mockReset().mockResolvedValue({});
  });
  afterEach(() => vi.useRealTimers());

  it("Arbeitsbeginn legt Live-Eintrag für heute an", async () => {
    render(<LiveTimerCard />);
    fireEvent.click(screen.getByRole("button", { name: /Arbeitsbeginn/ }));
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));
    expect(h.create.mock.calls[0]![0]).toMatchObject({
      date: "2026-09-28", start_time: "12:15", end_time: null, tags: ["live"],
    });
  });

  it("laufender Timer zeigt Netto-Zeit; Feierabend speichert Ende + Mindestpause", async () => {
    h.live = { id: "e1", date: "2026-09-28", start_time: "07:00:00", end_time: null, break_minutes: 0, tags: ["live"], day_type: "arbeiten" };
    render(<LiveTimerCard />);
    expect(screen.getByText("5:15:30")).toBeTruthy();
    expect(screen.getByText(/Läuft seit 07:00/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Feierabend/ }));
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0]![0]).toEqual({
      id: "e1", patch: { end_time: "12:15", break_minutes: 0, tags: [] },
    });
  });

  it("Pause setzt Pause-Tag", async () => {
    h.live = { id: "e1", date: "2026-09-28", start_time: "07:00", end_time: null, break_minutes: 0, tags: ["live"], day_type: "arbeiten" };
    render(<LiveTimerCard />);
    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0]![0].patch.tags).toEqual(["live", "pause:12:15"]);
  });

  it("heute schon erfasst → Zusammenfassung statt Start-Button", () => {
    h.entries = [{ id: "e2", date: "2026-09-28", start_time: "07:00", end_time: "16:00", break_minutes: 30, tags: [], day_type: "arbeiten" }];
    render(<LiveTimerCard />);
    expect(screen.getByText("07:00–16:00")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Arbeitsbeginn/ })).toBeNull();
  });

  it("Urlaub heute → Karte ausgeblendet", () => {
    h.entries = [{ id: "e3", date: "2026-09-28", start_time: null, end_time: null, break_minutes: 0, tags: [], day_type: "urlaub" }];
    const { container } = render(<LiveTimerCard />);
    expect(container.innerHTML).toBe("");
  });

  it("über 14 Std. → Hinweis mit manueller Endzeit", () => {
    h.live = { id: "e1", date: "2026-09-27", start_time: "07:00", end_time: null, break_minutes: 0, tags: ["live"], day_type: "arbeiten" };
    render(<LiveTimerCard />);
    expect(screen.getByText(/Feierabend vergessen/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /■ Feierabend/ })).toBeNull();
  });
});
