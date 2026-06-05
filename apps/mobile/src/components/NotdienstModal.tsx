import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { calculateWorkDuration, formatDuration } from '@workly/shared';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

export interface NotdienstEntry {
  id: string; user_id: string; date: string;
  start_time: string; end_time: string;
  note: string | null; kunde: string | null;
  adresse: string | null; problem: string | null;
  ergebnis: string | null; erledigt: boolean;
}

const PRESETS: [string, string, string][] = [
  ['16:30','17:30','16:30–17:30'], ['17:00','18:00','17:00–18:00'],
  ['17:00','19:00','17:00–19:00'], ['18:00','20:00','18:00–20:00'],
  ['20:00','22:00','20:00–22:00'], ['06:00','08:00','06:00–08:00'],
  ['08:00','12:00','Sa 08–12'],    ['08:00','16:00','Sa/So 08–16'],
];

interface Props {
  visible: boolean;
  date: string;
  entry?: NotdienstEntry | null;
  onSave: (entry: NotdienstEntry) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function NotdienstModal({ visible, date, entry, onSave, onDelete, onClose }: Props) {
  const [start, setStart] = useState(entry?.start_time ?? '17:00');
  const [end, setEnd] = useState(entry?.end_time ?? '18:00');
  const [kunde, setKunde] = useState(entry?.kunde ?? '');
  const [adresse, setAdresse] = useState(entry?.adresse ?? '');
  const [problem, setProblem] = useState(entry?.problem ?? '');
  const [ergebnis, setErgebnis] = useState(entry?.ergebnis ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setStart(entry?.start_time ?? '17:00');
      setEnd(entry?.end_time ?? '18:00');
      setKunde(entry?.kunde ?? '');
      setAdresse(entry?.adresse ?? '');
      setProblem(entry?.problem ?? '');
      setErgebnis(entry?.ergebnis ?? '');
      setNote(entry?.note ?? '');
    }
  }, [entry, visible]);

  const duration = start && end ? formatDuration(calculateWorkDuration(start, end, 0).net_minutes) : '--';

  function openMaps() {
    if (!adresse.trim()) return;
    const q = encodeURIComponent(adresse.trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  }

  async function handleSave() {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const payload = {
      user_id: session.user.id, date, start_time: start, end_time: end,
      note: note || null, kunde: kunde || null, adresse: adresse || null,
      problem: problem || null, ergebnis: ergebnis || null,
      erledigt: entry?.erledigt ?? false,
    };

    if (entry) {
      const { data } = await supabase.from('notdienst_entries').update(payload).eq('id', entry.id).select().single();
      if (data) onSave(data as NotdienstEntry);
    } else {
      const { data } = await supabase.from('notdienst_entries').insert(payload).select().single();
      if (data) onSave(data as NotdienstEntry);
    }
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!entry) return;
    await supabase.from('notdienst_entries').delete().eq('id', entry.id);
    onDelete?.(entry.id);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.title, { color: colors.orange }]}>🚨 Notdienst</Text>
                <Text style={styles.date}>{date}</Text>
              </View>
              <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>

            {/* Kunde */}
            <Text style={styles.label}>KUNDE (NAME, STOCKWERK)</Text>
            <TextInput style={styles.input} value={kunde} onChangeText={setKunde}
              placeholder="z.B. Frau Ermakov, 2. OG rechts" placeholderTextColor={colors.muted} />

            {/* Adresse + Maps */}
            <Text style={styles.label}>ADRESSE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={adresse} onChangeText={setAdresse}
                placeholder="z.B. Kniestraße 22, 30519 Hannover" placeholderTextColor={colors.muted} />
              <TouchableOpacity onPress={openMaps} style={styles.mapsBtn}>
                <Text style={{ fontSize: 16 }}>📍</Text>
              </TouchableOpacity>
            </View>

            {/* Problem */}
            <Text style={styles.label}>PROBLEM</Text>
            <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} multiline
              value={problem} onChangeText={setProblem}
              placeholder="z.B. Die WC-Spülung ist undicht..." placeholderTextColor={colors.muted} />

            {/* Ergebnis */}
            <Text style={styles.label}>ERGEBNIS / FESTSTELLUNGEN</Text>
            <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} multiline
              value={ergebnis} onChangeText={setErgebnis}
              placeholder="Vor Ort wurde festgestellt..." placeholderTextColor={colors.muted} />

            {/* Schnellauswahl */}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 14 }}>
              <Text style={styles.label}>⏰ SCHNELLAUSWAHL</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {PRESETS.map(([s, e, label]) => (
                  <TouchableOpacity key={`${s}-${e}`} onPress={() => { setStart(s); setEnd(e); }}
                    style={[styles.presetBtn, start === s && end === e && styles.presetBtnActive]}>
                    <Text style={{ color: colors.orange, fontSize: 11 }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>START</Text>
                  <TextInput style={styles.input} value={start} onChangeText={setStart} placeholderTextColor={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>ENDE</Text>
                  <TextInput style={styles.input} value={end} onChangeText={setEnd} placeholderTextColor={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>DAUER</Text>
                  <View style={[styles.input, { justifyContent: 'center' }]}>
                    <Text style={{ color: colors.orange }}>{duration}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Notiz */}
            <Text style={styles.label}>NOTIZ (OPTIONAL)</Text>
            <TextInput style={styles.input} value={note} onChangeText={setNote}
              placeholder="Kurze Notiz..." placeholderTextColor={colors.muted} />

            {/* Speichern */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{saving ? 'Speichern...' : '💾 Speichern'}</Text>
            </TouchableOpacity>

            {entry && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13 }}>🗑 Eintrag löschen</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: colors.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '800' },
  date: { fontSize: 12, color: colors.muted, marginTop: 2 },
  closeBtn: { color: colors.muted, fontSize: 20, padding: 6 },
  label: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 13 },
  mapsBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.green, borderRadius: 10, padding: 12, justifyContent: 'center' },
  presetBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.orange, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 8 },
  presetBtnActive: { backgroundColor: 'rgba(251,146,60,0.2)' },
  saveBtn: { backgroundColor: colors.orange, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  deleteBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 10 },
});
