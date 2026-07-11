/**
 * Zod input validation — admin write endpoint schemas.
 *
 * Kullanım:
 *   const parsed = createEmployeeSchema.safeParse(body);
 *   if (!parsed.success) return NextResponse.json({
 *     error: "Ungültige Eingabe",
 *     details: parsed.error.flatten().fieldErrors,
 *   }, { status: 400 });
 *   const { email, password, full_name, role } = parsed.data;
 *
 * Neden Zod?
 *  - Runtime type safety (TypeScript compile-time yeterli değil)
 *  - Error mesajları DE-lokalize
 *  - Field-level validation → API cevabı frontend'de gösterilebilir
 *  - Prompt injection / SQL injection için ilk katman
 */

import { z } from "zod";

const emailSchema = z
  .string({ required_error: "E-Mail fehlt" })
  .trim()
  .toLowerCase()
  .email({ message: "Ungültige E-Mail-Adresse" })
  .max(320, { message: "E-Mail zu lang (max. 320 Zeichen)" });

const nonEmptyName = z
  .string({ required_error: "Name fehlt" })
  .trim()
  .min(2, { message: "Name muss mindestens 2 Zeichen haben" })
  .max(200, { message: "Name zu lang (max. 200 Zeichen)" });

const uuidSchema = z
  .string({ required_error: "userId fehlt" })
  .uuid({ message: "Ungültige userId (kein UUID)" });

// ─────────────────────────────────────────────────────────────
// Employee Create
// ─────────────────────────────────────────────────────────────
export const createEmployeeSchema = z.object({
  email:     emailSchema,
  password:  z
    .string({ required_error: "Passwort fehlt" })
    .min(8, { message: "Passwort muss mindestens 8 Zeichen haben" })
    .max(200, { message: "Passwort zu lang" }),
  full_name: nonEmptyName,
  role:      z.enum(["employee", "company_admin"], {
    errorMap: () => ({ message: "Role muss 'employee' oder 'company_admin' sein" }),
  }),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// ─────────────────────────────────────────────────────────────
// Employee ID-only actions (delete / restore / toggle)
// ─────────────────────────────────────────────────────────────
export const employeeIdSchema = z.object({
  userId: uuidSchema,
});

export type EmployeeIdInput = z.infer<typeof employeeIdSchema>;

// ─────────────────────────────────────────────────────────────
// Vacation Decision
// ─────────────────────────────────────────────────────────────
export const vacationDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "decision muss 'approved' oder 'rejected' sein" }),
  }),
  reason:   z.string().trim().max(1000, { message: "Grund zu lang (max. 1000 Zeichen)" }).optional(),
});

export type VacationDecisionInput = z.infer<typeof vacationDecisionSchema>;
