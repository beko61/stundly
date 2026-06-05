import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import { calculateWorkDuration, formatDuration, DAY_TYPES } from '@workly/shared';
import type { TimeEntry } from '@workly/shared';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const STANDARD_HOURS = 174;

function calcStats(entries: TimeEntry[]) {
  let workedMin = 0, ndMin = 0;
  let urlaub = 0, krank = 0, feiertag = 0, arbeiten = 0, notdienst = 0;
  for (const e of entries) {
    if (e.day_type === DAY_TYPES.URLAUB) { urlaub++; workedMin += 8 * 60; }
    if (e.day_type === DAY_TYPES.KRANK) { krank++; workedMin += 8 * 60; }
    if (e.day_type === DAY_TYPES.FEIERTAG) { feiertag++; workedMin += 8 * 60; }
    if (e.day_type === DAY_TYPES.ARBEITEN) arbeiten++;
    if (e.day_type === DAY_TYPES.NOTDIENST) notdienst++;
    if (!e.start_time || !e.end_time) continue;
    const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
    if (e.day_type === DAY_TYPES.NOTDIENST) ndMin += net_minutes;
    else if (e.day_type === DAY_TYPES.ARBEITEN) workedMin += net_minutes;
  }
  return { workedMin, ndMin, diffMin: workedMin - (STANDARD_HOURS * 60), urlaub, krank, feiertag, arbeiten, notdienst };
}

