import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/usePlan", () => ({ usePlan: () => ({ tier: "plus", active: false, preview: false, can: () => true, ndLimit: Infinity }) }));

import { TimeEntryModal } from "../TimeEntryModal";

describe("TimeEntryModal — Tagestypen", () => {
  it("kein 'Notdienst' als Tagestyp (wurde nie gezählt) — Notdienste über '+ Notdienst hinzufügen'", () => {
    render(
      <TimeEntryModal
        date="2026-11-09" dayOfWeek={1}
        onCreate={vi.fn(async () => ({ error: null }))} onUpdate={vi.fn(async () => ({ error: null }))} onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Arbeiten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Urlaub" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notdienst" })).toBeNull();
  });
});
