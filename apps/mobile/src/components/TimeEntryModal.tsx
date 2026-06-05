import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { DAY_TYPES, DAY_TYPE_LABELS } from '@workly/shared';
import type { DayType } from '@workly/shared';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

const DAY_TYPE_OPTIONS = (Object.entries(DAY_TYPE_LABELS) as [DayType, string][])
  .filter(([type]) => type !== DAY_TYPES.URLAUB);

function getDefaults(dayOfWeek: number, existing?: any, feiertag?: string) {
  if (existing) {
    return {
      dayType:      existing.day_type,
      startTime:    existing.start_time  ?? '07:45',
      endTime:      existing.end_time    ?? '17:00',
      breakMinutes: String(existing.break_minutes ?? 60),
      isNightShift: existing.is_night_shift,
      note:         existing.note ?? '',
    };
  }
  const isFriday  = dayOfWeek === 5;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return {
    dayType:      (isWeekend || feiertag) ? (feiertag ? DAY_TYPES.FEIERTAG : DAY_TYPES.FREI) : DAY_TYPES.ARBEITEN as DayType,
    startTime:    '07:45',
    endTime:      isFriday ? '14:30' : '17:00',
    breakMinutes: isFriday ? '30' : '60',
    isNightShift: false,
    note:         '',
  };
}

interface Props {
  visible: boolean;
  date: string;
  dayOfWeek: number;
  feiertag?: string;
  entry?: any;
  onSave: () => void;
  onClose: () => void;
}

export function TimeEntryModal({ visible, date, dayOfWeek, feiertag, entry, onSave, onClose }: Props) {
  const defaults = getDefaults(dayOfWeek, entry, feiertag);

  const [dayType,      setDayType]      = useState<DayType>(defaults.dayType);
  const [startTime,    setStartTime]    = useState(defaults.startTime);
  const [endTime,      setEndTime]      = useState(defaults.endTime);
  const [breakMinutes, setBreakMinutes] = useState(defaults.breakMinutes);
  const [isNightShift, setIsNightShift] = useState(defaults.isNightShift);
  const [note,         setNote]         = useState(defaults.note);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const needsTime = dayType === DAY_TYPES.ARBEITEN || dayType === DAY_TYPES.NOTDIENST;
  const autoTime  = dayType === DAY_TYPES.KRANK || dayType === DAY_TYPES.FEIERTAG;

  // Reset form when entry changes
  React.useEffect(() => {
    const d = getDefaults(dayOfWeek, entry, feiertag);
    setDayType(d.dayType);
    setStartTime(d.startTime);
    setEndTime(d.endTime);
    setBreakMinutes(d.breakMinutes);
    setIsNightShift(d.isNightShift);
    setNote(d.note);
    setError(null);
  }, [entry, visible]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setSaving(false); return; }

    const payload = {
      user_id:        session.user.id,
      date,
      day_type:       dayType,
      start_time:     needsTime ? startTime : autoTime ? '08:00' : null,
      end_time:       needsTime ? endTime   : autoTime ? '17:00' : null,
      break_minutes:  needsTime ? parseInt(breakMinutes) || 0 : autoTime ? 60 : 0,
      is_night_shift: isNightShift,
      note:           note || null,
      tags:           [],
    };

    let result;
    if (entry) {
      result = await supabase.from('time_entries').update(payload).eq('id', entry.id);
    } else {
      result = await supabase.from('time_entries').insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSave();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{entry ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen'}</Text>
                <Text style={styles.date}>{date}</Text>
              </View>
              <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>

            {/* Day Type */}
            <Text style={styles.label}>TYP</Text>
            <View style={styles.typeRow}>
              {DAY_TYPE_OPTIONS.map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setDayType(value)}
                  style={[styles.typeBtn, dayType === value && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, dayType === value && styles.typeBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time Inputs */}
            {needsTime && (
              <>
                <View style={styles.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>BEGINN</Text>
                    <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="07:45" placeholderTextColor={colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>ENDE</Text>
                    <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="17:00" placeholderTextColor={colors.muted} />
                  </View>
                </View>

                <Text style={styles.label}>PAUSE (MINUTEN)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={breakMinutes} onChangeText={setBreakMinutes} placeholderTextColor={colors.muted} />

                <View style={styles.switchRow}>
                  <Text style={{ color: colors.text, fontSize: 13 }}>Nachtschicht</Text>
                  <Switch value={isNightShift} onValueChange={setIsNightShift} trackColor={{ true: colors.accent }} thumbColor={colors.white} />
                </View>
              </>
            )}

            <Text style={styles.label}>NOTIZ (OPTIONAL)</Text>
            <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Kurze Notiz..." placeholderTextColor={colors.muted} />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Speichern...' : 'Speichern'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  date: { fontSize: 12, color: colors.muted, marginTop: 2 },
  closeBtn: { color: colors.muted, fontSize: 20, padding: 6 },
  label: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 16 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  typeBtnActive: { borderColor: colors.accent, backgroundColor: 'rgba(124,106,247,0.2)' },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  typeBtnTextActive: { color: colors.accent2 },
  timeRow: { flexDirection: 'row', gap: 12 },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  error: { color: colors.red, fontSize: 13, backgroundColor: 'rgba(248,113,113,0.1)', padding: 12, borderRadius: 8, marginTop: 12 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
