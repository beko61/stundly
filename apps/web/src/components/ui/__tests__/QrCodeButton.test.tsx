import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QrCodeButton } from "../QrCodeButton";

describe("QrCodeButton", () => {
  it("zeigt den QR-Code im Vollbild und bietet ihn als Bild an", async () => {
    render(<QrCodeButton url="https://stundly.de/register?ref=85044a3b" title="Kostenlos" hint="Scannen" fileName="Stundly-QR-Code.png" />);
    fireEvent.click(await screen.findByRole("button", { name: /QR-Code zeigen/ }));
    const dialog = screen.getByRole("dialog", { name: "Kostenlos" });
    expect(dialog.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("https://stundly.de/register?ref=85044a3b")).toBeTruthy();
    const download = screen.getByRole("link", { name: /Als Bild speichern/ });
    expect(download.getAttribute("download")).toBe("Stundly-QR-Code.png");
    expect(download.getAttribute("href")).toMatch(/^data:image\/png;base64,/);
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
