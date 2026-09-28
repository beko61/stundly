"use client";

import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryCache, restoreQueryCache } from "@/lib/offline/cachePersist";

/**
 * React Query QueryClient wrapper — root layout için client-side provider.
 *
 * Default konfig:
 * - staleTime: 60s — component remount'ta hızlı re-fetch atmaz
 * - gcTime:    24 saat — offline için: ziyaret edilen aylar localStorage'a yazılır
 *   (lib/offline/cachePersist) ve uygulama internetsiz açılınca oradan gelir
 * - refetchOnWindowFocus: false — kullanıcı Stundly'e döndüğünde otomatik
 *   fetch tetiklemez (Zeiterfassung nadiren dış kaynaktan değişir)
 * - retry: 1 — flaky network için tek retry, üzerinde daha fazla değil
 *
 * SSR safe pattern (Next.js App Router):
 * - Server: her request için yeni QueryClient (cache paylaşımı önle)
 * - Browser: singleton (hydration sonrası yeni client yaratma)
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime:    24 * 60 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
        // "always": mutationFn läuft auch offline — die Mutationen legen Änderungen
        // dann selbst in die Offline-Outbox (sonst würde RQ sie still pausieren).
        networkMode: "always",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: her call yeni client (SSR safe, cross-request cache leak yok)
    return makeQueryClient();
  }
  // Browser: singleton — React tree yeniden mount'a tekrar client yaratma
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
    restoreQueryCache(browserQueryClient);
    persistQueryCache(browserQueryClient);
  }
  return browserQueryClient;
}

/** Browser-Singleton für Code außerhalb von React (Offline-Outbox, optimistische Updates). */
export function getBrowserQueryClient(): QueryClient | undefined {
  return typeof window === "undefined" ? undefined : getQueryClient();
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
