import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { calculateWorkDuration, formatDuration, DAY_TYPES } from '@workly/shared';
import type { TimeEntry } from '@workly/shared';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

const MONTHS_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const TARGET_H = 174;
const VAC_TOTAL = 30;
type ViewMode = 'calendar' | 'stats';

function calcMonthStats(entries: TimeEntry[]) {
  let workedMin = 0, ndMin = 0, ndCount = 0;
  let urlaub = 0, krank = 0, feiertag = 0, arbeiten = 0;
  for (const e of entries) {
    if (e.day_type === DAY_TYPES.URLAUB)    urlaub++;
    if (e.day_type === DAY_TYPES.KRANK)     krank++;
    if (e.day_type === DAY_TYPES.FEIERTAG)  feiertag++;
    if (e.day_type === DAY_TYPES.ARBEITEN)  arbeiten++;
    if (e.day_type === DAY_TYPES.NOTDIENST) ndCount++;
    if (!e.start_time || !e.end_time) {
      if (e.day_type !== DAY_TYPES.FREI && e.day_type !== DAY_TYPES.NOTDIENST) workedMin += 8 * 60;
      continue;
    }
    const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
    if (e.day_type === DAY_TYPES.NOTDIENST) ndMin += net_minutes;
    else if (e.day_type !== DAY_TYPES.FREI) workedMin += net_minutes;
  }
  return { workedMin, ndMin, ndCount, urlaub, krank, feiertag, arbeiten, diffMin: workedMin - TARGET_H * 60 };
}

