import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Company-admin yetkili erişim — server-only.
 *
 * 1. Mevcut user'ın oturumu ve role'ü doğrulanır.
 * 2. company_id çekilir.
 * 3. company_admin değilse null döner.
 * 4. Hat hâlâ admin değil ama super_admin de olabilir — ikisini de geçer.
 *
 * Sonrasında dönen `admin` client service-role ile RLS bypass eder —
 * yani team time_entries, vacation_requests vs. tablolarına erişebilir.
 * Bu güvenli çünkü `companyId` zaten doğrulanmış olur ve sorgular
 * `.eq("company_id", companyId)` veya in-clause ile sınırlandırılır.
 */
export async function getCompanyAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, full_name")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "company_admin" && profile.role !== "super_admin")) {
    return null;
  }
  if (!profile.company_id) return null;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return {
    user,
    profile,
    companyId: profile.company_id as string,
    admin,
  };
}

/**
 * Tek bir time_entry için net çalışma dakikalarını hesaplar.
 * Gece vardiyası için (end < start) ertesi gün varsayar.
 * Urlaub/Krank/Feiertag (PAID_ABSENCE) = 8h flat (Mo-Fr), Sa/So = 0.
 */
export function netMinutesForEntry(entry: {
  date:           string;
  start_time:     string | null;
  end_time:       string | null;
  break_minutes:  number | null;
  day_type:       string | null;
}): number {
  const dt = entry.day_type ?? "arbeiten";

  // Bezahlte Abwesenheit: Mo-Fr = 8h, Wochenende = 0
  if (dt === "urlaub" || dt === "krank" || dt === "feiertag") {
    const dow = new Date(entry.date).getDay();
    return (dow === 0 || dow === 6) ? 0 : 8 * 60;
  }

  if (!entry.start_time || !entry.end_time) return 0;

  const [sh = 0, sm = 0] = entry.start_time.split(":").map(Number);
  const [eh = 0, em = 0] = entry.end_time.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // gece vardiyası
  return Math.max(0, mins - (entry.break_minutes ?? 0));
}

/** "165h 30min" formatı (saat ondalıklı yerine "Xh Ymin"). */
export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
