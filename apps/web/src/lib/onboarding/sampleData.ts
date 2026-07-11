/**
 * Onboarding sample data generator.
 *
 * Yeni user için realistik 30 günlük veri üretir:
 *   - ~20 arbeiten günü (Mo-Fr, çoğu 08:00-17:00, 1-2 überstunde)
 *   - 2 Urlaub günü (arka arkaya)
 *   - 1 Krank günü
 *   - 1 Notdienst-Wochenende (2 gün, akşam saatleri)
 *
 * Tag `sample` ile işaretlenir → dashboard'da "Alle löschen" banner.
 * Kullanıcı istediği zaman bir tıkla temizler, veya elle düzenler.
 */

import type { DayType } from "@workly/shared";

export interface SampleEntry {
  date:           string; // YYYY-MM-DD
  day_type:       DayType;
  start_time:     string | null;
  end_time:       string | null;
  break_minutes:  number;
  note:           string | null;
  is_night_shift: boolean;
  tags:           string[];
}

export interface SampleNotdienst {
  date:       string;
  start_time: string;
  end_time:   string;
  kunde:      string | null;
  note:       string | null;
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/**
 * Verilen ay için sample time_entries + notdienst_entries üretir.
 * Sabit seed davranış — aynı ay için hep aynı veri.
 */
export function generateSampleData(year: number, month: number): {
  entries:   SampleEntry[];
  notdienst: SampleNotdienst[];
} {
  const daysInMonth = new Date(year, month, 0).getDate();
  const entries: SampleEntry[] = [];
  const notdienst: SampleNotdienst[] = [];

  // Sabit örnek pattern: ay boyunca 20 arbeiten, 2 urlaub, 1 krank, 1 notdienst-wochenende
  // Urlaub ve krank özel günlere yerleştir (10-12, 17. gün)
  const urlaubDays  = [10, 11]; // arka arkaya 2 gün
  const krankDay    = 17;
  const notdienstWk = { fri: 5, sat: 6, sun: 7 }; // ilk Cuma-Cumartesi-Pazar

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    const dow = dt.getDay(); // 0=Sun, 6=Sat
    const iso = `${year}-${pad2(month)}-${pad2(d)}`;

    // Weekend arbeiten: skip (Sa/So)
    if (dow === 0 || dow === 6) continue;

    if (urlaubDays.includes(d)) {
      entries.push({
        date: iso, day_type: "urlaub",
        start_time: null, end_time: null, break_minutes: 0,
        note: "Kurzer Frühlings-Urlaub", is_night_shift: false, tags: ["sample"],
      });
      continue;
    }
    if (d === krankDay) {
      entries.push({
        date: iso, day_type: "krank",
        start_time: null, end_time: null, break_minutes: 0,
        note: "Grippe", is_night_shift: false, tags: ["sample"],
      });
      continue;
    }

    // Ana pattern: 08:00-17:00, 60m pause = 8h netto
    // Bazı günlerde varyasyon:
    //   - Her 4. günde 08:00-19:00 (10h — overtime)
    //   - Her 5. günde 07:30-16:30 (erken başlangıç)
    let start = "08:00", end = "17:00", brk = 60, note: string | null = null;
    if (d % 4 === 0)      { start = "08:00"; end = "19:00"; brk = 60; note = "Kundenauftrag, Überstunden"; }
    else if (d % 5 === 0) { start = "07:30"; end = "16:30"; brk = 60; note = null; }
    else if (d % 7 === 0) { start = "08:00"; end = "16:00"; brk = 45; note = "Halber Tag Baustellen-Besichtigung"; }

    entries.push({
      date: iso, day_type: "arbeiten",
      start_time: start, end_time: end, break_minutes: brk,
      note, is_night_shift: false, tags: ["sample"],
    });
  }

  // Notdienst-Wochenende: Fri evening + Sat/Sun (2 gün)
  // Ayın ilk Fr-Sa-So üçlüsünü bul
  let notdienstFri = 0;
  for (let d = 1; d <= 14; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getDay() === 5) { // Freitag
      notdienstFri = d;
      break;
    }
  }
  if (notdienstFri > 0) {
    void notdienstWk; // pattern silme uyarısı
    const friIso = `${year}-${pad2(month)}-${pad2(notdienstFri)}`;
    const satIso = `${year}-${pad2(month)}-${pad2(notdienstFri + 1)}`;
    notdienst.push({
      date: friIso, start_time: "18:00", end_time: "22:00",
      kunde: "Familie Schulz", note: "Rohrbruch — Beispieldatensatz",
    });
    if (notdienstFri + 1 <= daysInMonth) {
      notdienst.push({
        date: satIso, start_time: "09:00", end_time: "13:00",
        kunde: "Herr Müller", note: "Heizung defekt — Beispieldatensatz",
      });
    }
  }

  return { entries, notdienst };
}
