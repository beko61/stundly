import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin, type SupabaseClient } from "@supabase/supabase-js";

/** Eingeloggter Nutzer, wenn er Super-Admin ist (profiles.is_super_admin) — sonst null. */
export async function checkSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("user_id", user.id).single();
  if (profile?.is_super_admin !== true) return null;
  return user;
}

/** Service-Role-Client (umgeht RLS) — nur serverseitig nach checkSuperAdmin verwenden. */
export function adminClient(): SupabaseClient {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
