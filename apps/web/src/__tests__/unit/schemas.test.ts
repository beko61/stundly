import { describe, it, expect } from "vitest";
import {
  createEmployeeSchema,
  employeeIdSchema,
  vacationDecisionSchema,
} from "@/lib/validation/schemas";

describe("createEmployeeSchema", () => {
  const valid = {
    email:     "test@example.com",
    password:  "supersecret",
    full_name: "Ali Yildiz",
    role:      "employee" as const,
  };

  it("Valid input geçer", () => {
    const r = createEmployeeSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("test@example.com");
      expect(r.data.full_name).toBe("Ali Yildiz");
    }
  });

  it("Email trim + lowercase", () => {
    const r = createEmployeeSchema.safeParse({ ...valid, email: "  TEST@Example.COM  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("test@example.com");
  });

  it("Full name trim", () => {
    const r = createEmployeeSchema.safeParse({ ...valid, full_name: "  Ali Yildiz  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.full_name).toBe("Ali Yildiz");
  });

  it("Geçersiz email", () => {
    const r = createEmployeeSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.email).toBeTruthy();
  });

  it("Password çok kısa", () => {
    const r = createEmployeeSchema.safeParse({ ...valid, password: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.password).toBeTruthy();
  });

  it("Full name çok kısa", () => {
    const r = createEmployeeSchema.safeParse({ ...valid, full_name: "A" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.full_name).toBeTruthy();
  });

  it("Role sadece employee/company_admin", () => {
    const r = createEmployeeSchema.safeParse({ ...valid, role: "super_admin" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.role).toBeTruthy();
  });

  it("Boş body → tüm alanlar hata", () => {
    const r = createEmployeeSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = r.error.flatten().fieldErrors;
      expect(errs.email).toBeTruthy();
      expect(errs.password).toBeTruthy();
      expect(errs.full_name).toBeTruthy();
      expect(errs.role).toBeTruthy();
    }
  });
});

describe("employeeIdSchema", () => {
  it("Valid UUID geçer", () => {
    const r = employeeIdSchema.safeParse({ userId: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.success).toBe(true);
  });

  it("Geçersiz UUID reddedilir", () => {
    const r = employeeIdSchema.safeParse({ userId: "not-a-uuid" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.userId).toBeTruthy();
  });

  it("userId eksik → hata", () => {
    const r = employeeIdSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("userId null → hata", () => {
    const r = employeeIdSchema.safeParse({ userId: null });
    expect(r.success).toBe(false);
  });

  it("userId number → hata", () => {
    const r = employeeIdSchema.safeParse({ userId: 123 });
    expect(r.success).toBe(false);
  });
});

describe("vacationDecisionSchema", () => {
  it("approved geçer", () => {
    const r = vacationDecisionSchema.safeParse({ decision: "approved" });
    expect(r.success).toBe(true);
  });

  it("rejected + reason geçer", () => {
    const r = vacationDecisionSchema.safeParse({
      decision: "rejected",
      reason:   "Aynı hafta 3 kişi izinli, dringend Personal",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reason).toContain("dringend");
  });

  it("Reason optional", () => {
    const r = vacationDecisionSchema.safeParse({ decision: "approved" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reason).toBeUndefined();
  });

  it("Reason > 1000 karakter → hata", () => {
    const r = vacationDecisionSchema.safeParse({
      decision: "rejected",
      reason:   "x".repeat(1001),
    });
    expect(r.success).toBe(false);
  });

  it("Reason trim edilir", () => {
    const r = vacationDecisionSchema.safeParse({
      decision: "rejected",
      reason:   "  ok  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reason).toBe("ok");
  });

  it("Diğer decision değerleri reddedilir", () => {
    for (const bad of ["pending", "cancelled", "waiting", "yes", "no", ""]) {
      const r = vacationDecisionSchema.safeParse({ decision: bad });
      expect(r.success).toBe(false);
    }
  });

  it("Boş body → hata", () => {
    const r = vacationDecisionSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});
