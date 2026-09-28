import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CompaniesTable, { type CompanyRow } from "../CompaniesTable";

const row = (over: Partial<CompanyRow> = {}): CompanyRow => ({
  id: "c1", name: "Muster GmbH", city: "Hannover", country: "DE", vatId: null, maxEmployees: 10,
  createdAt: "2026-06-01T00:00:00Z", plan: "trial", status: "trialing", paidStripe: false,
  ownerEmail: "chef@x.de", memberCount: 2, superAdminMembers: 0, ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("CompaniesTable", () => {
  it("Löschen erst nach exakter Namenseingabe; Erfolg entfernt Zeile", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, deleted_users: 2, detached_users: 0 }), { status: 200 }),
    );
    render(<CompaniesTable initialRows={[row(), row({ id: "c2", name: "Andere AG", ownerEmail: null })]} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Sil" })[0]!);
    const confirmBtn = screen.getByRole("button", { name: "Firmayı sil" });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/firma adını yaz/), { target: { value: "muster gmbh" } });
    fireEvent.click(screen.getByLabelText(/Çalışan hesaplarını da sil/));
    const btn = screen.getByRole("button", { name: "Firmayı ve hesapları sil" });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/"Muster GmbH" silindi · 2 hesap silindi/));
    expect(fetchSpy.mock.calls[0]![0]).toBe("/api/superadmin/companies/c1?confirm=muster%20gmbh&users=1");
    expect(screen.queryByText("Muster GmbH")).toBeNull();
    expect(screen.getByText("Andere AG")).toBeInTheDocument();
  });

  it("aktives Stripe-Abo → nur Hinweis, kein Löschen-Button", () => {
    render(<CompaniesTable initialRows={[row({ paidStripe: true })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(screen.getByText(/aktif, ücretli bir Stripe aboneliği/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Firmayı sil/ })).toBeNull();
  });

  it("Suche filtert nach Name und Sahip-E-Mail", () => {
    render(<CompaniesTable initialRows={[row(), row({ id: "c2", name: "Andere AG", ownerEmail: "x@andere.de" })]} />);
    fireEvent.change(screen.getByPlaceholderText(/Firma, sahip/), { target: { value: "andere.de" } });
    expect(screen.queryByText("Muster GmbH")).toBeNull();
    expect(screen.getByText("Andere AG")).toBeInTheDocument();
  });
});
