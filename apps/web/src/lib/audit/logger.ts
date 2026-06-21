import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Audit log helper — DSGVO + GoBD denetlenebilirlik.
 *
 * Service-role client gerektirir (RLS bypass). Genelde `getCompanyAdminContext()`
 * sonucu olan `admin` client'ı pas edilir.
 *
 * Fire-and-forget: log başarısız olsa bile ana işlem geçerli kalır.
 * Çağıran route DB insert hatalarını yakalamak zorunda değil.
 *
 * Eylem isimlendirme (snake_case enum string):
 *   resource.action  →  vacation.approved, vacation.rejected,
 *                       employee.activated, employee.deactivated,
 *                       employee.soft_deleted, employee.restored,
 *                       subscription.created, subscription.cancelled
 */

export interface AuditLogInput {
  /** Service-role veya yetkili supabase client. */
  admin: SupabaseClient;
  /** Eylemi yapan kullanıcı (genelde session user.id). */
  actorUserId: string;
  /** Eylemin ait olduğu şirket. Cross-company audit yok. */
  companyId: string;
  /** snake_case eylem string'i (örn "vacation.approved"). */
  action: string;
  /** Etkilenen kaynağın tipi (örn "vacation_request", "profile"). */
  resourceType?: string;
  /** Etkilenen kayıt id'si (uuid). */
  resourceId?: string;
  /** Eyleme özgü ekstra meta (kısa, < 4 KB tutmaya çalış). */
  payload?: Record<string, unknown>;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const row = {
      actor_user_id: input.actorUserId,
      company_id:    input.companyId,
      action:        input.action,
      resource_type: input.resourceType ?? null,
      resource_id:   input.resourceId   ?? null,
      payload:       input.payload      ?? {},
    };
    const { error } = await input.admin.from("audit_log").insert(row);
    if (error) {
      // Konsola yaz ama ana işlemi durdurma.
      console.error("[audit] insert failed:", error.message, "action:", input.action);
    }
  } catch (err) {
    console.error("[audit] unexpected error:", err);
  }
}
