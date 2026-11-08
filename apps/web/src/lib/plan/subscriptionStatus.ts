/**
 * Laufende Abos des eingeloggten Nutzers (RPC my_subscription_status, Migration 038).
 * Mitarbeiter dürfen das Firmen-Abo selbst nicht lesen (RLS) — die RPC sagt nur "läuft / läuft nicht".
 * undefined = RPC fehlt (Migration noch nicht eingespielt) → resolveTier nutzt das alte Verhalten.
 */
export async function fetchSubscriptionStatus(
  supabase: { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> },
): Promise<{ company: boolean; personal: boolean } | undefined> {
  const { data, error } = await supabase.rpc("my_subscription_status");
  if (error || data == null) return undefined;
  const row = (Array.isArray(data) ? data[0] : data) as { company_active?: boolean; personal_active?: boolean } | undefined;
  if (!row) return undefined;
  return { company: !!row.company_active, personal: !!row.personal_active };
}
