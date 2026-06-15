import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { DATABASE_NAME, initDatabase } from '@/db/database';
import { recordNetWorthSnapshot } from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';

async function onDatabaseInit(db: Parameters<typeof initDatabase>[0]) {
  await initDatabase(db);
  // Registra la foto diaria del patrimonio para el gráfico de evolución.
  await recordNetWorthSnapshot(db);
}

export const unstable_settings = {
  anchor: '(tabs)',
};

function LoadingFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={<LoadingFallback />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={onDatabaseInit} useSuspense>
          <Stack
            screenOptions={{
              // Fija el fondo de la escena al del tema para evitar el flash blanco
              // del navegador durante las transiciones.
              contentStyle: { backgroundColor: palette.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="patch-notes"
              options={{
                headerShown: true,
                title: 'Notas de versión',
                headerStyle: { backgroundColor: palette.background },
                headerTintColor: palette.tint,
                headerTitleStyle: { color: palette.text },
                headerShadowVisible: false,
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
