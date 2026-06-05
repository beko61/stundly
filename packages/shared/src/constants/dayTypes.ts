export const DAY_TYPES = {
  ARBEITEN:  "arbeiten",
  URLAUB:    "urlaub",
  KRANK:     "krank",
  NOTDIENST: "notdienst",
  FEIERTAG:  "feiertag",
  FREI:      "frei",
} as const;

export type DayType = (typeof DAY_TYPES)[keyof typeof DAY_TYPES];

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  arbeiten:  "Arbeiten",
  urlaub:    "Urlaub",
  krank:     "Krank",
  notdienst: "Notdienst",
  feiertag:  "Feiertag",
  frei:      "Frei",
};

export const DAY_TYPE_COLORS: Record<DayType, string> = {
  arbeiten:  "var(--green)",
  urlaub:    "var(--blue)",
  krank:     "var(--red)",
  notdienst: "var(--orange)",
  feiertag:  "var(--yellow)",
  frei:      "var(--muted)",
};
