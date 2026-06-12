import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agregar',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={26} name="plus-minus-variant" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="balance"
        options={{
          title: 'Balance',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={26} name="format-list-bulleted" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cuentas"
        options={{
          title: 'Cuentas',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={26} name="bank" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="patrimonio"
        options={{
          title: 'Patrimonio',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={26} name="chart-pie" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inversiones"
        options={{
          title: 'Inversiones',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={26} name="chart-line" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={26} name="cog" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
