/**
 * Super-Admin "Beta-Kokpit" — reine Kennzahlen aus zusammengeführten Nutzerzeilen.
 * Datenbeschaffung: lib/superadmin/data.ts
 */

export interface SaUser {
  id:              string;
  email:           string | null;
  name:            string | null;
  role:            string;
  isActive:        boolean;
  companyId:       string | null;
  companyName:     string | null;
  createdAt:       string;
  lastSignInAt:    string | null;
  emailConfirmed:  boolean;
  lastDataAt:      string | null;   // letzte eigene Eintragung (ohne Beispieldaten)
  entryDays:       number;
  ndCount:         number;
  source:          string | null;   // "Wie hast du von Stundly erfahren?"
  referredBy:      string | null;   // Empfehlungscode
  reminderLastType:   string | null;
  reminderLastSentAt: string | null;
  pendingDeletion: boolean;
}

export type Segment = "all" | "active7" | "never" | "inactive" | "unconfirmed" | "deletion";

const DAY = 86_400_000;
const ts = (v: string | null) => (v ? new Date(v).getTime() : 0);

export function lastActivity(u: SaUser): number {
  return Math.max(ts(u.lastDataAt), ts(u.lastSignInAt));
}

export function hasData(u: SaUser): boolean {
  return u.entryDays + u.ndCount > 0;
}

export function inSegment(u: SaUser, seg: Segment, now: number): boolean {
  switch (seg) {
    case "all":         return true;
    case "active7":     return now - lastActivity(u) <= 7 * DAY && lastActivity(u) > 0;
    case "never":       return !hasData(u);
    case "inactive":    return hasData(u) && now - lastActivity(u) > 14 * DAY;
    case "unconfirmed": return !u.emailConfirmed;
    case "deletion":    return u.pendingDeletion;
  }
}

export const SOURCE_LABELS: Record<string, string> = {
  kollege: "Meslektaş / arkadaş", bericht: "Notdienst raporu / PDF", google: "Google",
  instagram: "Instagram / TikTok", facebook: "Facebook", youtube: "YouTube",
  firma: "İşvereni üzerinden", andere: "Diğer",
};

export interface Cockpit {
  total:          number;
  signupsToday:   number;
  signups7:       number;
  signups30:      number;
  active7:        number;
  active30:       number;
  activated:      number;
  activationRate: number;          // 0–100
  neverUsed:      number;          // ≥ 2 Tage registriert, nie etwas eingetragen
  inactive14:     number;
  unconfirmed:    number;
  pendingDeletion: number;
  daily:          { date: string; signups: number; active: number }[]; // letzte 30 Tage
  sources:        { key: string; label: string; count: number }[];
  topReferrers:   { code: string; name: string; count: number }[];
  reminders7:     Record<string, number>;
}

const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Super-Admins zählen nicht als Kunden. */
export function computeCockpit(all: SaUser[], now: Date): Cockpit {
  const n = now.getTime();
  const users = all.filter((u) => u.role !== "super_admin");
  const created = (u: SaUser) => ts(u.createdAt);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const activated = users.filter(hasData).length;

  const daily: Cockpit["daily"] = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = startToday - i * DAY;
    const dayEnd = dayStart + DAY;
    daily.push({
      date: isoDay(dayStart),
      signups: users.filter((u) => created(u) >= dayStart && created(u) < dayEnd).length,
      active: users.filter((u) => {
        const a = ts(u.lastDataAt);
        return a >= dayStart && a < dayEnd;
      }).length,
    });
  }

  const srcCount = new Map<string, number>();
  for (const u of users) {
    const k = u.source && SOURCE_LABELS[u.source] ? u.source : "none";
    srcCount.set(k, (srcCount.get(k) ?? 0) + 1);
  }
  const sources = [...srcCount.entries()]
    .map(([key, count]) => ({ key, label: key === "none" ? "Belirtilmemiş" : SOURCE_LABELS[key]!, count }))
    .sort((a, b) => b.count - a.count);

  const byCode = new Map(all.map((u) => [u.id.replace(/-/g, "").slice(0, 8).toLowerCase(), u]));
  const refCount = new Map<string, number>();
  for (const u of users) if (u.referredBy) refCount.set(u.referredBy, (refCount.get(u.referredBy) ?? 0) + 1);
  const topReferrers = [...refCount.entries()]
    .map(([code, count]) => {
      const r = byCode.get(code);
      return { code, name: r?.name || r?.email || code, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const reminders7: Record<string, number> = {};
  for (const u of users) {
    if (u.reminderLastType && n - ts(u.reminderLastSentAt) <= 7 * DAY) {
      reminders7[u.reminderLastType] = (reminders7[u.reminderLastType] ?? 0) + 1;
    }
  }

  return {
    total:          users.length,
    signupsToday:   users.filter((u) => created(u) >= startToday).length,
    signups7:       users.filter((u) => n - created(u) <= 7 * DAY).length,
    signups30:      users.filter((u) => n - created(u) <= 30 * DAY).length,
    active7:        users.filter((u) => inSegment(u, "active7", n)).length,
    active30:       users.filter((u) => lastActivity(u) > 0 && n - lastActivity(u) <= 30 * DAY).length,
    activated,
    activationRate: users.length ? Math.round((activated / users.length) * 100) : 0,
    neverUsed:      users.filter((u) => !hasData(u) && n - created(u) >= 2 * DAY).length,
    inactive14:     users.filter((u) => inSegment(u, "inactive", n)).length,
    unconfirmed:    users.filter((u) => !u.emailConfirmed).length,
    pendingDeletion: users.filter((u) => u.pendingDeletion).length,
    daily,
    sources,
    topReferrers,
    reminders7,
  };
}
