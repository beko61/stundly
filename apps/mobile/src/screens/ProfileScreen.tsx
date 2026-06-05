import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

interface Profile {
  vorname: string; nachname: string; personal_nr: string;
  eintrittsdatum: string; abteilung: string; vorgesetzter: string;
  email: string; company_name: string; bundesland: string;
}

const EMPTY: Profile = {
  vorname: '', nachname: '', personal_nr: '', eintrittsdatum: '',
  abteilung: '', vorgesetzter: '', email: '', company_name: '', bundesland: 'NI',
};

const BUNDESLAENDER: Record<string, string> = {
  BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg',
  HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen', MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz',
  SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein', TH: 'Thüringen',
};

export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }
    const { data } = await supabase.from('profiles')
      .select('vorname,nachname,personal_nr,eintrittsdatum,abteilung,vorgesetzter,email,company_name,bundesland')
      .eq('user_id', session.user.id).single();
    if (data) {
      setProfile({
        vorname: data.vorname ?? '', nachname: data.nachname ?? '',
        personal_nr: data.personal_nr ?? '', eintrittsdatum: data.eintrittsdatum ?? '',
        abteilung: data.abteilung ?? '', vorgesetzter: data.vorgesetzter ?? '',
        email: data.email ?? session.user.email ?? '',
        company_name: data.company_name ?? '', bundesland: data.bundesland ?? 'NI',
      });
    } else {
      setProfile(p => ({ ...p, email: session.user?.email ?? '' }));
    }
    setLoading(false);
  }

  function set(key: keyof Profile, val: string) {
    setProfile(p => ({ ...p, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from('profiles').upsert({ user_id: session.user.id, ...profile }, { onConflict: 'user_id' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );

  const field = (label: string, key: keyof Profile, placeholder?: string) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={profile[key]} onChangeText={v => set(key, v)}
        placeholder={placeholder} placeholderTextColor={colors.muted} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>STUNDLY</Text>
        <Text style={styles.headerTitle}>Einstellungen</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Firmendaten */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🏢 FIRMENDATEN</Text>
          {field('Firmenname', 'company_name', 'z.B. Muster GmbH')}
          <Text style={styles.label}>BUNDESLAND (FÜR FEIERTAGE)</Text>
          <View style={styles.blGrid}>
            {Object.entries(BUNDESLAENDER).map(([code, name]) => (
              <TouchableOpacity key={code} onPress={() => set('bundesland', code)}
                style={[styles.blBtn, profile.bundesland === code && styles.blBtnActive]}>
                <Text style={[styles.blBtnText, profile.bundesland === code && { color: '#fff' }]}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {profile.bundesland && (
            <Text style={{ fontSize: 11, color: colors.accent2, marginTop: 6 }}>
              ✓ {BUNDESLAENDER[profile.bundesland]}
            </Text>
          )}
        </View>

        {/* Mitarbeiterdaten */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👤 MITARBEITERDATEN</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>{field('Vorname', 'vorname', 'Yusuf')}</View>
            <View style={{ flex: 1 }}>{field('Nachname', 'nachname', 'Bektas')}</View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>{field('Personal-Nr.', 'personal_nr', '0034')}</View>
            <View style={{ flex: 1 }}>{field('Eintrittsdatum', 'eintrittsdatum', '19.10.2022')}</View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>{field('Abteilung', 'abteilung', 'Montageteil')}</View>
            <View style={{ flex: 1 }}>{field('Vorgesetzte/r', 'vorgesetzter', 'Aydin Bektas')}</View>
          </View>
          {field('E-Mail', 'email', 'name@example.de')}
        </View>

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
            {saved ? '✅ Gespeichert!' : saving ? 'Speichern...' : '💾 Einstellungen speichern'}
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => supabase.auth.signOut()}>
          <Text style={{ color: colors.red, fontWeight: '700', fontSize: 14 }}>🚪 Abmelden</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', fontSize: 10, color: colors.muted, paddingTop: 4 }}>Stundly Mobile v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: '#1a1a2e', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { color: colors.accent2, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 12 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  sectionTitle: { fontSize: 11, color: colors.muted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  label: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14 },
  blGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  blBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  blBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  blBtnText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
  logoutBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: `${colors.red}15` },
});
