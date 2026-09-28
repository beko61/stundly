import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PrivacyAccountCard } from "../PrivacyAccountCard";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function route(handlers: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const h = handlers[key];
    if (!h) throw new Error(`unerwarteter Request: ${key}`);
    return h();
  });
}

describe("PrivacyAccountCard", () => {
  it("Konto löschen erst nach Eingabe von LÖSCHEN, danach Datum + Widerruf", async () => {
    route({
      "GET /api/dsgvo/delete":  () => json({ pending: null, selfService: true }),
      "POST /api/dsgvo/delete": () => json({ scheduled_for: "2026-10-28T10:00:00.000Z" }),
      "DELETE /api/dsgvo/delete": () => json({ message: "ok" }),
    });
    render(<PrivacyAccountCard />);
    fireEvent.click(await screen.findByRole("button", { name: /Konto löschen…/ }));

    const confirmBtn = screen.getByRole("button", { name: "Konto löschen" });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Tippe/), { target: { value: "löschen" } });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Tippe/), { target: { value: "LÖSCHEN" } });
    fireEvent.click(confirmBtn);

    expect(await screen.findByText(/28\. Oktober 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Löschantrag widerrufen" }));
    expect(await screen.findByText(/Löschantrag widerrufen — dein Konto bleibt/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Konto löschen…/ })).toBeInTheDocument();
  });

  it("offener Antrag wird beim Öffnen angezeigt", async () => {
    route({ "GET /api/dsgvo/delete": () => json({ pending: { scheduled_for: "2026-10-28T10:00:00.000Z" }, selfService: true }) });
    render(<PrivacyAccountCard />);
    expect(await screen.findByText(/28\. Oktober 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Konto löschen…/ })).not.toBeInTheDocument();
  });

  it("Firmenkonto: kein Lösch-Button, Hinweis auf Arbeitgeber", async () => {
    route({ "GET /api/dsgvo/delete": () => json({ pending: null, selfService: false }) });
    render(<PrivacyAccountCard />);
    expect(await screen.findByText(/bei deinem\s+Arbeitgeber/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Konto löschen/ })).not.toBeInTheDocument();
  });

  it("Daten herunterladen löst Datei-Download mit Server-Dateinamen aus", async () => {
    route({
      "GET /api/dsgvo/delete": () => json({ pending: null, selfService: true }),
      "GET /api/dsgvo/export": () => json({ ok: true }, 200, { "Content-Disposition": 'attachment; filename="stundly-daten-2026-09-28.json"' }),
    });
    const created = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });

    render(<PrivacyAccountCard />);
    fireEvent.click(screen.getByRole("button", { name: /Meine Daten herunterladen/ }));
    await waitFor(() => expect(clicks).toEqual(["stundly-daten-2026-09-28.json"]));
    expect(created).toHaveBeenCalled();
  });

  it("Export-Fehler (z.B. Rate-Limit) wird angezeigt", async () => {
    route({
      "GET /api/dsgvo/delete": () => json({ pending: null, selfService: true }),
      "GET /api/dsgvo/export": () => json({ error: "Zu viele Export-Anfragen." }, 429),
    });
    render(<PrivacyAccountCard />);
    fireEvent.click(screen.getByRole("button", { name: /Meine Daten herunterladen/ }));
    expect(await screen.findByText(/Zu viele Export-Anfragen/)).toBeInTheDocument();
  });
});
