"use client";

import { useEffect, useState } from "react";
import { getFailed, getOutbox, OUTBOX_EVENT, type FailedOp, type OutboxOp } from "@/lib/offline/outbox";

/** true = Browser hat Netz. Startet mit true (SSR), korrigiert sich nach dem Mount. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Aktueller Outbox-Inhalt (wartende + fehlgeschlagene Änderungen), live aktualisiert. */
export function useOutbox(): { pending: OutboxOp[]; failed: FailedOp[] } {
  const [state, setState] = useState<{ pending: OutboxOp[]; failed: FailedOp[] }>({ pending: [], failed: [] });
  useEffect(() => {
    const update = () => setState({ pending: getOutbox(), failed: getFailed() });
    update();
    window.addEventListener(OUTBOX_EVENT, update);
    window.addEventListener("storage", update); // andere Tabs
    return () => {
      window.removeEventListener(OUTBOX_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return state;
}