export function ReportsScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const start = mode === 'month'
        ? `${year}-${String(month).padStart(2, '0')}-01`
        : `${year}-01-01`;
      const end = mode === 'month'
        ? new Date(year, month, 0).toISOString().split('T')[0]
        : `${year}-12-31`;
      const { data } = await supabase.from('time_entries').select('*')
        .eq('user_id', session.user.id).gte('date', start).lte('date', end);
      if (data) setEntries(data);
      setLoading(false);
    }
    load();
  }, [year, month, mode]);

  const stats = useMemo(() => calcStats(entries as TimeEntry[]), [entries]);
  const fmt = (min: number) => formatDuration(Math.round(Math.abs(min)));
  const sign = (min: number) => min >= 0 ? '+' : '-';

  const monthlyBreakdown = useMemo(() => {
    if (mode === 'month') return [];
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const me = entries.filter((e: any) => e.date.startsWith(`${year}-${String(m).padStart(2, '0')}`));
      return { month: m, ...calcStats(me as TimeEntry[]) };
    });
  }, [entries, year, mode]);

  async function exportCSV() {
    const rows = [['Datum', 'Tag', 'Typ', 'Start', 'Ende', 'Pause', 'Stunden', 'Notiz']];
    const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    for (const e of entries) {
      const d = new Date(e.date);
      const dow = DAYS[d.getDay()];
      const dur = e.start_time && e.end_time
        ? fmt(calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes) : '';
      rows.push([e.date, dow, e.day_type, e.start_time ?? '-', e.end_time ?? '-',
        String(e.break_minutes), dur, e.note ?? '']);
    }
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    try {
      await Share.share({ message: csv, title: `workly_${year}_${mode === 'month' ? String(month).padStart(2, '0') : 'year'}.csv` });
    } catch { Alert.alert('Fehler', 'CSV konnte nicht geteilt werden.'); }
  }

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.brand}>WORKLY</Text>
          <TouchableOpacity onPress={exportCSV} style={styles.csvBtn}>
            <Text style={{ color: colors.green, fontSize: 11, fontWeight: '700' }}>⬇ CSV Export</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {(['month', 'year'] as const).map(v => (
            <TouchableOpacity key={v} onPress={() => setMode(v)}
              style={[styles.modeBtn, mode === v && styles.modeBtnActive]}>
              <Text style={[styles.modeBtnText, mode === v && { color: '#fff' }]}>
                {v === 'month' ? '📋 Monat' : '📊 Jahr'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {mode === 'month' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}><Text style={styles.navBtnText}>‹</Text></TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[month - 1]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}><Text style={styles.navBtnText}>›</Text></TouchableOpacity>
          </View>
        )}
        {mode === 'year' && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[2025, 2026, 2027, 2028].map(y => (
              <TouchableOpacity key={y} onPress={() => setYear(y)}
                style={[styles.yearBtn, y === year && styles.yearBtnActive]}>
                <Text style={[styles.yearBtnText, y === year && { color: '#fff' }]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Summary cards */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'GEARBEITET', val: fmt(stats.workedMin), c: colors.green, bc: colors.green },
              { label: 'DIFFERENZ', val: `${sign(stats.diffMin)}${fmt(stats.diffMin)}`, c: stats.diffMin >= 0 ? colors.blue : colors.red, bc: stats.diffMin >= 0 ? colors.blue : colors.red },
              { label: 'ARBEITSTAGE', val: String(stats.arbeiten), c: colors.accent2, bc: colors.accent2 },
              { label: 'URLAUB', val: `${stats.urlaub} Tage`, c: colors.blue, bc: colors.blue },
              { label: 'KRANK', val: `${stats.krank} Tage`, c: colors.red, bc: colors.red },
              { label: 'NOTDIENST', val: `${stats.notdienst}×`, c: colors.orange, bc: colors.orange },
            ].map(card => (
              <View key={card.label} style={[styles.statCard, { borderTopColor: card.bc }]}>
                <Text style={styles.statLabel}>{card.label}</Text>
                <Text style={[styles.statVal, { color: card.c }]}>{card.val}</Text>
              </View>
            ))}
          </View>

          {mode === 'month' ? (
            entries.length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.muted, padding: 30 }}>Keine Einträge für diesen Monat.</Text>
            ) : (
              <View style={styles.tableCard}>
                {/* Table header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { width: 55 }]}>DATUM</Text>
                  <Text style={[styles.th, { width: 30 }]}>TAG</Text>
                  <Text style={[styles.th, { flex: 1 }]}>TYP</Text>
                  <Text style={[styles.th, { width: 45 }]}>START</Text>
                  <Text style={[styles.th, { width: 45 }]}>ENDE</Text>
                  <Text style={[styles.th, { width: 40 }]}>STD</Text>
                </View>
                {[...entries].sort((a, b) => a.date.localeCompare(b.date)).map((e: any) => {
                  const d = new Date(e.date);
                  const dow = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
                  const dur = e.start_time && e.end_time
                    ? fmt(calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes) : '—';
                  const COLOR: Record<string, string> = { arbeiten: colors.green, urlaub: colors.blue, krank: colors.red, notdienst: colors.orange, feiertag: colors.yellow, frei: colors.muted };
                  return (
                    <View key={e.id} style={styles.tableRow}>
                      <Text style={[styles.td, { width: 55, color: colors.muted }]}>{e.date.slice(5)}</Text>
                      <Text style={[styles.td, { width: 30, fontWeight: '700', color: colors.muted }]}>{dow}</Text>
                      <Text style={[styles.td, { flex: 1, fontWeight: '700', color: COLOR[e.day_type] ?? colors.text, textTransform: 'capitalize' }]}>{e.day_type}</Text>
                      <Text style={[styles.td, { width: 45 }]}>{e.start_time?.slice(0, 5) ?? '-'}</Text>
                      <Text style={[styles.td, { width: 45 }]}>{e.end_time?.slice(0, 5) ?? '-'}</Text>
                      <Text style={[styles.td, { width: 40, color: colors.green }]}>{dur}</Text>
                    </View>
                  );
                })}
              </View>
            )
          ) : (
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: 35 }]}>MON</Text>
                <Text style={[styles.th, { flex: 1 }]}>DIFFERENZ</Text>
                <Text style={[styles.th, { width: 50 }]}>STD</Text>
                <Text style={[styles.th, { width: 35 }]}>ND</Text>
                <Text style={[styles.th, { width: 30 }]}>URL</Text>
                <Text style={[styles.th, { width: 35 }]}>KR</Text>
              </View>
              {monthlyBreakdown.map((s, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.td, { width: 35, fontWeight: '700' }]}>{MONTHS_SHORT[i]}</Text>
                  <View style={{ flex: 1, height: 5, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, (Math.abs(s.diffMin) / Math.max(...monthlyBreakdown.map(x => Math.abs(x.diffMin)), 1)) * 100)}%`, height: '100%', backgroundColor: s.diffMin >= 0 ? colors.green : colors.red, borderRadius: 3 }} />
                  </View>
                  <Text style={[styles.td, { width: 50, color: colors.muted }]}>{fmt(s.workedMin)}</Text>
                  <Text style={[styles.td, { width: 35, color: colors.orange }]}>{s.notdienst > 0 ? `${s.notdienst}×` : '—'}</Text>
                  <Text style={[styles.td, { width: 30, color: colors.blue }]}>{s.urlaub > 0 ? `${s.urlaub}T` : '—'}</Text>
                  <Text style={[styles.td, { width: 35, color: colors.red }]}>{s.krank > 0 ? `${s.krank}T` : '—'}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: '#1a1a2e', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { color: colors.accent2, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  csvBtn: { backgroundColor: `${colors.green}20`, borderWidth: 1, borderColor: colors.green, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  modeBtn: { flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  monthTitle: { fontSize: 20, fontWeight: '800', color: colors.text, flex: 1, textAlign: 'center' },
  navBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { color: colors.text, fontSize: 18 },
  yearBtn: { flex: 1, padding: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: 'center' },
  yearBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  yearBtnText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  statCard: { width: '47%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, borderTopWidth: 3 },
  statLabel: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  statVal: { fontSize: 20, fontWeight: '500', marginTop: 4 },
  tableCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', padding: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  th: { fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', padding: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.surface2, gap: 8, alignItems: 'center' },
  td: { fontSize: 12, color: colors.text },
});
