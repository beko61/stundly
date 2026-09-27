import { create } from "zustand";

/**
 * Tracker UI state — pure client state.
 *
 * Server data (time_entries) React Query yönetir (hooks/queries/useTimeEntries).
 * Bu store sadece:
 *   - year / month — aktif ay seçimi (aylar arası nav)
 *
 * Notdienst-Refresh läuft über React Query (invalidateQueries ["notdienst_entries"]),
 * der frühere ndVersion-Zähler ist entfallen (v0.59.3).
 *
 * v0.48.0 öncesi: entries + loading da burada tutuluyordu (server state
 * mirror'ı). React Query'e taşındıkça bu alanlar kaldırıldı — tek doğruluk
 * kaynağı için (Zustand + RQ paralel state riskini önlemek için).
 */
interface TrackerState {
  year: number;
  month: number; // 1-based
  setMonth: (year: number, month: number) => void;
}

const now = new Date();

export const useTrackerStore = create<TrackerState>((set) => ({
  year:      now.getFullYear(),
  month:     now.getMonth() + 1,
  setMonth:  (year, month) => set({ year, month }),
}));
