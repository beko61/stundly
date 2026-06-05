import { create } from "zustand";
import type { TimeEntry } from "@workly/shared";

interface TrackerState {
  entries: TimeEntry[];
  year: number;
  month: number; // 1-based
  loading: boolean;
  ndVersion: number; // incremented whenever notdienst_entries change
  setEntries: (entries: TimeEntry[]) => void;
  addEntry: (entry: TimeEntry) => void;
  updateEntry: (entry: TimeEntry) => void;
  deleteEntry: (id: string) => void;
  setMonth: (year: number, month: number) => void;
  setLoading: (loading: boolean) => void;
  incrementNdVersion: () => void;
}

const now = new Date();

export const useTrackerStore = create<TrackerState>((set) => ({
  entries:    [],
  year:       now.getFullYear(),
  month:      now.getMonth() + 1,
  loading:    false,
  ndVersion:  0,

  setEntries: (entries) => set({ entries }),

  addEntry: (entry) =>
    set((state) => ({ entries: [...state.entries, entry].sort((a, b) => a.date.localeCompare(b.date)) })),

  updateEntry: (entry) =>
    set((state) => ({
      entries: state.entries.map((e) => (e.id === entry.id ? entry : e)),
    })),

  deleteEntry: (id) =>
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

  setMonth: (year, month) => set({ year, month, entries: [] }),

  setLoading: (loading) => set({ loading }),

  incrementNdVersion: () => set((state) => ({ ndVersion: state.ndVersion + 1 })),
}));
