"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * React Query QueryClient wrapper — root layout için client-side provider.
 *
 * Default konfig:
 * - staleTime: 60s — component remount'ta hızlı re-fetch atmaz
 * - gcTime:    5 dk — unused query cache 5 dakika hafızada kalır
 * - refetchOnWindowFocus: false — kullanıcı Stundly'e döndüğünde otomatik
 *   fetch tetiklemez (Zeiterfassung nadiren dış kaynaktan değişir)
 * - retry: 1 — flaky network için tek retry, üzerinde daha fazla değil
 *
 * useState ile client instance — SSR/hydration'da yeni instance yaratıp
 * cache paylaşmayı önler (Next.js App Router pattern).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime:    5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
