import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotdienstModal, type NotdienstEntry } from "../NotdienstModal";

// ── Supabase-Client Mock ────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockInsert     = vi.fn();
const mockUpdate     = vi.fn();
const mockDelete     = vi.fn();
const mockProfile    = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockProfile }) }) };
      }
      return {
        insert: (payload: unknown) => ({ select: () => ({ single: () => mockInsert(payload) }) }),
        update: (payload: unknown) => ({
          eq: (_col: string, id: string) => ({ select: () => ({ single: () => mockUpdate(id, payload) }) }),
        }),
        delete: () => ({ eq: (_col: string, id: string) => mockDelete(id) }),
      };
    },
  }),
}));

// Anhänge/PDF-Panel hat eigene Tests (NotdienstBerichtPanel.test.tsx) und braucht React Query
vi.mock("../NotdienstBerichtPanel", () => ({ NotdienstBerichtPanel: () => null }));

const SESSION = { data: { session: { user: { id: "u1" } } } };

function savedRow(id: string, payload: Record<string, unknown>): NotdienstEntry {
  return { id, ...payload } as unknown as NotdienstEntry;
}

function renderModal(entry: NotdienstEntry | null = null) {
  const onSave   = vi.fn();
  const onDelete = vi.fn();
  const onClose  = vi.fn();
  render(<NotdienstModal date="2026-09-27" entry={entry} onSave={onSave} onDelete={onDelete} onClose={onClose} />);
  return { onSave, onDelete, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(SESSION);
  mockProfile.mockResolvedValue({ data: { email: "firma@test.de" }, error: null });
  mockInsert.mockImplementation(async (p: Record<string, unknown>) => ({ data: savedRow("nd-1", p), error: null }));
  mockUpdate.mockImplementation(async (id: string, p: Record<string, unknown>) => ({ data: savedRow(id, p), error: null }));
  mockDelete.mockResolvedValue({ error: null });
});

// ── NotdienstModal ──────────────────────────────────────────────────────────

