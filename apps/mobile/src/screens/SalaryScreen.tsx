import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { calculateMonthlySalary, formatDuration } from '@workly/shared';
import type { TimeEntry, SalarySettings } from '@workly/shared';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_S = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

const DEFAULT_SETTINGS: SalarySettings = {
  id: 'local', user_id: 'local', valid_from: '',
  hourly_rate: 15, overtime_rate_multiplier: 1.25,
  night_shift_bonus: 3, notdienst_bonus: 50, monthly_target_hours: 174,
};

interface MonthRecord { id: string; user_id: string; year: number; month: number; brutto: number; netto: number; note: string | null; }

export function SalaryScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<any[]>([]);
  const [records, setRecords] = useState<MonthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SalarySettings>(DEFAULT_SETTINGS);

  // Record modal
  const [recordModal, setRecordModal] = useState(false);
  const [mBrutto, setMBrutto] = useState('');
  const [mNetto, setMNetto] = useState('');
  const [mNote, setMNote] = useState('');
  const [mSaving, setMSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from('salary_settings').select('*')
        .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setSettings({
          id: data.id, user_id: data.user_id, valid_from: data.valid_from,
          hourly_rate: Number(data.hourly_rate), overtime_rate_multiplier: Number(data.overtime_rate_multiplier),
          night_shift_bonus: Number(data.night_shift_bonus), notdienst_bonus: Number(data.notdienst_bonus),
          monthly_target_hours: Number(data.monthly_target_hours),
        });
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const [{ data: te }, { data: rec }] = await Promise.all([
        supabase.from('time_entries').select('*').eq('user_id', session.user.id).gte('date', startDate).lte('date', endDate),
        supabase.from('salary_records').select('*').eq('user_id', session.user.id).eq('year', year).order('month'),
      ]);
      if (te) setEntries(te);
      if (rec) setRecords(rec as MonthRecord[]);
      setLoading(false);
    }
    load();
  }, [year, month]);

  const breakdown = useMemo(() => calculateMonthlySalary(entries as TimeEntry[], settings), [entries, settings]);
  const fmtEur = (n: number) => `€ ${n.toFixed(2)}`;
  const yearlyBrutto = records.reduce((s, r) => s + r.brutto, 0);
  const yearlyNetto = records.reduce((s, r) => s + r.netto, 0);
  const curRecord = records.find(r => r.month === month);

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  function openRecordModal() {
    setMBrutto(curRecord ? String(curRecord.brutto) : String(breakdown.total_gross.toFixed(2)));
    setMNetto(curRecord ? String(curRecord.netto) : '');
    setMNote(curRecord?.note ?? '');
    setRecordModal(true);
  }

  async function saveRecord() {
    setMSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMSaving(false); return; }
    const payload = { user_id: session.user.id, year, month, brutto: parseFloat(mBrutto) || 0, netto: parseFloat(mNetto) || 0, note: mNote || null };
    if (curRecord) {
      await supabase.from('salary_records').update(payload).eq('id', curRecord.id);
      setRecords(prev => prev.map(r => r.month === month ? { ...r, ...payload } as MonthRecord : r));
    } else {
      const { data } = await supabase.from('salary_records').insert(payload).select().single();
      if (data) setRecords(prev => [...prev, data as MonthRecord].sort((a, b) => a.month - b.month));
    }
    setMSaving(false);
    setRecordModal(false);
  }

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
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}><Text style={styles.navBtnText}>‹</Text></TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[month - 1]}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}><Text style={styles.navBtnText}>›</Text></TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }} showsVerticalScrollIndicator={false}>
          {/* Salary breakdown */}
          <View style={[styles.card, { borderTopWidth: 3, borderTopColor: colors.accent2 }]}>
            <Text style={styles.cardLabel}>💰 Gehaltsberechnung — {MONTHS[month - 1]}</Text>
            {[
              { label: 'Gearbeitete Stunden', value: formatDuration(Math.round(breakdown.worked_hours * 60)) },
              { label: 'Grundgehalt', value: fmtEur(breakdown.base_pay) },
              { label: 'Überstundenvergütung', value: fmtEur(breakdown.overtime_pay) },
              { label: 'Nachtzuschlag', value: fmtEur(breakdown.night_shift_bonus) },
              { label: 'Notdienst-Bonus', value: fmtEur(breakdown.notdienst_bonus) },
            ].map(({ label, value }) => (
              <View key={label} style={styles.breakdownRow}>
                <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
                <Text style={styles.breakdownVal}>{value}</Text>
              </View>
            ))}
            <View style={[styles.breakdownRow, { borderBottomWidth: 0, paddingTop: 12 }]}>
              <Text style={{ fontWeight: '700', color: colors.text }}>Brutto Gesamt</Text>
              <Text style={styles.totalVal}>{fmtEur(breakdown.total_gross)}</Text>
            </View>
          </View>

          {/* Settings Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>⚙️ Einstellungen</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'Stundenlohn (€)', key: 'hourly_rate' as const, val: String(settings.hourly_rate) },
                { label: 'Sollstunden', key: 'monthly_target_hours' as const, val: String(settings.monthly_target_hours) },
                { label: 'ÜS-Multiplikator', key: 'overtime_rate_multiplier' as const, val: String(settings.overtime_rate_multiplier) },
                { label: 'Nachtzuschlag (€)', key: 'night_shift_bonus' as const, val: String(settings.night_shift_bonus) },
                { label: 'Notdienst-Bonus (€)', key: 'notdienst_bonus' as const, val: String(settings.notdienst_bonus) },
              ].map(f => (
                <View key={f.key} style={{ width: '47%' }}>
                  <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '600', marginBottom: 4 }}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 13 }]}
                    keyboardType="decimal-pad"
                    value={f.val}
                    onChangeText={(v) => setSettings(s => ({ ...s, [f.key]: parseFloat(v) || 0 }))}
                    placeholderTextColor={colors.muted}
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.actionBtn, { marginTop: 12, alignSelf: 'flex-end' }]}
              onPress={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;
                await supabase.from('salary_settings').upsert({
                  user_id: session.user.id,
                  hourly_rate: settings.hourly_rate,
                  overtime_rate_multiplier: settings.overtime_rate_multiplier,
                  night_shift_bonus: settings.night_shift_bonus,
                  notdienst_bonus: settings.notdienst_bonus,
                  monthly_target_hours: settings.monthly_target_hours,
                  valid_from: new Date().toISOString().split('T')[0],
                }, { onConflict: 'user_id' });
              }}>
              <Text style={styles.actionBtnText}>💾 Speichern</Text>
            </TouchableOpacity>
          </View>

          {/* Monthly record */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.cardLabel}>🧾 Abrechnung {MONTHS[month - 1]}</Text>
              <TouchableOpacity onPress={openRecordModal} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>{curRecord ? '✏️ Bearbeiten' : '+ Eintragen'}</Text>
              </TouchableOpacity>
            </View>
            {curRecord ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { label: 'BRUTTO', val: `€ ${curRecord.brutto.toFixed(2)}`, color: colors.green },
                  { label: 'NETTO', val: `€ ${curRecord.netto.toFixed(2)}`, color: colors.blue },
                  { label: 'STEUER', val: `€ ${(curRecord.brutto - curRecord.netto).toFixed(2)}`, color: colors.red },
                ].map(c => (
                  <View key={c.label} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700', marginBottom: 4 }}>{c.label}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '500', color: c.color }}>{c.val}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ textAlign: 'center', padding: 16, color: colors.muted, fontSize: 13 }}>Noch keine Abrechnung eingetragen.</Text>
            )}
          </View>

          {/* Yearly overview */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>📊 Jahresübersicht {year}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Brutto', val: `€ ${yearlyBrutto.toFixed(0)}`, color: colors.green },
                { label: 'Netto', val: `€ ${yearlyNetto.toFixed(0)}`, color: colors.blue },
                { label: 'Steuer', val: `€ ${(yearlyBrutto - yearlyNetto).toFixed(0)}`, color: colors.red },
              ].map(c => (
                <View key={c.label} style={{ flex: 1, alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10, padding: 10 }}>
                  <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700', marginBottom: 4 }}>{c.label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: c.color }}>{c.val}</Text>
                </View>
              ))}
            </View>
            {/* Monthly bars */}
            {records.length === 0 ? (
              <Text style={{ textAlign: 'center', fontSize: 12, color: colors.muted, padding: 12 }}>Noch keine Einträge für {year}.</Text>
            ) : (
              Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const rec = records.find(r => r.month === m);
                const yearlyMax = Math.max(...records.map(r => r.brutto), 1);
                const bPct = rec ? Math.round((rec.brutto / yearlyMax) * 100) : 0;
                const nPct = rec ? Math.round((rec.netto / yearlyMax) * 100) : 0;
                return (
                  <View key={m} style={{ marginBottom: 7, opacity: rec ? 1 : 0.35 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ color: m === month ? colors.accent2 : colors.muted, fontWeight: '700', fontSize: 11, width: 28 }}>{MONTHS_S[i]}</Text>
                      {rec ? (
                        <Text style={{ fontSize: 10, color: colors.muted }}>B: €{rec.brutto.toFixed(0)} · N: €{rec.netto.toFixed(0)}</Text>
                      ) : (
                        <Text style={{ fontSize: 10, color: colors.muted }}>—</Text>
                      )}
                    </View>
                    <View style={{ height: 8, backgroundColor: colors.surface2, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <View style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${bPct}%`, backgroundColor: colors.green, borderRadius: 4 }} />
                      <View style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${nPct}%`, backgroundColor: colors.blue, borderRadius: 4, opacity: 0.6 }} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Record Modal */}
      <Modal visible={recordModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>🧾 {MONTHS[month - 1]} {year}</Text>
              <TouchableOpacity onPress={() => setRecordModal(false)}><Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>BRUTTO ERHALTEN (€)</Text>
                <TextInput style={styles.input} keyboardType="decimal-pad" value={mBrutto} onChangeText={setMBrutto} placeholder="z.B. 2500.00" placeholderTextColor={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>NETTO ERHALTEN (€)</Text>
                <TextInput style={styles.input} keyboardType="decimal-pad" value={mNetto} onChangeText={setMNetto} placeholder="z.B. 1800.00" placeholderTextColor={colors.muted} />
              </View>
            </View>
            <Text style={styles.modalLabel}>NOTIZ (OPTIONAL)</Text>
            <TextInput style={styles.input} value={mNote} onChangeText={setMNote} placeholder="z.B. Bonus..." placeholderTextColor={colors.muted} />
            <TouchableOpacity style={styles.saveBtn} onPress={saveRecord} disabled={mSaving || !mBrutto}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{mSaving ? 'Speichern...' : '💾 Speichern'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: '#1a1a2e', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brand: { color: colors.accent2, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { color: colors.text, fontSize: 18 },
  monthTitle: { fontSize: 26, fontWeight: '800', color: colors.text, flex: 1, textAlign: 'center' },
  yearBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8 },
  yearBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  yearBtnText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  cardLabel: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  breakdownVal: { fontSize: 13, color: colors.text },
  totalVal: { fontSize: 20, fontWeight: '500', color: colors.accent2 },
  actionBtn: { backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 20, borderWidth: 1, borderColor: colors.border },
  modalLabel: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
});
