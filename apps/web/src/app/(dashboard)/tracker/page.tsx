"use client";

import { useMemo, useEffect, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { MonthNav } from "@/components/tracker/MonthNav";
import { MonthlySummary } from "@/components/tracker/MonthlySummary";
import { NotdienstWeekly } from "@/components/tracker/NotdienstWeekly";
import { DayEntry } from "@/components/tracker/DayEntry";
import { PhotoScanModal } from "@/components/tracker/PhotoScanModal";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { getFeiertage } from "@/lib/utils/feiertage";
import { createClient } from "@/lib/supabase/client";

export default function TrackerPage() {
  const { entries, year, month, loading } = useTrackerStore();
  const { fetchEntries, create, update, remove } = useTimeEntries();
  const [scanOpen,      setScanOpen]      = useState(false);
  const [bundesland,    setBundesland]    = useState("NI");
  const [clearingSample, setClearingSample] = useState(false);

  const sampleCount = useMemo(
    () => entries.filter((e) => (e.tags ?? []).includes("sample")).length,
    [entries],
  );

  async function handleClearSample() {
    if (!confirm("Alle Beispiel-Einträge löschen? Deine echten Einträge bleiben erhalten.")) return;
    setClearingSample(true);
    try {
      const res = await fetch("/api/onboarding/sample-data", { method: "DELETE" });
      if (res.ok) {
        await fetchEntries();
      }
    } finally {
      setClearingSample(false);
    }
  }

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

  // Aktif ay = bu ay ise, ilk render'da bugünün satırına scroll et
  useEffect(() => {
    if (loading) return;
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    if (!isCurrentMonth) return;
    // Layout settle olduktan sonra scroll
    const timer = setTimeout(() => {
      const el = document.getElementById("today-entry");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(timer);
  // intentionally only on loading change + month/year change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, year, month]);

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

  // Befüllung & PDF jetzt in Settings → "Monatsbefüllung & Berichte".

  return (
    <>
      <MonthNav />
      <MonthlySummary feiertage={feiertage} />
      {sampleCount > 0 && (
        <div
          role="status"
          style={{
            margin: "0 16px 12px",
            padding: "10px 14px",
            background: "color-mix(in srgb, var(--accent2) 8%, var(--surface))",
            border: "1px dashed color-mix(in srgb, var(--accent2) 35%, transparent)",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flexWrap: "wrap",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--muted)", lineHeight: 1.5 }}>
            📊 <strong style={{ color: "var(--accent2)" }}>Beispieldaten aktiv</strong>
            {" · "}{sampleCount} Eintr{sampleCount === 1 ? "ag" : "äge"} zur Ansicht
          </span>
          <button
            onClick={handleClearSample}
            disabled={clearingSample}
            style={{
              padding: "6px 12px", borderRadius: 8, cursor: clearingSample ? "wait" : "pointer",
              background: "transparent",
              border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
              color: "var(--accent2)", fontSize: 11, fontWeight: 700,
              fontFamily: "'Syne',sans-serif",
            }}
          >
            {clearingSample ? "Wird gelöscht…" : "Alle löschen"}
          </button>
        </div>
      )}
      <NotdienstWeekly />

      <WelcomeBanner
        storageKey="stundly_tracker_welcome"
        title="Willkommen bei Stundly!"
        text="Tipp: In Profil & Settings → 'Monatsbefüllung & Berichte' kannst du dein ganzes Jahr mit einem Klick mit Standardzeiten füllen und Monatsberichte als PDF erzeugen."
        cta="Los geht's"
      />

      {/*
        Befüllen / PDF butonları artık Settings → "Monatsbefüllung & Berichte"
        kartında. Tracker sayfası sade ve uzun listeye odaklı tutuluyor.
      */}

      <div style={{ padding: "14px 16px 0", maxWidth: 960, margin: "0 auto" }}>
        {loading ? (
          <div
            role="status"
            aria-label="Einträge werden geladen"
            style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 0" }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} fullWidth height={56} radius={10} />
            ))}
          </div>
        ) : (
          days.map(({ dateStr, dow, entry }, i) => (
            <div id={dateStr === todayStr ? "today-entry" : undefined} key={dateStr}>
              <DayEntry
                date={dateStr}
                entry={entry}
                previousEntry={i > 0 ? (days[i - 1]?.entry ?? null) : null}
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

      {/* Floating Scan Button — above BottomNav on mobile */}
      <button
        onClick={() => setScanOpen(true)}
        className="floating-scan"
        title="Stundenzettel scannen"
        aria-label="Stundenzettel scannen"
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
