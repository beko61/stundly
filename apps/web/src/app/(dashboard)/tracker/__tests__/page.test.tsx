import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

// ── Mocks ───────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  entries: { data: [] as unknown[], isLoading: false, isPending: false, refetch: () => Promise.resolve() },
  nd:      { data: [] as unknown[], isPending: true },
  bundeslandResolve: null as null | (() => void),
}));

vi.mock("@/hooks/queries/useTimeEntries", () => ({
  useTimeEntriesQuery: () => h.entries,
  useCreateTimeEntry:  () => ({ mutateAsync: vi.fn() }),
  useUpdateTimeEntry:  () => ({ mutateAsync: vi.fn() }),
  useDeleteTimeEntry:  () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/useNotdienstEntries", () => ({
  useNotdienstEntriesQuery: () => h.nd,
}));
vi.mock("@/hooks/queries/useCompanyMembership", () => ({
  useCompanyMembership: () => ({ data: { isCompanyEmployee: false, contract: null } }),
}));
vi.mock("@/hooks/queries/useCompanyWorkflow", () => ({
  monthKey: (y: number, m: number) => `${y}-${m}`,
  useMonthClosings: () => ({ data: undefined }),
  useEntryCorrections: () => ({ data: undefined }),
}));
vi.mock("@/components/tracker/CompanyMonthBar", () => ({ CompanyMonthBar: () => null }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) },
    from: () => ({ select: () => ({ eq: () => ({
      single: () => new Promise(res => { h.bundeslandResolve = () => res({ data: { bundesland: "NI" } }); }),
    }) }) }),
  }),
}));

// Kinder, die für den Scroll irrelevant sind
vi.mock("@/components/tracker/MonthNav",        () => ({ MonthNav: () => null }));
vi.mock("@/components/tracker/MonthlySummary",  () => ({ MonthlySummary: () => null }));
vi.mock("@/components/tracker/NotdienstWeekly", () => ({ NotdienstWeekly: () => null }));
vi.mock("@/components/tracker/PhotoScanModal",  () => ({ PhotoScanModal: () => null }));
vi.mock("@/components/ui/WelcomeBanner",        () => ({ WelcomeBanner: () => null }));
vi.mock("@/components/tracker/DayEntry", () => ({
  DayEntry: ({ date, ndEntries }: { date: string; ndEntries: unknown[] }) =>
    <div data-testid={`day-${date}`} data-nd={ndEntries.length} />,
}));

import TrackerPage from "../page";

function localToday(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

const scrollSpy = vi.fn();
let scrolledEl: Element | null = null;

beforeEach(() => {
  scrollSpy.mockReset();
  scrolledEl = null;
  Element.prototype.scrollIntoView = function (this: Element, ...args: unknown[]) {
    scrolledEl = this;
    scrollSpy(...args);
  } as Element["scrollIntoView"];
  h.entries = { data: [], isLoading: false, isPending: false, refetch: () => Promise.resolve() };
  h.nd = { data: [], isPending: true };
  h.bundeslandResolve = null;
});

const wait = (ms: number) => act(() => new Promise(r => setTimeout(r, ms)));

describe("Tracker — Scroll zu heute", () => {
  it("scrollt erst, wenn Notdienste UND Bundesland geladen sind", async () => {
    const { rerender } = render(<TrackerPage />);
    await waitFor(() => expect(h.bundeslandResolve).not.toBeNull());

    // Einträge da, Notdienste noch pending → kein Scroll
    await wait(300);
    expect(scrollSpy).not.toHaveBeenCalled();

    // Notdienste da, Bundesland noch nicht → kein Scroll
    h.nd = { data: [], isPending: false };
    rerender(<TrackerPage />);
    await wait(300);
    expect(scrollSpy).not.toHaveBeenCalled();

    // Bundesland da → Scroll auf die heutige Zeile
    await act(async () => { h.bundeslandResolve!(); });
    await waitFor(() => expect(scrollSpy).toHaveBeenCalledTimes(1));
    const el = scrolledEl as HTMLElement;
    expect(el.id).toBe("today-entry");
    expect(el.querySelector(`[data-testid="day-${localToday()}"]`)).not.toBeNull();
  });

  it("Notdienste werden einmal geladen und nach Datum an die Tageszeilen verteilt", async () => {
    const today = localToday();
    h.nd = {
      isPending: false,
      data: [
        { id: "a", date: today, start_time: "20:00", end_time: "21:00" },
        { id: "b", date: today, start_time: "18:00", end_time: "19:00" },
      ],
    };
    const { getByTestId } = render(<TrackerPage />);
    expect(getByTestId(`day-${today}`).dataset["nd"]).toBe("2");
  });
});
