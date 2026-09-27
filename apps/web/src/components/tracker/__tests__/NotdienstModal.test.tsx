import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotdienstModal, buildNotdienstMailto, type NotdienstEntry } from "../NotdienstModal";

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

// ── buildNotdienstMailto ────────────────────────────────────────────────────

describe("buildNotdienstMailto", () => {
  const base = {
    to: "firma@test.de", date: "2026-09-27", start: "17:00", end: "18:00", duration: "1:00",
    kunde: "Frau Kraft, 2. OG", adresse: "Kniestraße 22, Hannover", problem: "", ergebnis: "", note: "",
  };

  it("Empfänger = Firma-Mail, @ bleibt unkodiert", () => {
    expect(buildNotdienstMailto(base).startsWith("mailto:firma@test.de?")).toBe(true);
  });

  it("Betreff enthält Datum, Kunde und Adresse", () => {
    const subject = new URL(buildNotdienstMailto(base)).searchParams.get("subject");
    expect(subject).toBe("Notdienst-Bericht 2026-09-27 – Frau Kraft, 2. OG – Kniestraße 22, Hannover");
  });

  it("leere Kunde/Adresse werden im Betreff weggelassen", () => {
    const subject = new URL(buildNotdienstMailto({ ...base, kunde: "  ", adresse: "" })).searchParams.get("subject");
    expect(subject).toBe("Notdienst-Bericht 2026-09-27");
  });

  it("ohne Firma-Mail: leerer Empfänger, Mail öffnet trotzdem", () => {
    expect(buildNotdienstMailto({ ...base, to: "" }).startsWith("mailto:?subject=")).toBe(true);
  });

  it("Body enthält alle ausgefüllten Felder", () => {
    const body = new URL(buildNotdienstMailto({ ...base, problem: "WC undicht" })).searchParams.get("body");
    expect(body).toContain("Kunde: Frau Kraft, 2. OG");
    expect(body).toContain("Adresse: Kniestraße 22, Hannover");
    expect(body).toContain("Problem:\nWC undicht");
    expect(body).not.toContain("Notiz:");
  });
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
    renderModal();
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled()); // mount-Fetch der Firma-Mail
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await screen.findByText(/Session abgelaufen/);
    expect(screen.getByRole("button", { name: /Speichern/ })).not.toBeDisabled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("Mail-Klick macht keinen Netzwerk-Call (Firma-Mail wurde schon beim Öffnen geladen)", async () => {
    renderModal();
    await waitFor(() => expect(mockProfile).toHaveBeenCalledTimes(1));
    const sessionCalls = mockGetSession.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /Per Mail senden/ }));

    expect(mockGetSession.mock.calls.length).toBe(sessionCalls);
    expect(mockProfile).toHaveBeenCalledTimes(1);
  });
});
