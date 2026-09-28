import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import UsersTable, { ago } from "../UsersTable";
import type { SaUser } from "@/lib/superadmin/metrics";

const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

const u = (over: Partial<SaUser>): SaUser => ({
  id: "id", email: "x@x.de", name: "X", role: "individual", isActive: true, companyId: null, companyName: null,
  createdAt: iso(30), lastSignInAt: null, emailConfirmed: true, lastDataAt: null, entryDays: 0, ndCount: 0,
  source: null, referredBy: null, reminderLastType: null, reminderLastSentAt: null, pendingDeletion: false, ...over,
});

const USERS = [
  u({ id: "a", name: "Anna Aktiv", email: "anna@x.de", lastDataAt: iso(1), entryDays: 20, source: "google" }),
  u({ id: "b", name: "Bernd Nie", email: "bernd@x.de", emailConfirmed: false }),
  u({ id: "c", name: "Cem Pause", email: "cem@firma.de", lastDataAt: iso(40), entryDays: 50, companyName: "Muster GmbH", role: "employee" }),
];

afterEach(() => { vi.restoreAllMocks(); });

describe("ago", () => {
  it("relative Zeit auf Türkisch", () => {
    const now = Date.now();
    expect(ago(null)).toBe("hiç");
    expect(ago(now, now)).toBe("bugün");
    expect(ago(now - DAY, now)).toBe("dün");
    expect(ago(now - 5 * DAY, now)).toBe("5 gün önce");
    expect(ago(now - 70 * DAY, now)).toBe("2 ay önce");
  });
});

describe("UsersTable", () => {
  it("Segmente zählen und filtern; Startsegment aus URL", () => {
    render(<UsersTable initialUsers={USERS} initialSegment="never" />);
    expect(screen.getByRole("button", { name: /Hiç kullanmamış 1/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Bernd Nie")).toBeInTheDocument();
    expect(screen.queryByText("Anna Aktiv")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Pasif 14\+ gün 1/ }));
    expect(screen.getByText("Cem Pause")).toBeInTheDocument();
    expect(screen.queryByText("Bernd Nie")).toBeNull();
  });

  it("Suche nach Firma", () => {
    render(<UsersTable initialUsers={USERS} />);
    fireEvent.change(screen.getByLabelText("Ara"), { target: { value: "muster" } });
    expect(screen.getByText("Cem Pause")).toBeInTheDocument();
    expect(screen.queryByText("Anna Aktiv")).toBeNull();
  });

  it("Detail-Drawer: Infos + Passwort-Reset ruft API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<UsersTable initialUsers={USERS} />);
    fireEvent.click(screen.getByText("Anna Aktiv"));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("20 gün · 0 Notdienst")).toBeInTheDocument();
    expect(within(drawer).getByText("Google")).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: /Şifre sıfırlama maili/ }));
    await waitFor(() => expect(within(drawer).getByRole("status").textContent).toMatch(/gönderildi/));
    expect(fetchSpy).toHaveBeenCalledWith("/api/superadmin/users/a", expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "reset_password" }) }));
  });

  it("Löschen erst nach Eingabe der E-Mail, danach Zeile weg", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<UsersTable initialUsers={USERS} />);
    fireEvent.click(screen.getByText("Bernd Nie"));
    const drawer = screen.getByRole("dialog");
    fireEvent.click(within(drawer).getByRole("button", { name: /Kullanıcıyı sil/ }));
    const del = within(drawer).getByRole("button", { name: "Kalıcı olarak sil" });
    expect(del).toBeDisabled();
    fireEvent.change(within(drawer).getByLabelText("E-posta onayı"), { target: { value: "BERND@x.de" } });
    fireEvent.click(del);
    await waitFor(() => expect(screen.queryByText("Bernd Nie")).toBeNull());
    expect(fetchSpy.mock.calls[0]![0]).toBe("/api/superadmin/users/b?confirm=bernd%40x.de");
  });
});
