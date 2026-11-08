import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Onboarding: Soll/Monat aus den Standardzeiten speichern.
 *  - Es gibt schon Lohn-Einstellungen → nur monthly_target_hours der neuesten Zeile ändern.
 *  - Noch keine → neue Zeile mit hourly_rate 0 (Stundenlohn noch nicht eingetragen →
 *    Dashboard zeigt kein geschätztes Brutto mit Platzhalter-Lohn, siehe hasHourlyRate).
 */
export async function saveSollFromOnboarding(
  supabase: SupabaseClient,
  userId: string,
  monthlyTargetHours: number,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<{ error: string | null }> {
  const { data: existing, error: readErr } = await supabase
    .from("salary_settings")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) return { error: readErr.message };

  const { error } = existing?.id
    ? await supabase.from("salary_settings")
        .update({ monthly_target_hours: monthlyTargetHours }).eq("id", existing.id)
    : await supabase.from("salary_settings")
        .insert({ user_id: userId, valid_from: today, monthly_target_hours: monthlyTargetHours, hourly_rate: 0 });
  return { error: error?.message ?? null };
}
