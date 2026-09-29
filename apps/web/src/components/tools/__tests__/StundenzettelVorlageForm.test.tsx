import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ build: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/pdf/stundenzettelVorlagePdf", async (orig) => {
  const real = await orig<typeof import("@/lib/pdf/stundenzettelVorlagePdf")>();
  return { ...real, buildStundenzettelVorlage: (...a: unknown[]) => { h.build(...a); return { save: h.save }; } };
});

import { StundenzettelVorlageForm } from "../StundenzettelVorlageForm";

describe("StundenzettelVorlageForm", () => {
  it("lädt jsPDF vor, erstellt beim Klick das PDF mit den Eingaben und zeigt danach den Hinweis", async () => {
    render(<StundenzettelVorlageForm />);
    // jsPDF-Vorladen dauert bei voller Testsuite länger als das Standard-Timeout (1 s)
    const btn = await screen.findByRole("button", { name: /herunterladen/ }, { timeout: 5000 });
    await waitFor(() => expect(btn).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText("Monat"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Feiertage (Bundesland)"), { target: { value: "BY" } });
    fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: "Max" } });
    fireEvent.click(screen.getByRole("button", { name: /Stundenzettel März/ }));

    expect(h.build).toHaveBeenCalledTimes(1);
    expect(h.build.mock.calls[0]![1]).toMatchObject({ month: 3, bundesland: "BY", name: "Max" });
    expect(h.save).toHaveBeenCalledWith(expect.stringMatching(/^Stundenzettel_Maerz_\d{4}\.pdf$/));
    expect(screen.getByRole("status").textContent).toMatch(/Heruntergeladen/);
  });
});
