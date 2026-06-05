"use client";

import { useMemo, useEffect, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { MonthNav } from "@/components/tracker/MonthNav";
import { MonthlySummary } from "@/components/tracker/MonthlySummary";
import { DayEntry } from "@/components/tracker/DayEntry";
import { PhotoScanModal } from "@/components/tracker/PhotoScanModal";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { getFeiertage } from "@/lib/utils/feiertage";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

export default function TrackerPage() {
  const { entries, year, month, loading } = useTrackerStore();
  const { fetchEntries, create, update, remove } = useTimeEntries();
  const [scanOpen,      setScanOpen]      = useState(false);
  const [bulkFilling,   setBulkFilling]   = useState(false);
  const [bulkCount,     setBulkCount]     = useState<number | null>(null);
  const [yearFilling,   setYearFilling]   = useState(false);
  const [yearFillCount, setYearFillCount] = useState<number | null>(null);
  const [bundesland,    setBundesland]    = useState("NI");

  // Load bundesland from profile for correct public holidays
  useEffect(() => {
    async function loadBundesland() {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles").select("bundesland").eq("user_id", session.user.id).single();
      if (data?.bundesland) setBundesland(data.bundesland as string);
    }
    void loadBundesland();
  }, []);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const today    = new Date();
  const todayStr = today.toISOString().split("T")[0]!;

  const feiertage = useMemo(() => getFeiertage(year, bundesland), [year, bundesland]);

  const days = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const entryMap    = new Map(entries.map((e) => [e.date, e]));
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day     = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dow     = new Date(year, month - 1, day).getDay();
      return { dateStr, dow, entry: entryMap.get(dateStr) ?? null };
    });
  }, [entries, year, month]);

  /** Boş iş günlerini standart saatlerle doldur */
  async function handleBulkFill() {
    const emptyDays = days.filter(({ dateStr, dow, entry }) => {
      if (entry) return false;          // zaten var
      if (dow === 0 || dow === 6) return false; // hafta sonu
      if (feiertage[dateStr]) return false;     // Feiertag
      return true;
    });

    if (emptyDays.length === 0) {
      setBulkCount(0);
      setTimeout(() => setBulkCount(null), 2500);
      return;
    }

    setBulkFilling(true);
    let count = 0;
    for (const { dateStr, dow } of emptyDays) {
      const isFriday = dow === 5;
      const res = await create({
        date:           dateStr,
        day_type:       "arbeiten",
        start_time:     "07:45",
        end_time:       isFriday ? "14:30" : "17:00",
        break_minutes:  isFriday ? 30 : 60,
        is_night_shift: false,
        note:           null,
        tags:           [],
      });
      if (!res?.error) count++;
    }
    setBulkFilling(false);
    setBulkCount(count);
    setTimeout(() => setBulkCount(null), 3000);
    await fetchEntries();
  }

  /** Tüm yılın boş iş günlerini standart saatlerle doldur */
  async function handleYearFill() {
    const confirmed = window.confirm(
      `${year} yılının tüm boş iş günleri standart saatlerle (Mo–Do 07:45–17:00, Fr 07:45–14:30) doldurulacak. Devam edilsin mi?`
    );
    if (!confirmed) return;

    setYearFilling(true);
    const yearFeiertage = getFeiertage(year, bundesland);
    let count = 0;

    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(year, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const dow = new Date(year, m - 1, d).getDay();
        // Skip weekends, holidays, already-existing entries
        if (dow === 0 || dow === 6) continue;
        if (yearFeiertage[dateStr]) continue;
        const alreadyExists = entries.some(e => e.date === dateStr);
        if (alreadyExists) continue;

        const isFriday = dow === 5;
        const res = await create({
          date:           dateStr,
          day_type:       "arbeiten",
          start_time:     "07:45",
          end_time:       isFriday ? "14:30" : "17:00",
          break_minutes:  isFriday ? 30 : 60,
          is_night_shift: false,
          note:           null,
          tags:           [],
        });
        if (!res?.error) count++;
      }
    }

    setYearFilling(false);
    setYearFillCount(count);
    setTimeout(() => setYearFillCount(null), 4000);
    await fetchEntries();
  }

  return (
    <>
      <MonthNav />
      <MonthlySummary />

      <WelcomeBanner
        storageKey="stundly_tracker_welcome"
        title="Willkommen bei Stundly!"
        text="Tipp: Klicke unten auf '📅 Monat automatisch befüllen' und dein Monat ist in einer Sekunde fertig. Du kannst danach einzelne Tage anpassen."
        cta="Los geht's"
      />

      {/* Befüllen buttons */}
      <div style={{ padding: "14px 32px 0", display: "flex", flexDirection: "column", gap: 8, maxWidth: 960, margin: "0 auto" }}>
        {/* Monat befüllen */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => void handleBulkFill()}
            disabled={bulkFilling || yearFilling || loading}
            style={{
              flex: 1, padding: "9px 12px",
              background: "var(--surface)", border: "1px dashed var(--green)",
              borderRadius: 10, cursor: bulkFilling ? "wait" : "pointer",
              color: "var(--green)", fontFamily: "'Syne',sans-serif",
              fontSize: 12, fontWeight: 700,
              opacity: (bulkFilling || yearFilling) ? 0.7 : 1,
            }}
          >
            {bulkFilling
              ? "⏳ Wird befüllt..."
              : `📅 ${MONTHS[month - 1]} automatisch befüllen`}
          </button>
          {bulkCount !== null && (
            <span style={{ fontSize: 12, color: bulkCount > 0 ? "var(--green)" : "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>
              {bulkCount > 0 ? `✅ ${bulkCount} Tage` : "Nichts zu befüllen"}
            </span>
          )}
        </div>

        {/* Ganzes Jahr befüllen */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => void handleYearFill()}
            disabled={bulkFilling || yearFilling || loading}
            style={{
              flex: 1, padding: "9px 12px",
              background: "var(--surface)", border: "1px dashed var(--accent)",
              borderRadius: 10, cursor: yearFilling ? "wait" : "pointer",
              color: "var(--accent2)", fontFamily: "'Syne',sans-serif",
              fontSize: 12, fontWeight: 700,
              opacity: (bulkFilling || yearFilling) ? 0.7 : 1,
            }}
          >
            {yearFilling
              ? "⏳ Jahr wird befüllt..."
              : `🗓 ${year} komplett befüllen`}
          </button>
          {yearFillCount !== null && (
            <span style={{ fontSize: 12, color: yearFillCount > 0 ? "var(--accent2)" : "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>
              {yearFillCount > 0 ? `✅ ${yearFillCount} Tage` : "Alles befüllt"}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 32px 0", maxWidth: 960, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontSize: 14 }}>
            Laden...
          </div>
        ) : (
          days.map(({ dateStr, dow, entry }) => (
            <div id={dateStr === todayStr ? "today-entry" : undefined} key={dateStr}>
              <DayEntry
                date={dateStr}
                entry={entry}
                isToday={dateStr === todayStr}
                dayOfWeek={dow}
                feiertag={feiertage[dateStr] || undefined}
                onCreate={create}
                onUpdate={update}
                onDelete={async (id) => { await remove(id); }}
              />
            </div>
          ))
        )}
      </div>

      {/* Floating Scan Button */}
      <button
        onClick={() => setScanOpen(true)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 150,
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--accent)", border: "none",
          color: "white", fontSize: 22, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(124,106,247,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        title="Stundenzettel scannen"
      >
        📷
      </button>

      {scanOpen && (
        <PhotoScanModal
          onCreate={create}
          onClose={() => { setScanOpen(false); void fetchEntries(); }}
        />
      )}
    </>
  );
}
