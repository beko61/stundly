import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSampleData } from "@/lib/onboarding/sampleData";

/**
 * POST /api/onboarding/sample-data
 *
 * Yeni user için sample time_entries + notdienst_entries insert eder.
 * Tag `sample` ile işaretlenir, sonra tek tıkla silinebilir.
 *
 * Idempotent: mevcut sample kayıtlar önce silinir (kullanıcı yeniden yükleyebilir).
 * Ay: mevcut ay (dashboard/tracker default açılır).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const { entries, notdienst } = generateSampleData(year, month);

  // Eski sample entry'leri temizle (idempotent)
  await supabase.from("time_entries")
    .delete()
    .eq("user_id", user.id)
    .contains("tags", ["sample"]);

  // Insert time_entries
  const timeRows = entries.map((e) => ({ user_id: user.id, ...e }));
  const { error: teErr, count: teCount } = await supabase
    .from("time_entries")
    .insert(timeRows, { count: "exact" });
  if (teErr) {
    return NextResponse.json({ error: teErr.message }, { status: 500 });
  }

  // Insert notdienst_entries (bu tabloda `tags` yok, note'ta "Beispieldatensatz" ile işaretli)
  let ndCount = 0;
  if (notdienst.length > 0) {
    const ndRows = notdienst.map((n) => ({ user_id: user.id, ...n }));
    const { error: ndErr, count } = await supabase
      .from("notdienst_entries")
      .insert(ndRows, { count: "exact" });
    if (!ndErr) ndCount = count ?? notdienst.length;
  }

  return NextResponse.json({
    inserted_time_entries: teCount ?? entries.length,
    inserted_notdienst:    ndCount,
    year, month,
  });
}

/**
 * DELETE /api/onboarding/sample-data
 *
 * Tag `sample` ile işaretli time_entries'i + note'unda "Beispieldatensatz"
 * geçen notdienst_entries'i siler.
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ error: teErr, count: teCount }, { error: ndErr, count: ndCount }] = await Promise.all([
    supabase.from("time_entries")
      .delete({ count: "exact" })
      .eq("user_id", user.id)
      .contains("tags", ["sample"]),
    supabase.from("notdienst_entries")
      .delete({ count: "exact" })
      .eq("user_id", user.id)
      .like("note", "%Beispieldatensatz%"),
  ]);

  if (teErr) return NextResponse.json({ error: teErr.message }, { status: 500 });
  if (ndErr) console.error("[sample-data DELETE] notdienst error:", ndErr);

  return NextResponse.json({
    deleted_time_entries: teCount ?? 0,
    deleted_notdienst:    ndCount ?? 0,
  });
}

/**
 * GET /api/onboarding/sample-data
 *
 * Aktif sample entry sayısını döner (banner göstermek için).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .contains("tags", ["sample"]);

  return NextResponse.json({ sample_count: count ?? 0 });
}
