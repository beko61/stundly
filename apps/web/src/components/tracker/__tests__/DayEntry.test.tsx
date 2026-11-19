import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DayEntry } from "../DayEntry";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const noop = async () => ({ error: null });
function renderDay(props: Partial<Parameters<typeof DayEntry>[0]> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DayEntry date="2026-11-20" entry={null} isToday={false} dayOfWeek={5} feiertag="" ndEntries={[]}
        onCreate={noop} onUpdate={noop} onDelete={async () => {}} {...props} />
    </QueryClientProvider>,
  );
}

describe("DayEntry — Notdienst", () => {
  it("Freitag ohne Arbeitszeit-Eintrag: Notdienst trotzdem eintragbar (Nutzerwunsch 19.11.2026)", () => {
    renderDay();
    expect(screen.getByRole("button", { name: /Notdienst hinzufügen/ })).toBeInTheDocument();
  });

  it("freigegebener Notdienst-Monat: kein Hinzufügen", () => {
    renderDay({ ndLocked: true });
    expect(screen.queryByRole("button", { name: /Notdienst hinzufügen/ })).not.toBeInTheDocument();
  });
});
