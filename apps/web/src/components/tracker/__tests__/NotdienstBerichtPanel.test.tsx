import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Mocks ───────────────────────────────────────────────────────────────────
const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  failSelect: false,
  nextId: 1,
  inserts: [] as Array<Record<string, unknown>>,
  deletes: [] as Array<Array<[string, unknown]>>,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: "u1", email: "y@b.de" } } } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
          vorname: "Yusuf", nachname: "Bektas", company_name: "Meier GmbH", email: "info@meier.de",
          firma_strasse: "Hauptstr. 1", firma_plz: "30159", firma_ort: "Hannover", firma_telefon: "0511",
          logo_data: null, signature_data: "data:image/png;base64,TECH",
        } }) }) }) };
      }
      // notdienst_anhaenge
      const filters: Array<[string, unknown]> = [];
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return chain; },
        then: (res: (v: unknown) => unknown) => {
          const out = h.failSelect
            ? { data: null, error: { message: "relation does not exist" } }
            : { data: h.rows.filter(r => filters.every(([k, v]) => r[k] === v)), error: null };
          return Promise.resolve(out).then(res);
        },
        insert: async (row: Record<string, unknown>) => {
          h.inserts.push(row);
          h.rows.push({ id: `a${h.nextId++}`, created_at: "2026-09-27T17:45:00.000Z", unterzeichner: null, ...row });
          return { error: null };
        },
        delete: () => {
          const del: Array<[string, unknown]> = [];
          const dchain = {
            eq: (k: string, v: unknown) => { del.push([k, v]); return dchain; },
            then: (res: (v: unknown) => unknown) => {
              h.deletes.push(del);
              h.rows = h.rows.filter(r => !del.every(([k, v]) => r[k] === v));
              return Promise.resolve({ error: null }).then(res);
            },
          };
          return dchain;
        },
      };
      return chain;
    },
  }),
}));

const compressMock = vi.fn(async () => "data:image/jpeg;base64,FOTO");
vi.mock("@/lib/image/compressImage", () => ({ compressImage: (...a: unknown[]) => compressMock(...(a as [])) }));

const pdfMock = vi.fn(async () => new Blob(["%PDF-1.3"], { type: "application/pdf" }));
vi.mock("@/lib/pdf/notdienstReportPdf", async (orig) => ({
  ...(await orig<typeof import("@/lib/pdf/notdienstReportPdf")>()),
  generateNotdienstReportPdf: (...a: unknown[]) => pdfMock(...(a as [])),
}));

const shareMock = vi.fn(async () => "shared" as const);
vi.mock("@/lib/share/shareFile", () => ({ shareOrDownload: (...a: unknown[]) => shareMock(...(a as [])) }));

// Signatur-Pad: jsdom hat kein Canvas → schlanker Stub mit der benutzten API
const padState = vi.hoisted(() => ({ empty: false }));
vi.mock("react-signature-canvas", () => {
  const Stub = React.forwardRef<unknown, { canvasProps?: Record<string, unknown> }>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      isEmpty: () => padState.empty,
      clear: () => {},
      getCanvas: () => ({ getContext: () => null, toDataURL: () => "data:image/png;base64,SIG" }),
    }));
    return <canvas aria-label={String(props.canvasProps?.["aria-label"] ?? "")} />;
  });
  Stub.displayName = "SignatureCanvasStub";
  return { default: Stub };
});

import { NotdienstBerichtPanel, type BerichtDaten } from "../NotdienstBerichtPanel";

const BERICHT: BerichtDaten = {
  date: "2026-09-27", start: "18:10", end: "19:40", duration: "1h 30m",
  kunde: "Frau Kraft", adresse: "Wiehbergstraße 3, 30519 Hannover",
  problem: "WC undicht", ergebnis: "Dichtung getauscht", note: "",
};

function renderPanel(id: string | null = "nd-1", bericht = BERICHT) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><NotdienstBerichtPanel notdienstId={id} bericht={bericht} /></QueryClientProvider>);
}

beforeEach(() => {
  h.rows = []; h.inserts = []; h.deletes = []; h.failSelect = false; h.nextId = 1;
  padState.empty = false;
  compressMock.mockClear(); pdfMock.mockClear(); shareMock.mockClear();
});

