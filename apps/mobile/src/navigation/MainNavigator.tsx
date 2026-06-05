import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TrackerScreen } from '../screens/TrackerScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { SalaryScreen } from '../screens/SalaryScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VacationScreen } from '../screens/VacationScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

// "Mehr" (More) menüsü için basit bir ekran
function MoreScreen({ navigation }: any) {
  const items = [
    { label: '🏖 Urlaubsanträge', screen: 'VacationStack' },
    { label: '📋 Berichte & Export', screen: 'ReportsStack' },
    { label: '⚙️ Einstellungen', screen: 'SettingsStack' },
  ];

  return (
    <View style={styles.moreContainer}>
      <View style={styles.moreHeader}>
        <Text style={styles.brand}>WORKLY</Text>
        <Text style={styles.moreTitle}>Weitere Funktionen</Text>
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        {items.map(item => (
          <TouchableOpacity key={item.screen} style={styles.moreItem}
            onPress={() => navigation.navigate(item.screen)}>
            <Text style={styles.moreItemText}>{item.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Stack navigators for nested screens inside "Mehr"
const VStack = createNativeStackNavigator();
function VacationStack() {
  return (
    <VStack.Navigator screenOptions={{ headerShown: false }}>
      <VStack.Screen name="VacationMain" component={VacationScreen} />
    </VStack.Navigator>
  );
}

const RStack = createNativeStackNavigator();
function ReportsStack() {
  return (
    <RStack.Navigator screenOptions={{ headerShown: false }}>
      <RStack.Screen name="ReportsMain" component={ReportsScreen} />
    </RStack.Navigator>
  );
}

const SStack = createNativeStackNavigator();
function SettingsStack() {
  return (
    <SStack.Navigator screenOptions={{ headerShown: false }}>
      <SStack.Screen name="SettingsMain" component={ProfileScreen} />
    </SStack.Navigator>
  );
}

// More navigator
const MoreStack = createNativeStackNavigator();
function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreMain" component={MoreScreen} />
      <MoreStack.Screen name="VacationStack" component={VacationStack} />
      <MoreStack.Screen name="ReportsStack" component={ReportsStack} />
      <MoreStack.Screen name="SettingsStack" component={SettingsStack} />
    </MoreStack.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent2,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tab.Screen name="Tracker" component={TrackerScreen}
        options={{ tabBarLabel: 'Tracker', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⏱️</Text> }} />
      <Tab.Screen name="Calendar" component={CalendarScreen}
        options={{ tabBarLabel: 'Kalender', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📅</Text> }} />
      <Tab.Screen name="Scan" component={ScanScreen}
        options={{ tabBarLabel: 'Scan', tabBarIcon: () => (
          <View style={styles.scanIcon}><Text style={{ color: '#fff', fontSize: 16 }}>📷</Text></View>
        )}} />
      <Tab.Screen name="Salary" component={SalaryScreen}
        options={{ tabBarLabel: 'Gehalt', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>💰</Text> }} />
      <Tab.Screen name="More" component={MoreNavigator}
        options={{ tabBarLabel: 'Mehr', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☰</Text> }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  scanIcon: { backgroundColor: colors.accent, padding: 8, borderRadius: 20, marginBottom: 2 },
  moreContainer: { flex: 1, backgroundColor: colors.bg },
  moreHeader: { backgroundColor: '#1a1a2e', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { color: colors.accent2, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  moreTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 12 },
  moreItem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moreItemText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