export function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('time_entries').select('*')
        .eq('user_id', session.user.id)
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`);
      if (data) setAllEntries(data);
      setLoading(false);
    }
    load();
  }, [year]);

  const monthStats = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const me = allEntries.filter((e: any) => e.date.startsWith(`${year}-${String(m).padStart(2, '0')}`));
      return { month: m, ...calcMonthStats(me as TimeEntry[]) };
    }),
  [allEntries, year]);

  const yearly = useMemo(() => {
    let totalWorked = 0, totalNd = 0, totalDiff = 0;
    let totalUrlaub = 0, totalKrank = 0, totalFeiertag = 0, totalArbeiten = 0;
    for (const s of monthStats) {
      totalWorked += s.workedMin; totalNd += s.ndMin;
      totalDiff += s.diffMin; totalUrlaub += s.urlaub;
      totalKrank += s.krank; totalFeiertag += s.feiertag;
      totalArbeiten += s.arbeiten;
    }
    return { totalWorked, totalNd, totalDiff, totalUrlaub, totalKrank, totalFeiertag, totalArbeiten };
  }, [monthStats]);

  const maxMonthMin = Math.max(...monthStats.map(s => s.workedMin + s.ndMin), TARGET_H * 60);
  const curMonth = year === now.getFullYear() ? now.getMonth() + 1 : -1;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.brand}>STUNDLY</Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {[2025, 2026, 2027, 2028].map(y => (
              <TouchableOpacity key={y} onPress={() => setYear(y)}
                style={[styles.yearBtn, y === year && styles.yearBtnActive]}>
                <Text style={[styles.yearBtnText, y === year && { color: '#fff' }]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={styles.headerTitle}>{viewMode === 'calendar' ? '📅 Jahresansicht' : '📊 Statistik'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {(['calendar', 'stats'] as const).map(v => (
            <TouchableOpacity key={v} onPress={() => setViewMode(v)}
              style={[styles.toggleBtn, viewMode === v && styles.toggleBtnActive]}>
              <Text style={[styles.toggleBtnText, viewMode === v && { color: '#fff' }]}>
                {v === 'calendar' ? '📅 Kalender' : '📊 Statistik'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {viewMode === 'calendar' ? (
          <>
          {/* Yearly summary cards */}
          <View style={styles.statsRow}>
            {[
              { label: 'Arbeitstage', val: String(yearly.totalArbeiten), color: colors.green },
              { label: 'Urlaubstage', val: `${yearly.totalUrlaub}/${VAC_TOTAL}`, color: colors.blue },
              { label: 'Kranktage', val: String(yearly.totalKrank), color: colors.red },
              { label: 'Feiertage', val: String(yearly.totalFeiertag), color: colors.yellow },
            ].map(c => (
              <View key={c.label} style={[styles.statCard, { borderTopColor: c.color }]}>
                <Text style={styles.statLabel}>{c.label}</Text>
                <Text style={[styles.statVal, { color: c.color }]}>{c.val}</Text>
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 10 }}>
            {[
              [colors.green, 'Arbeiten'],
              [colors.orange, 'Notdienst'],
              [colors.accent, 'Soll'],
            ].map(([c, l]) => (
              <View key={l as string} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, backgroundColor: c as string, borderRadius: 2 }} />
                <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '600' }}>{l}</Text>
              </View>
            ))}
          </View>

          {/* Monthly bars */}
          {monthStats.map((s, i) => {
            const isActive = s.month === curMonth;
            const total = s.workedMin + s.ndMin;
            const wPct = maxMonthMin > 0 ? Math.min(100, (s.workedMin / maxMonthMin) * 100) : 0;
            const ndPct = maxMonthMin > 0 ? Math.min(100, (s.ndMin / maxMonthMin) * 100) : 0;
            const hasData = total > 0 || s.urlaub > 0 || s.krank > 0;
            return (
              <View key={i} style={[styles.monthRow, isActive && { backgroundColor: '#1e1b38', borderColor: colors.accent }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: hasData ? 8 : 0 }}>
                  <Text style={[styles.monthLabel, isActive && { color: colors.accent2 }]}>{MONTHS_SHORT[i]}</Text>
                  <View style={{ flex: 1, height: 10, backgroundColor: colors.surface2, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <View style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${wPct}%`, backgroundColor: colors.green, borderRadius: 6 }} />
                    {ndPct > 0 && <View style={{ position: 'absolute', left: `${wPct}%`, top: 0, height: '100%', width: `${ndPct}%`, backgroundColor: colors.orange }} />}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {hasData && <Text style={styles.monthHours}>{formatDuration(Math.round(total))}</Text>}
                    {s.diffMin !== 0 && (
                      <Text style={[styles.monthDiff, { color: s.diffMin > 0 ? colors.green : colors.red }]}>
                        {s.diffMin > 0 ? '+' : '-'}{formatDuration(Math.round(Math.abs(s.diffMin)))}
                      </Text>
                    )}
                  </View>
                </View>
                {hasData && (
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingLeft: 38 }}>
                    {s.arbeiten > 0 && <Text style={{ fontSize: 10, color: colors.green, fontWeight: '700' }}>✓ {s.arbeiten}T</Text>}
                    {s.urlaub > 0 && <Text style={{ fontSize: 10, color: colors.blue, fontWeight: '700' }}>🏖 {s.urlaub}T</Text>}
                    {s.krank > 0 && <Text style={{ fontSize: 10, color: colors.red, fontWeight: '700' }}>🤒 {s.krank}T</Text>}
                    {s.feiertag > 0 && <Text style={{ fontSize: 10, color: colors.yellow, fontWeight: '700' }}>🎉 {s.feiertag}T</Text>}
                    {s.ndCount > 0 && <Text style={{ fontSize: 10, color: colors.orange, fontWeight: '700' }}>🚨 {s.ndCount}×</Text>}
                  </View>
                )}
              </View>
            );
          })}
          </>
          ) : (
          /* ── STATISTIK VIEW ── */
          <>
          {/* 2x3 Stat cards */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Arbeitstage', val: String(yearly.totalArbeiten), color: colors.green },
              { label: 'Urlaubstage', val: `${yearly.totalUrlaub}/${VAC_TOTAL}`, color: colors.blue },
              { label: 'Kranktage', val: String(yearly.totalKrank), color: colors.red },
              { label: 'Feiertage', val: String(yearly.totalFeiertag), color: colors.yellow },
              { label: 'Notdienst', val: `${monthStats.reduce((s, m) => s + m.ndCount, 0)}×`, color: colors.orange },
              { label: 'Überstunden', val: `${yearly.totalDiff > 0 ? '+' : ''}${formatDuration(Math.round(Math.abs(yearly.totalDiff)))}`, color: yearly.totalDiff >= 0 ? colors.accent2 : colors.red },
            ].map(c => (
              <View key={c.label} style={[styles.statCard, { borderTopColor: c.color }]}>
                <Text style={styles.statLabel}>{c.label}</Text>
                <Text style={[styles.statVal, { color: c.color }]}>{c.val}</Text>
              </View>
            ))}
          </View>

          {/* Urlaubskonto */}
          <View style={[styles.monthRow, { marginBottom: 14 }]}>
            <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>🏖 URLAUBSKONTO {year}</Text>
            <View style={{ flexDirection: 'row', gap: 14, marginBottom: 10 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.green }}>{VAC_TOTAL - yearly.totalUrlaub}</Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Verfügbar</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.accent2 }}>{yearly.totalUrlaub}</Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Genommen</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.blue }}>{VAC_TOTAL}</Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Gesamt</Text>
              </View>
            </View>
            <View style={{ height: 8, backgroundColor: colors.surface2, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${(yearly.totalUrlaub / VAC_TOTAL) * 100}%`, backgroundColor: colors.accent2, borderRadius: 4 }} />
            </View>
          </View>

          {/* Monatliche Differenz-Balken */}
          <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>MONATLICHE DIFFERENZ</Text>
          {monthStats.map((s, i) => {
            const maxDiff = Math.max(...monthStats.map(x => Math.abs(x.diffMin)), 1);
            const pctBar = (Math.abs(s.diffMin) / maxDiff) * 100;
            const isPositive = s.diffMin >= 0;
            return (
              <View key={i} style={[styles.monthRow, { marginBottom: 4, paddingVertical: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={[styles.monthLabel, s.month === curMonth && { color: colors.accent2 }]}>{MONTHS_SHORT[i]}</Text>
                  <View style={{ flex: 1, height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: `${pctBar}%`, height: '100%', backgroundColor: isPositive ? colors.green : colors.red, borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isPositive ? colors.green : colors.red, width: 60, textAlign: 'right' }}>
                    {isPositive ? '+' : '-'}{formatDuration(Math.round(Math.abs(s.diffMin)))}
                  </Text>
                </View>
              </View>
            );
          })}
          </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: '#1a1a2e', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brand: { color: colors.accent2, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  yearBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8 },
  yearBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  yearBtnText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, borderTopWidth: 3, alignItems: 'center' },
  statLabel: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  statVal: { fontSize: 22, fontWeight: '500', marginTop: 4 },
  monthRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 11, paddingHorizontal: 14, marginBottom: 6 },
  monthLabel: { fontWeight: '700', fontSize: 13, width: 28, color: colors.text },
  monthHours: { fontSize: 11, color: colors.muted },
  monthDiff: { fontSize: 11, fontWeight: '700' },
  toggleBtn: { flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleBtnText: { fontSize: 12, fontWeight: '700', color: colors.muted },
});