describe("NotdienstModal", () => {
  beforeEach(() => {
    // jsdom meldet "Not implemented: navigation" beim mailto-Klick — hier irrelevant
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("neuer Eintrag: Speichern → insert, Modal bleibt offen, Button wird 'Aktualisieren'", async () => {
    const { onSave, onClose } = renderModal();
    fireEvent.change(screen.getByPlaceholderText(/Ermakov/), { target: { value: "Frau Kraft" } });
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await screen.findByText(/Gespeichert/);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0]![0]).toMatchObject({ user_id: "u1", date: "2026-09-27", kunde: "Frau Kraft" });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "nd-1" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Aktualisieren/ })).toBeInTheDocument();
  });

  it("zweites Speichern im selben Modal → update derselben id, kein zweiter insert", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    const updateBtn = await screen.findByRole("button", { name: /Aktualisieren/ });

    fireEvent.change(screen.getByPlaceholderText(/Ermakov/), { target: { value: "Herr Meier" } });
    fireEvent.click(updateBtn);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0]![0]).toBe("nd-1");
    expect(mockUpdate.mock.calls[0]![1]).toMatchObject({ kunde: "Herr Meier" });
  });

  it("Löschen erscheint nach dem ersten Speichern und nutzt die neue id", async () => {
    const { onDelete, onClose } = renderModal();
    expect(screen.queryByRole("button", { name: /löschen/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    fireEvent.click(await screen.findByRole("button", { name: /löschen/ }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("nd-1"));
    expect(mockDelete).toHaveBeenCalledWith("nd-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("DB-Fehler: Meldung sichtbar, Button wieder aktiv, kein onSave/onClose", async () => {
    mockInsert.mockResolvedValueOnce({ data: null, error: { message: "RLS violation" } });
    const { onSave, onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await screen.findByText(/RLS violation/);
    expect(screen.getByRole("button", { name: /Speichern/ })).not.toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keine Session: Meldung statt endlosem 'Speichern...'", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await screen.findByText(/Session abgelaufen/);
    expect(screen.getByRole("button", { name: /Speichern/ })).not.toBeDisabled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("kein 'Per Mail senden' mehr — Versand läuft über 'Bericht teilen'", () => {
    renderModal();
    expect(screen.queryByRole("button", { name: /Per Mail senden/ })).not.toBeInTheDocument();
  });

  it("Telefon des Kunden: wird gespeichert, 📞 ruft die Nummer an", async () => {
    const { onSave } = renderModal();
    const tel = screen.getByLabelText("Telefon (Kunde)");
    expect(screen.queryByRole("link", { name: "Kunde anrufen" })).not.toBeInTheDocument();
    fireEvent.change(tel, { target: { value: "0511 12 34-56" } });
    expect(screen.getByRole("link", { name: "Kunde anrufen" })).toHaveAttribute("href", "tel:0511123456");

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(mockInsert.mock.calls[0]![0]).toMatchObject({ kunde_telefon: "0511 12 34-56" });
  });

  it("ohne Telefon wird das Feld nicht gesendet (Speichern klappt auch vor Migration 030)", async () => {
    const { onSave } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(mockInsert.mock.calls[0]![0]).not.toHaveProperty("kunde_telefon");
  });

  it("vorhandene Nummer löschen → wird auf null gesetzt", async () => {
    const { onSave } = renderModal(savedRow("nd-7", { date: "2026-09-27", start_time: "18:00", end_time: "19:00", kunde_telefon: "0511 1" }));
    expect(screen.getByLabelText("Telefon (Kunde)")).toHaveValue("0511 1");
    fireEvent.change(screen.getByLabelText("Telefon (Kunde)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Aktualisieren/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0]![1]).toMatchObject({ kunde_telefon: null });
  });
});

// ── Uhrzeit-Automatik ───────────────────────────────────────────────────────

describe("NotdienstModal — Uhrzeit", () => {
  afterEach(() => { vi.useRealTimers(); });

  const startInput = () => screen.getByLabelText("Start") as HTMLInputElement;
  const endInput   = () => screen.getByLabelText("Ende") as HTMLInputElement;

  it("neuer Eintrag: Start = Uhrzeit beim Öffnen (minutengenau), Ende = +1h", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 27, 14, 37));
    renderModal();
    expect(startInput().value).toBe("14:37");
    expect(endInput().value).toBe("15:37");
  });

  it("Ende läuft mit Start mit, bis Ende selbst geändert wird", () => {
    renderModal();
    fireEvent.change(startInput(), { target: { value: "20:10" } });
    expect(endInput().value).toBe("21:10");
    fireEvent.change(endInput(), { target: { value: "22:00" } });
    fireEvent.change(startInput(), { target: { value: "19:00" } });
    expect(endInput().value).toBe("22:00");
  });

  it("bestehender Eintrag: HH:MM statt HH:MM:SS, Start ändern verschiebt Ende nicht", () => {
    renderModal(savedRow("nd-9", { date: "2026-09-27", start_time: "18:00:00", end_time: "19:30:00" }));
    expect(startInput().value).toBe("18:00");
    expect(endInput().value).toBe("19:30");
    fireEvent.change(startInput(), { target: { value: "17:00" } });
    expect(endInput().value).toBe("19:30");
  });
});

// ── Adresse: PLZ → Ort + Straßenvorschläge ─────────────────────────────────

describe("NotdienstModal — Adresse", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      plz: "30519", orte: ["Hannover"],
      streets: [
        { name: "Hildebrand-Weg", ort: "Hannover" },
        { name: "Hildesheimer Straße", ort: "Hannover" },
        { name: "Wiehbergstraße", ort: "Hannover" },
      ],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const plzInput    = () => screen.getByLabelText("PLZ") as HTMLInputElement;
  const ortInput    = () => screen.getByLabelText("Ort") as HTMLInputElement;
  const streetInput = () => screen.getByLabelText("Straße und Hausnummer") as HTMLInputElement;

  it("PLZ → Ort automatisch, Straße tippen → Vorschläge, Auswahl → gespeicherte Adresse", async () => {
    const { onSave } = renderModal();
    fireEvent.change(plzInput(), { target: { value: "30519" } });
    await waitFor(() => expect(ortInput().value).toBe("Hannover"));
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/address/streets?plz=30519");

    fireEvent.focus(streetInput());
    fireEvent.change(streetInput(), { target: { value: "hilde" } });
    const options = screen.getAllByRole("option").map(o => o.textContent);
    expect(options).toEqual(["Hildebrand-Weg", "Hildesheimer Straße"]);

    fireEvent.mouseDown(screen.getByRole("option", { name: "Hildesheimer Straße" }));
    expect(streetInput().value).toBe("Hildesheimer Straße ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.change(streetInput(), { target: { value: "Hildesheimer Straße 5" } });
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(mockInsert.mock.calls[0]![0]).toMatchObject({ adresse: "Hildesheimer Straße 5, 30519 Hannover" });
  });

  it("PLZ nur Ziffern, max. 5; ohne vollständige PLZ kein Request", () => {
    renderModal();
    fireEvent.change(plzInput(), { target: { value: "30a51" } });
    expect(plzInput().value).toBe("3051");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bestehende Adresse wird in PLZ / Ort / Straße zerlegt", () => {
    renderModal(savedRow("nd-9", { date: "2026-09-27", start_time: "18:00", end_time: "19:00",
      adresse: "Wiehbergstraße 3, 30519 Hannover" }));
    expect(plzInput().value).toBe("30519");
    expect(ortInput().value).toBe("Hannover");
    expect(streetInput().value).toBe("Wiehbergstraße 3");
  });

  it("Straßenverzeichnis nicht erreichbar → Adresse bleibt frei eintippbar", async () => {
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 502 }));
    const { onSave } = renderModal();
    fireEvent.change(plzInput(), { target: { value: "30519" } });
    fireEvent.change(ortInput(), { target: { value: "Hannover" } });
    fireEvent.focus(streetInput());
    fireEvent.change(streetInput(), { target: { value: "Hinterhof 2" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(mockInsert.mock.calls[0]![0]).toMatchObject({ adresse: "Hinterhof 2, 30519 Hannover" });
  });
});

// ── Offline ─────────────────────────────────────────────────────────────────

describe("NotdienstModal — offline", () => {
  const setOnline = (v: boolean) => Object.defineProperty(navigator, "onLine", { value: v, configurable: true });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("stundly_last_uid", "u1");
    setOnline(false);
  });
  afterEach(() => { setOnline(true); vi.restoreAllMocks(); });

  it("ohne Netz: Speichern landet in der Outbox mit fester UUID, kein Server-Aufruf", async () => {
    const { getOutbox } = await import("@/lib/offline/outbox");
    const { onSave } = renderModal();
    fireEvent.change(screen.getByPlaceholderText(/Ermakov/), { target: { value: "Frau Kraft" } });
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await screen.findByText(/Offline gespeichert/);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockGetSession).not.toHaveBeenCalled();
    const [op] = getOutbox();
    expect(op).toMatchObject({ kind: "nd_upsert", isNew: true, userId: "u1", row: { kunde: "Frau Kraft", date: "2026-09-27" } });
    expect(op!.kind === "nd_upsert" && op!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ _pending: true, kunde: "Frau Kraft" }));

    // Zweites Speichern → gleiche ID, weiterhin ein Insert
    fireEvent.change(screen.getByPlaceholderText(/Ermakov/), { target: { value: "Frau Kraft-Meyer" } });
    fireEvent.click(screen.getByRole("button", { name: /Aktualisieren/ }));
    await waitFor(() => expect(getOutbox()[0]).toMatchObject({ isNew: true, row: { kunde: "Frau Kraft-Meyer" } }));
    expect(getOutbox()).toHaveLength(1);
  });

  it("Netzwerkfehler trotz 'online' → ebenfalls Outbox statt Fehlermeldung", async () => {
    setOnline(true);
    mockInsert.mockResolvedValue({ data: null, error: { message: "TypeError: Failed to fetch" } });
    const { getOutbox } = await import("@/lib/offline/outbox");
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    await screen.findByText(/Offline gespeichert/);
    expect(getOutbox()).toHaveLength(1);
  });
});

describe("NotdienstModal — Validierung", () => {
  it("Start = Ende → Hinweis, kein Speichern", async () => {
    renderModal({
      id: "nd-9", user_id: "u1", date: "2026-09-22", start_time: "19:00:00", end_time: "19:00:00",
      note: null, kunde: "Herr Malak", adresse: null, problem: null, ergebnis: null, erledigt: false,
    });
    fireEvent.click(screen.getByRole("button", { name: /Aktualisieren/ }));
    expect(await screen.findByText(/Start und Ende sind gleich/)).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
