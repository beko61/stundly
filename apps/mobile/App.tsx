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

  useEffect(() => {
    // Tek listener — INITIAL_SESSION mount sonrası, SIGNED_IN/OUT/TOKEN_REFRESHED sonrası tetiklenir.
    // signOut() sonrası gelecek SIGNED_OUT event'inde blocked state'i SİLMİYORUZ ki Alert görünsün.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setLoading(false);

      if (event === 'SIGNED_OUT' || !s?.user) {
        setSession(null);
        return; // blocked korunur
      }

      // Gate: SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, deleted_at')
        .eq('user_id', s.user.id)
        .single();

      if (profile?.deleted_at) {
        setBlocked('deleted');
        void supabase.auth.signOut(); // SIGNED_OUT trigger, yukarıda blocked korunur
        return;
      }
      if (profile?.is_active === false) {
        setBlocked('inactive');
        void supabase.auth.signOut();
        return;
      }

      setSession(s);
      setBlocked(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Blocked mesajını Alert ile bir kez göster
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
