import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavigationAppCard } from "../NavigationAppCard";

describe("NavigationAppCard", () => {
  beforeEach(() => localStorage.clear());

  it("zeigt die gespeicherte App an und speichert eine neue Wahl sofort", () => {
    localStorage.setItem("stundly_nav_app", "yandex");
    render(<NavigationAppCard />);
    expect(screen.getByRole("radio", { name: /Yandex Karten/ })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /Waze/ }));
    expect(localStorage.getItem("stundly_nav_app")).toBe("waze");
    expect(screen.getByRole("status").textContent).toMatch(/Gespeichert/);
  });
});