describe("NotdienstBerichtPanel", () => {
  it("ohne gespeicherten Einsatz: Hinweis statt Funktionen", () => {
    renderPanel(null);
    expect(screen.getByText(/Speichere den Notdienst zuerst/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /PDF-Bericht/ })).not.toBeInTheDocument();
  });

  it("Foto hinzufügen: komprimiert, speichert zum Einsatz, zeigt Vorschau; löschen entfernt es", async () => {
    renderPanel();
    const input = await screen.findByLabelText("Foto hinzufügen");
    fireEvent.change(input, { target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] } });

    expect(await screen.findByAltText("Foto 1")).toBeInTheDocument();
    expect(compressMock).toHaveBeenCalledTimes(1);
    expect(h.inserts[0]).toEqual({ notdienst_id: "nd-1", art: "foto", data: "data:image/jpeg;base64,FOTO" });

    fireEvent.click(screen.getByRole("button", { name: "Foto 1 löschen" }));
    await waitFor(() => expect(screen.queryByAltText("Foto 1")).not.toBeInTheDocument());
    expect(h.deletes[0]).toEqual([["id", "a1"]]);
  });

  it("maximal 6 Fotos: danach kein Hinzufügen mehr", async () => {
    h.rows = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, notdienst_id: "nd-1", art: "foto", data: "data:image/jpeg;base64,X", unterzeichner: null, created_at: "2026-09-27T10:00:00Z" }));
    renderPanel();
    expect(await screen.findByText("Maximal 6 Fotos.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Foto hinzufügen")).not.toBeInTheDocument();
  });

  it("Unterschrift: Name vorbelegt mit Kunde, leeres Feld wird abgelehnt, sonst ersetzt + gespeichert", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Kunde unterschreiben lassen/ }));
    expect((screen.getByLabelText("Name des Kunden") as HTMLInputElement).value).toBe("Frau Kraft");

    padState.empty = true;
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    expect(await screen.findByText(/Bitte zuerst unterschreiben/)).toBeInTheDocument();

    padState.empty = false;
    fireEvent.change(screen.getByLabelText("Name des Kunden"), { target: { value: "Erika Kraft" } });
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    expect(await screen.findByText(/Unterschrieben von Erika Kraft/)).toBeInTheDocument();
    // vorhandene Unterschrift wird zuerst entfernt (max. 1 pro Einsatz)
    expect(h.deletes[0]).toEqual([["notdienst_id", "nd-1"], ["art", "unterschrift"]]);
    expect(h.inserts.at(-1)).toEqual({ notdienst_id: "nd-1", art: "unterschrift", data: "data:image/png;base64,SIG", unterzeichner: "Erika Kraft" });
  });

  it("Bericht: erst erstellen (mit Fotos, Unterschrift, Firma, Techniker), dann sofort im Klick teilen", async () => {
    h.rows = [
      { id: "f1", notdienst_id: "nd-1", art: "foto", data: "data:image/jpeg;base64,F1", unterzeichner: null, created_at: "2026-09-27T10:00:00Z" },
      { id: "s1", notdienst_id: "nd-1", art: "unterschrift", data: "data:image/png;base64,S", unterzeichner: "Erika Kraft", created_at: "2026-09-27T17:45:00.000Z" },
    ];
    renderPanel();
    await screen.findByAltText("Foto 1");
    fireEvent.click(screen.getByRole("button", { name: /PDF-Bericht erstellen/ }));

    const shareBtn = await screen.findByRole("button", { name: /Bericht teilen/ });
    expect(pdfMock).toHaveBeenCalledWith(expect.objectContaining({
      kunde: "Frau Kraft", photos: ["data:image/jpeg;base64,F1"],
      signature: { data: "data:image/png;base64,S", name: "Erika Kraft", signedAt: "2026-09-27T17:45:00.000Z" },
      firma: expect.objectContaining({ name: "Meier GmbH", ort: "Hannover" }),
      techniker: { name: "Yusuf Bektas", signature: "data:image/png;base64,TECH" },
    }));
    expect(screen.getByText(/Notdienst-Bericht_2026-09-27_Frau-Kraft\.pdf/)).toBeInTheDocument();

    fireEvent.click(shareBtn);
    // synchron in der Klick-Geste — ohne waitFor (sonst würde der Browser das Teilen blockieren)
    expect(shareMock).toHaveBeenCalledTimes(1);
    const [file, opts] = shareMock.mock.calls[0] as unknown as [File, { title: string }];
    expect(file.name).toBe("Notdienst-Bericht_2026-09-27_Frau-Kraft.pdf");
    expect(file.type).toBe("application/pdf");
    expect(opts.title).toBe("Notdienst-Bericht 27.09.2026");
  });

  it("geänderte Formulardaten → alter Bericht verfällt, muss neu erstellt werden", async () => {
    const { rerender } = renderPanel();
    const create = await screen.findByRole("button", { name: /PDF-Bericht erstellen/ });
    await waitFor(() => expect(create).not.toBeDisabled()); // während Anhänge laden gesperrt
    fireEvent.click(create);
    await screen.findByRole("button", { name: /Bericht teilen/ });

    const qc = new QueryClient();
    rerender(<QueryClientProvider client={qc}><NotdienstBerichtPanel notdienstId="nd-1" bericht={{ ...BERICHT, ergebnis: "Neu" }} /></QueryClientProvider>);
    expect(await screen.findByRole("button", { name: /PDF-Bericht erstellen/ })).toBeInTheDocument();
  });

  it("Tabelle fehlt (Migration 029 noch nicht ausgeführt) → verständlicher Hinweis, Bericht geht trotzdem", async () => {
    h.failSelect = true;
    renderPanel();
    expect(await screen.findByText(/gerade nicht verfügbar/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Foto hinzufügen")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /PDF-Bericht erstellen/ }));
    expect(await screen.findByRole("button", { name: /Bericht teilen/ })).toBeInTheDocument();
  });
});
