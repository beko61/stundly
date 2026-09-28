import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UeberstundenRechner } from "../UeberstundenRechner";

const result = () => document.querySelector('[aria-live="polite"]')?.textContent ?? "";

describe("UeberstundenRechner", () => {
  it("Beispielwoche: 5 × 8h 30m bei 40 h → +2h 30m", () => {
    render(<UeberstundenRechner />);
    expect(result()).toContain("+2h 30m");
    expect(result()).toContain("Gearbeitet 42h 30m");
  });

  it("Samstag eintragen erhöht die Überstunden", () => {
    render(<UeberstundenRechner />);
    fireEvent.change(screen.getByLabelText("Samstag Beginn"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("Samstag Ende"), { target: { value: "12:00" } });
    expect(result()).toContain("+6h 30m");
  });

  it("Stunden gesamt pro Monat + Lohn mit Zuschlag", () => {
    render(<UeberstundenRechner />);
    fireEvent.click(screen.getByRole("tab", { name: "Stunden gesamt" }));
    fireEvent.change(screen.getByLabelText("Gearbeitete Stunden"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Stundenlohn € (optional)"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Überstunden-Zuschlag"), { target: { value: "25" } });
    // Soll 40 × 52/12 = 173h 20m → +6h 40m; Wert 6,67 h × 20 € × 1,25 = 166,67 €
    expect(result()).toContain("+6h 40m");
    expect(result()).toMatch(/166,67\s€/);
  });

  it("Minusstunden und ungültige Eingabe", () => {
    render(<UeberstundenRechner />);
    fireEvent.click(screen.getByRole("tab", { name: "Stunden gesamt" }));
    fireEvent.change(screen.getByLabelText("Gearbeitete Stunden"), { target: { value: "150" } });
    expect(result()).toContain("Minusstunden");
    fireEvent.change(screen.getByLabelText("Gearbeitete Stunden"), { target: { value: "abc" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Bitte Stunden als Zahl/);
  });

  it("über 10 h am Tag → ArbZG-Hinweis", () => {
    render(<UeberstundenRechner />);
    fireEvent.change(screen.getByLabelText("Montag Ende"), { target: { value: "19:00" } });
    expect(screen.getByRole("alert").textContent).toMatch(/mehr als 10 Stunden am Montag/);
  });
});
