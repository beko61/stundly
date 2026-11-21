import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RufbereitschaftRechner } from "../RufbereitschaftRechner";

describe("RufbereitschaftRechner", () => {
  it("führt direkt unter dem Ergebnis zur Registrierung, mit Herkunft für das Kokpit", () => {
    render(<RufbereitschaftRechner />);
    const link = screen.getByRole("link", { name: /Kostenlos starten/ });
    expect(link.getAttribute("href")).toBe("/register?utm_source=tool&utm_campaign=rufbereitschaft");
  });
});
