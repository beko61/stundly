import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit/check";

// DSGVO export — expensive multi-table query. DoS önleme: günde 5 attempt.
const EXPORT_LIMIT_PER_DAY = 5;
const EXPORT_WINDOW_SEC    = 86400;

// DSGVO Art. 15 / 20 — Auskunft & Datenübertragbarkeit
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit({
    bucket:    `dsgvo_export:${user.id}`,
    limit:     EXPORT_LIMIT_PER_DAY,
    windowSec: EXPORT_WINDOW_SEC,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Export-Anfragen. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Alle personenbezogenen Tabellen des Users — inkl. Notdienst (Kunde/Adresse) und
  // Lohnaufzeichnungen, die hier früher fehlten.
  const [profile, timeEntries, notdienst, anhaenge, salarySettings, salaryRecords, vacations, deletionRequests] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", user.id).single(),
    admin.from("time_entries").select("*").eq("user_id", user.id).order("date"),
    admin.from("notdienst_entries").select("*").eq("user_id", user.id).order("date"),
    admin.from("notdienst_anhaenge").select("*").eq("user_id", user.id),
    admin.from("salary_settings").select("*").eq("user_id", user.id),
    admin.from("salary_records").select("*").eq("user_id", user.id),
    admin.from("vacation_requests").select("*").eq("user_id", user.id),
    admin.from("deletion_requests").select("*").eq("user_id", user.id),
  ]);

  const exportData = {
    export_date: new Date().toISOString(),
    user_id: user.id,
    email: user.email,
    profile: profile.data,
    time_entries: timeEntries.data ?? [],
    notdienst_entries: notdienst.data ?? [],
    notdienst_anhaenge: anhaenge.data ?? [],   // Fotos + Kundenunterschriften (Data-URLs)
    salary_settings: salarySettings.data ?? [],
    salary_records: salaryRecords.data ?? [],
    vacation_requests: vacations.data ?? [],
    deletion_requests: deletionRequests.data ?? [],
  };

  // Audit log
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "data_export",
    resource: "all_user_data",
  });

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="stundly-daten-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
