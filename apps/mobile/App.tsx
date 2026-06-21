import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';
import { MainNavigator } from './src/navigation/MainNavigator';
import { colors } from './src/theme/colors';

type BlockedReason = 'deleted' | 'inactive' | null;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<BlockedReason>(null);

  // Soft-delete / deaktiviert gate — session değiştiğinde profile.deleted_at + is_active çek.
  // Gate fail → signOut + reason göster.
  async function gateSession(s: Session | null): Promise<{ session: Session | null; blocked: BlockedReason }> {
    if (!s?.user) return { session: null, blocked: null };
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active, deleted_at')
      .eq('user_id', s.user.id)
      .single();
    if (profile?.deleted_at) {
      await supabase.auth.signOut();
      return { session: null, blocked: 'deleted' };
    }
    if (profile?.is_active === false) {
      await supabase.auth.signOut();
      return { session: null, blocked: 'inactive' };
    }
    return { session: s, blocked: null };
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      const r = await gateSession(s);
      setSession(r.session);
      setBlocked(r.blocked);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      const r = await gateSession(s);
      setSession(r.session);
      setBlocked(r.blocked);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login sonrası blocked mesajını göster (Alert) — bir kez
  useEffect(() => {
    if (blocked === 'deleted') {
      Alert.alert(
        'Konto gelöscht',
        'Dein Konto wurde gelöscht. Bitte wende dich an deinen Administrator.',
      );
    } else if (blocked === 'inactive') {
      Alert.alert(
        'Konto deaktiviert',
        'Dein Konto ist deaktiviert. Bitte wende dich an deinen Administrator.',
      );
    }
  }, [blocked]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <LoginScreen />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <NavigationContainer>
      <MainNavigator />
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
