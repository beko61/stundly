import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { calculateWorkDuration, DAY_TYPES } from '@workly/shared';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

const STATUS_LABELS: Record<string, string> = { pending: 'Ausstehend', approved: 'Genehmigt', rejected: 'Abgelehnt' };
const STATUS_COLORS: Record<string, string> = { pending: colors.yellow, approved: colors.green, rejected: colors.red };
const VAC_TOTAL = 30;

function calcWorkdays(start: string, end: string): number {
  if (!start || !end) return 0;
  let count = 0;
  const cur = new Date(start);
  const endD = new Date(end);
  while (cur <= endD) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function VacationScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [yearUsedDays, setYearUsedDays] = useState(0);
  const [overtimeMin, setOvertimeMin] = useState(0);

  // Form
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [urlaubArt, setUrlaubArt] = useState('Erholungsurlaub');
  const [bemerkung, setBemerkung] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const year = new Date().getFullYear();
    const { data: reqs } = await supabase.from('vacation_requests').select('*')
      .eq('user_id', session.user.id).order('start_date', { ascending: false });

    if (reqs) {
      setRequests(reqs);
      const usedDays = reqs
        .filter((r: any) => r.status !== 'rejected' && new Date(r.start_date).getFullYear() === year)
        .reduce((sum: number, r: any) => sum + r.days_count, 0);
      setYearUsedDays(usedDays);
    }

    // Overtime
    const monthsElapsed = new Date().getMonth() + 1;
    const { data: timeData } = await supabase.from('time_entries')
      .select('start_time, end_time, break_minutes, day_type')
      .eq('user_id', session.user.id)
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    if (timeData) {
      let workedMin = 0;
      for (const e of timeData) {
        if (e.day_type === DAY_TYPES.ARBEITEN && e.start_time && e.end_time) {
          workedMin += calculateWorkDuration(e.start_time, e.end_time, e.break_minutes as number).net_minutes;
        }
      }
      setOvertimeMin(Math.max(0, workedMin - 174 * 60 * monthsElapsed));
    }
    setLoading(false);
  }

  const days = calcWorkdays(startDate, endDate);
  const remainingDays = VAC_TOTAL - yearUsedDays;
  const overtimeDays = Math.floor(overtimeMin / 60 / 8);

  async function handleSubmit() {
    if (!startDate || !endDate) { Alert.alert('Fehler', 'Bitte Von- und Bis-Datum angeben.'); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from('vacation_requests').insert({
      user_id: session.user.id, start_date: startDate, end_date: endDate,
      days_count: days, reason: bemerkung || null, status: 'pending',
    });
    setSaving(false);
    setShowForm(false);
    setStartDate(''); setEndDate(''); setBemerkung('');
    load();
  }

  async function handleDelete(id: string) {
    Alert.alert('Löschen?', 'Antrag wirklich löschen?', [
      { text: 'Nein' },
      { text: 'Ja', style: 'destructive', onPress: async () => {
        await supabase.from('vacation_requests').delete().eq('id', id);
        load();
      }},
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>WORKLY</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <Text style={styles.headerTitle}>Urlaubsanträge</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>+ Antrag</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Charts row */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
            {/* Jahresurlaub */}
            <View style={[styles.chartCard, { flex: 1 }]}>
              <Text style={styles.chartLabel}>JAHRESURLAUB</Text>
              <Text style={[styles.chartBig, { color: colors.green }]}>{remainingDays}</Text>
              <Text style={styles.chartSub}>/{VAC_TOTAL} Tage frei</Text>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${(yearUsedDays / VAC_TOTAL) * 100}%`, backgroundColor: colors.accent2 }]} />
              </View>
              <View style={{ marginTop: 8, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: colors.accent2 }} />
                    <Text style={{ fontSize: 10, color: colors.muted }}>Genommen</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent2 }}>{yearUsedDays}T</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: colors.green }} />
                    <Text style={{ fontSize: 10, color: colors.muted }}>Verfügbar</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.green }}>{remainingDays}T</Text>
                </View>
              </View>
            </View>
            {/* Gesamtguthaben */}
            <View style={[styles.chartCard, { flex: 1 }]}>
              <Text style={styles.chartLabel}>GESAMTGUTHABEN</Text>
              <Text style={[styles.chartBig, { color: colors.blue }]}>{remainingDays + overtimeDays}</Text>
              <Text style={styles.chartSub}>Tage gesamt</Text>
              {overtimeDays > 0 && (
                <View style={{ marginTop: 8, backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)', borderRadius: 8, padding: 8 }}>
                  <Text style={{ fontSize: 10, color: colors.blue, fontWeight: '700' }}>ÜBERSTUNDEN → URLAUB</Text>
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>
                    {Math.round(overtimeMin / 60 * 10) / 10}h ÷ 8 = +{overtimeDays}T
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Request list */}
          {requests.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Text style={{ fontSize: 32, marginBottom: 12 }}>🏖</Text>
              <Text style={{ color: colors.muted }}>Noch keine Urlaubsanträge.</Text>
            </View>
          ) : (
            requests.map((r: any) => (
              <View key={r.id} style={styles.requestCard}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                    {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>{r.days_count} Tage</Text>
                  {r.reason && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{r.reason}</Text>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[r.status]}20` }]}>
                    <Text style={{ color: STATUS_COLORS[r.status], fontSize: 11, fontWeight: '700' }}>{STATUS_LABELS[r.status]}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(r.id)}>
                    <Text style={{ color: colors.muted, fontSize: 18 }}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* New Request Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>🏖 Urlaubsantrag</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}><Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text></TouchableOpacity>
              </View>

              <Text style={styles.label}>VON (DATUM) — Format: YYYY-MM-DD</Text>
              <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="z.B. 2026-05-01" placeholderTextColor={colors.muted} />

              <Text style={styles.label}>BIS (DATUM) — Format: YYYY-MM-DD</Text>
              <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="z.B. 2026-05-10" placeholderTextColor={colors.muted} />

              {days > 0 && (
                <View style={{ backgroundColor: 'rgba(124,106,247,0.1)', borderWidth: 1, borderColor: 'rgba(124,106,247,0.3)', borderRadius: 10, padding: 12, marginTop: 12 }}>
                  <Text style={{ color: colors.accent2, fontWeight: '700', fontSize: 13 }}>{days} Arbeitstage</Text>
                </View>
              )}

              <Text style={styles.label}>URLAUBSART</Text>
              <TextInput style={styles.input} value={urlaubArt} onChangeText={setUrlaubArt} placeholderTextColor={colors.muted} />

              <Text style={styles.label}>BEMERKUNGEN (OPTIONAL)</Text>
              <TextInput style={styles.input} value={bemerkung} onChangeText={setBemerkung} placeholder="Optional..." placeholderTextColor={colors.muted} />

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={saving}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{saving ? 'Senden...' : '💾 Antrag speichern'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: '#1a1a2e', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { color: colors.accent2, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  addBtn: { backgroundColor: colors.accent, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  chartCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
  chartLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  chartBig: { fontSize: 28, fontWeight: '700' },
  chartSub: { fontSize: 10, color: colors.muted, fontWeight: '700', marginTop: 2 },
  progressBg: { backgroundColor: colors.surface2, borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 4 },
  requestCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14 },
  submitBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
});
