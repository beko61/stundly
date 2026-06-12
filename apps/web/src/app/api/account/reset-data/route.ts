import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

/**
 * Kullanıcının tüm zaman/giriş verilerini siler — ama hesabı, profil bilgilerini
 * ve Lohn-Einstellungen'i korur. Yanlış import / test sonrası temizlik için.
 *
 * Siler:
 *   time_entries · notdienst_entries · vacation_requests · salary_records
 *
 * Saklar:
 *   profiles · salary_settings · auth.users · audit_logs
 *
 * Onay: client tarafında modal + "LÖSCHEN" yazma + body.confirm === "LÖSCHEN".
 * Audit-log'a yazılır (DSGVO + güvenlik için iz bırakır).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Onay metni kontrolü — yanlış POST koruması
  let confirm: string | undefined;
  try {
    const body = await req.json() as { confirm?: string };
    confirm = body.confirm;
  } catch {
    return NextResponse.json({ error: "Body fehlt" }, { status: 400 });
  }
  if (confirm !== "LÖSCHEN") {
    return NextResponse.json(
      { error: "Bestätigung fehlt. Tippe LÖSCHEN ein, um fortzufahren." },
      { status: 400 }
    );
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tables = [
    "time_entries",
    "notdienst_entries",
    "vacation_requests",
    "salary_records",
  ] as const;

  const counts: Record<string, number> = {};
  for (const t of tables) {
    // Önce say ki kullanıcıya raporlayabilelim
    const { count } = await admin
      .from(t).select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    counts[t] = count ?? 0;

    const { error } = await admin.from(t).delete().eq("user_id", user.id);
    if (error) {
      return NextResponse.json(
        { error: `Fehler beim Löschen aus ${t}: ${error.message}`, counts },
        { status: 500 }
      );
    }
  }

  // Audit log (DSGVO + sorumluluğu izle)
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "data_reset",
    resource: "user_time_data",
  });

  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  return NextResponse.json({ success: true, deleted: counts, total });
}
