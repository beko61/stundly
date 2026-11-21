import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotdienstNettoRechner } from "../NotdienstNettoRechner";

describe("NotdienstNettoRechner", () => {
  it("führt direkt unter dem Ergebnis zur Registrierung, mit Herkunft für das Kokpit", () => {
    render(<NotdienstNettoRechner />);
    const link = screen.getByRole("link", { name: /Kostenlos starten/ });
    expect(link.getAttribute("href")).toBe("/register?utm_source=tool&utm_campaign=notdienstpauschale");
  });

  it("Brutto folgt aus Pauschale × Wochen", () => {
    render(<NotdienstNettoRechner />);
    fireEvent.change(screen.getByLabelText("Notdienst-Wochen im Monat"), { target: { value: "2" } });
    expect(screen.getByText("Notdienst brutto").nextElementSibling?.textContent).toContain("300,00");
  });
});
