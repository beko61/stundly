import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { DAY_TYPE_LABELS, calculateWorkDuration, formatDuration, DAY_TYPES } from '@workly/shared';
import { supabase } from '../lib/supabase';
import { colors, STATUS_COLOR, STATUS_ICON } from '../theme/colors';
import { TimeEntryModal } from '../components/TimeEntryModal';
import { NotdienstModal, type NotdienstEntry } from '../components/NotdienstModal';

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WEEKDAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];

export function TrackerScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDow, setSelectedDow] = useState(0);
  const [ndModal, setNdModal] = useState<'new' | NotdienstEntry | null>(null);
  const [ndDate, setNdDate] = useState('');
  const [ndEntries, setNdEntries] = useState<Record<string, NotdienstEntry[]>>({});
  const [bulkFilling, setBulkFilling] = useState(false);
  const [bulkCount, setBulkCount] = useState<number | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (data) setEntries(data);

    // Load notdienst entries
    const { data: ndData } = await supabase.from('notdienst_entries').select('*')
      .eq('user_id', session.user.id).gte('date', startDate).lte('date', endDate).order('start_time');
    if (ndData) {
      const grouped: Record<string, NotdienstEntry[]> = {};
      for (const nd of ndData as NotdienstEntry[]) {
        if (!grouped[nd.date]) grouped[nd.date] = [];
        grouped[nd.date].push(nd);
      }
      setNdEntries(grouped);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const todayStr = now.toISOString().split('T')[0];

  // Build full calendar days
  const daysInMonth = new Date(year, month, 0).getDate();
  const entryMap = new Map(entries.map(e => [e.date, e]));
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = new Date(year, month - 1, day).getDay();
    return { dateStr, dow, entry: entryMap.get(dateStr) ?? null };
  });

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  function openModal(dateStr: string, dow: number, entry: any) {
    setSelectedDate(dateStr);
    setSelectedDow(dow);
    setSelectedEntry(entry);
    setModalVisible(true);
  }

  async function deleteEntry(id: string) {
    await supabase.from('time_entries').delete().eq('id', id);
    fetchEntries();
  }

  // Bulk fill
  async function handleBulkFill() {
    const emptyDays = days.filter(({ dateStr, dow, entry }) => {
      if (entry) return false;
      if (dow === 0 || dow === 6) return false;
      return true;
    });
    if (emptyDays.length === 0) { setBulkCount(0); setTimeout(() => setBulkCount(null), 2500); return; }
    setBulkFilling(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    let count = 0;
    for (const { dateStr, dow } of emptyDays) {
      const isFriday = dow === 5;
      const { error } = await supabase.from('time_entries').insert({
        user_id: session.user.id, date: dateStr, day_type: 'arbeiten',
        start_time: '07:45', end_time: isFriday ? '14:30' : '17:00',
        break_minutes: isFriday ? 30 : 60, is_night_shift: false, note: null, tags: [],
      });
      if (!error) count++;
    }
    setBulkFilling(false);
    setBulkCount(count);
    setTimeout(() => setBulkCount(null), 3000);
    fetchEntries();
  }

  // Monthly summary stats
  let workedMin = 0;
  let notdienstCount = 0;
  let krankDays = 0;
  for (const e of entries) {
    if (e.day_type === 'krank') krankDays++;
    if (e.day_type === 'notdienst') notdienstCount++;
    if (e.start_time && e.end_time && e.day_type !== 'frei') {
      const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
      workedMin += net_minutes;
    } else if (e.day_type === 'krank' || e.day_type === 'feiertag') {
      workedMin += 8 * 60;
    }
  }
  // Count Notdienst from sub-entries
  let ndTotalMin = 0;
  const allNdDates = new Set<string>();
  for (const [date, nds] of Object.entries(ndEntries)) {
    allNdDates.add(date);
    for (const nd of nds) {
      if (nd.start_time && nd.end_time) ndTotalMin += calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes;
    }
  }
  const workedH = Math.round(workedMin / 60 * 10) / 10;
  const targetH = 174;
  const diffMin = workedMin - targetH * 60;
  const ueberstunden = Math.max(0, diffMin);
  const pct = Math.min(100, (workedMin / (targetH * 60)) * 100);

  const renderDay = ({ item }: { item: typeof days[0] }) => {
    const { dateStr, dow, entry } = item;
    const isToday = dateStr === todayStr;
    const isWeekend = dow === 0 || dow === 6;
    const dayNum = parseInt(dateStr.split('-')[2], 10);

    const borderColor = entry
      ? entry.day_type !== 'arbeiten' ? STATUS_COLOR[entry.day_type] : isToday ? colors.accent : colors.border
      : isToday ? colors.accent : colors.border;

    const netHours = entry?.start_time && entry?.end_time
      ? formatDuration(calculateWorkDuration(entry.start_time, entry.end_time, entry.break_minutes).net_minutes)
      : null;

    return (
      <TouchableOpacity
        style={[styles.dayCard, { borderColor, opacity: isWeekend && !entry ? 0.55 : 1 }]}
        onPress={() => openModal(dateStr, dow, entry)}
        activeOpacity={0.7}
      >
        <View style={styles.dayRow}>
          <Text style={[styles.dayNum, isToday && { color: colors.accent2 }]}>
            {String(dayNum).padStart(2, '0')}
          </Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.weekday}>{WEEKDAYS[dow]}</Text>
              {isToday && <View style={styles.todayDot} />}
            </View>
            {entry ? (
              <Text style={[styles.statusText, { color: STATUS_COLOR[entry.day_type] }]}>
                {STATUS_ICON[entry.day_type]} {(DAY_TYPE_LABELS as any)[entry.day_type]}
              </Text>
            ) : (
              <Text style={styles.emptyText}>{isWeekend ? 'Wochenende' : '+ Eintrag hinzufügen'}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {netHours && <Text style={styles.hoursText}>{netHours}</Text>}
            {entry && (
              <TouchableOpacity onPress={() => { Alert.alert('Löschen?', 'Eintrag wirklich löschen?', [{ text: 'Nein' }, { text: 'Ja', onPress: () => deleteEntry(entry.id), style: 'destructive' }]); }}>
                <Text style={{ color: colors.muted, fontSize: 18, paddingHorizontal: 4 }}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Time chips */}
        {entry?.start_time && entry?.end_time && (
          <View style={styles.chipRow}>
            {[
              { label: 'Start', val: entry.start_time?.slice(0, 5) },
              { label: 'Pause', val: `${String(Math.floor(entry.break_minutes / 60)).padStart(2, '0')}:${String(entry.break_minutes % 60).padStart(2, '0')}` },
              { label: 'Ende', val: entry.end_time?.slice(0, 5) },
              { label: 'Std', val: netHours ?? '-' },
            ].map(chip => (
              <View key={chip.label} style={styles.chip}>
                <Text style={styles.chipLabel}>{chip.label}</Text>
                <Text style={styles.chipVal}>{chip.val}</Text>
              </View>
            ))}
            {entry.is_night_shift && (
              <View style={[styles.chip, { borderColor: colors.accent2 }]}>
                <Text style={{ color: colors.accent2, fontSize: 10 }}>🌙 Nacht</Text>
              </View>
            )}
          </View>
        )}

        {/* Notdienst sub-entries */}
        {(ndEntries[dateStr] || []).length > 0 && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            {(ndEntries[dateStr] || []).map((nd, idx) => {
              const ndDur = formatDuration(calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes);
              return (
                <TouchableOpacity key={nd.id} onPress={() => { setNdDate(dateStr); setNdModal(nd); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: idx < (ndEntries[dateStr]?.length ?? 0) - 1 ? 1 : 0, borderBottomColor: colors.surface2 }}>
                  <Text style={{ fontSize: 10, color: colors.orange, fontWeight: '700' }}>Nd {idx + 1}</Text>
                  <View style={[styles.chip, { borderColor: colors.orange }]}><Text style={{ color: colors.muted, fontSize: 9 }}>Start</Text><Text style={{ fontSize: 11, color: colors.orange }}>{nd.start_time?.slice(0,5)}</Text></View>
                  <View style={[styles.chip, { borderColor: colors.orange }]}><Text style={{ color: colors.muted, fontSize: 9 }}>Ende</Text><Text style={{ fontSize: 11, color: colors.orange }}>{nd.end_time?.slice(0,5)}</Text></View>
                  <View style={[styles.chip, { borderColor: colors.orange }]}><Text style={{ color: colors.muted, fontSize: 9 }}>Std</Text><Text style={{ fontSize: 11, color: colors.orange }}>{ndDur}</Text></View>
                  <Text style={{ color: nd.erledigt ? colors.green : colors.muted, fontSize: 14 }}>{nd.erledigt ? '✅' : '⏳'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* + Notdienst hinzufügen */}
        {(entry || isWeekend) && (ndEntries[dateStr] || []).length < 6 && (
          <TouchableOpacity onPress={() => { setNdDate(dateStr); setNdModal('new'); }}
            style={{ marginHorizontal: 14, marginBottom: 12, padding: 7, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: colors.orange, fontSize: 11, fontWeight: '700' }}>+ Notdienst hinzufügen</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header - gradient yapısı */}
      <View style={styles.headerGradient}>
        <View style={styles.headerTopRow}>
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
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}><Text style={styles.navBtnText}>‹</Text></TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[month - 1]}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}><Text style={styles.navBtnText}>›</Text></TouchableOpacity>
        </View>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.summaryWorked}>{workedH}h</Text>
          <Text style={styles.summaryTarget}>/{targetH}h</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={styles.summaryLabel}>GEARBEITET</Text>
            <Text style={[styles.summaryDiff, { color: diffMin >= 0 ? colors.green : colors.red }]}>
              {diffMin >= 0 ? '+' : '-'}{formatDuration(Math.round(Math.abs(diffMin)))}
            </Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: diffMin >= 0 ? colors.green : colors.red }]} />
          </View>
        </View>
      </View>

      {/* Extended stats row */}
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8 }}>
        <View style={{ flex: 1, backgroundColor: `${colors.orange}15`, borderWidth: 1, borderColor: `${colors.orange}40`, borderRadius: 10, padding: 8 }}>
          <Text style={{ fontSize: 9, color: colors.orange, fontWeight: '700', textTransform: 'uppercase' }}>Notdienst</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.orange }}>{allNdDates.size}×</Text>
          <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>{formatDuration(Math.round(ndTotalMin))} Std</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: ueberstunden > 0 ? `${colors.accent2}15` : `${colors.muted}15`, borderWidth: 1, borderColor: ueberstunden > 0 ? `${colors.accent2}40` : `${colors.muted}40`, borderRadius: 10, padding: 8 }}>
          <Text style={{ fontSize: 9, color: ueberstunden > 0 ? colors.accent2 : colors.muted, fontWeight: '700', textTransform: 'uppercase' }}>Überstunden</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: ueberstunden > 0 ? colors.accent2 : colors.muted }}>+{formatDuration(Math.round(ueberstunden))}</Text>
          <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>über Soll</Text>
        </View>
        {krankDays > 0 && (
          <View style={{ flex: 1, backgroundColor: `${colors.red}15`, borderWidth: 1, borderColor: `${colors.red}40`, borderRadius: 10, padding: 8 }}>
            <Text style={{ fontSize: 9, color: colors.red, fontWeight: '700', textTransform: 'uppercase' }}>Krank</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.red }}>{krankDays}T</Text>
            <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>{krankDays * 8}h</Text>
          </View>
        )}
      </View>

      {/* Bulk fill button */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <TouchableOpacity onPress={handleBulkFill} disabled={bulkFilling || loading}
          style={{ padding: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.green, borderRadius: 10, alignItems: 'center', opacity: bulkFilling ? 0.7 : 1 }}>
          <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700' }}>
            {bulkFilling ? '⏳ Wird befüllt...' : `📅 ${MONTHS[month - 1]} automatisch befüllen`}
          </Text>
        </TouchableOpacity>
        {bulkCount !== null && (
          <Text style={{ fontSize: 12, color: bulkCount > 0 ? colors.green : colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>
            {bulkCount > 0 ? `✅ ${bulkCount} Tage` : 'Nichts zu befüllen'}
          </Text>
        )}
      </View>

      {/* Day List */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={days}
          keyExtractor={item => item.dateStr}
          renderItem={renderDay}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal */}
      <TimeEntryModal
        visible={modalVisible}
        date={selectedDate}
        dayOfWeek={selectedDow}
        entry={selectedEntry}
        onSave={fetchEntries}
        onClose={() => setModalVisible(false)}
      />

      {/* Notdienst Modal */}
      <NotdienstModal
        visible={!!ndModal}
        date={ndDate}
        entry={ndModal === 'new' ? null : ndModal as NotdienstEntry | null}
        onSave={(saved) => {
          setNdEntries(prev => {
            const list = [...(prev[ndDate] || [])];
            if (ndModal === 'new') list.push(saved);
            else {
              const idx = list.findIndex(e => e.id === saved.id);
              if (idx >= 0) list[idx] = saved;
            }
            return { ...prev, [ndDate]: list };
          });
        }}
        onDelete={(id) => {
          setNdEntries(prev => ({
            ...prev, [ndDate]: (prev[ndDate] || []).filter(e => e.id !== id)
          }));
        }}
        onClose={() => setNdModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Header
  headerGradient: { backgroundColor: '#1a1a2e', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brand: { color: colors.accent2, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  yearBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8 },
  yearBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  yearBtnText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { color: colors.text, fontSize: 18 },
  monthTitle: { fontSize: 26, fontWeight: '800', color: colors.text, flex: 1, textAlign: 'center' },
  // Summary
  summaryCard: { flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 0, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16 },
  summaryWorked: { fontSize: 22, fontWeight: '700', color: colors.text },
  summaryTarget: { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  summaryLabel: { fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  summaryDiff: { fontSize: 12, fontWeight: '700' },
  progressBg: { backgroundColor: colors.surface2, borderRadius: 4, height: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  // Day card
  dayCard: { backgroundColor: colors.surface, borderWidth: 1, borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  dayRow: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 14, gap: 12 },
  dayNum: { fontSize: 20, fontWeight: '500', color: colors.muted, width: 28, textAlign: 'center' },
  weekday: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  todayDot: { width: 7, height: 7, backgroundColor: colors.accent2, borderRadius: 4, marginLeft: 6 },
  statusText: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  emptyText: { fontSize: 12, color: colors.muted, marginTop: 1 },
  hoursText: { fontSize: 14, fontWeight: '500', color: colors.text },
  // Chips
  chipRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 10, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  chipLabel: { color: colors.muted, fontSize: 10 },
  chipVal: { color: colors.text, fontSize: 12, fontWeight: '500' },
});
