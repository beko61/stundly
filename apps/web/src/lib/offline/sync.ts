import { createClient } from "@/lib/supabase/client";
import { getBrowserQueryClient } from "@/providers/QueryProvider";
import { getOutbox, markFailed, removeOp, type OutboxOp } from "./outbox";
import { isNetworkError, isOffline } from "./network";

type Supa = ReturnType<typeof createClient>;

function exec(supabase: Supa, userId: string, op: OutboxOp) {
  switch (op.kind) {
    case "te_upsert":
      return supabase.from("time_entries").upsert({ ...op.row, user_id: userId }, { onConflict: "user_id,date" });
    case "te_delete":
      return supabase.from("time_entries").delete().eq("user_id", userId).eq("date", op.date);
    case "nd_upsert":
      // Neu: mit der offline vergebenen UUID anlegen (upsert → doppelter Sync ist harmlos)
      return op.isNew
        ? supabase.from("notdienst_entries").upsert({ ...op.row, id: op.id, user_id: userId })
        : supabase.from("notdienst_entries").update(op.row).eq("id", op.id);
    case "nd_delete":
      return supabase.from("notdienst_entries").delete().eq("id", op.id);
  }
}

let running: Promise<number> | null = null;

/**
 * Wartende Änderungen der Reihe nach senden. Netzwerkfehler → abbrechen (später erneut).
 * Serverfehler (z. B. Constraint) → Op in "fehlgeschlagen" verschieben, weiter mit der nächsten.
 * Gibt die Zahl übertragener Änderungen zurück.
 */
export function flushOutbox(): Promise<number> {
  if (running) return running;
  running = (async () => {
    if (isOffline() || getOutbox().length === 0) return 0;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return 0; // Token-Refresh noch nicht möglich / ausgeloggt → später

    let synced = 0;
    for (const op of getOutbox(userId)) {
      try {
        const { error } = await exec(supabase, userId, op);
        if (error) {
          if (isNetworkError(error)) break;
          markFailed(op, error.message);
          continue;
        }
        removeOp(op);
        synced++;
      } catch (e) {
        if (isNetworkError(e)) break;
        markFailed(op, e instanceof Error ? e.message : String(e));
      }
    }

    if (synced > 0) {
      const qc = getBrowserQueryClient();
      void qc?.invalidateQueries({ queryKey: ["time_entries", userId] });
      void qc?.invalidateQueries({ queryKey: ["time_entries_range", userId] });
      void qc?.invalidateQueries({ queryKey: ["notdienst_entries", userId] });
    }
    return synced;
  })().finally(() => { running = null; });
  return running;
}
