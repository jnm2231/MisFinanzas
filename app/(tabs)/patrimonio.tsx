import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LineChart, type LinePoint } from '@/components/line-chart';
import { PieChart, type PieSlice } from '@/components/pie-chart';
import { Colors } from '@/constants/theme';
import { type Account, type Investment, type NetWorthSnapshot } from '@/db/database';
import {
  getAccounts,
  getInvestments,
  getNetWorthSnapshots,
  recordNetWorthSnapshot,
} from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, monthShortName } from '@/lib/format';

const SLICE_COLORS = [
  '#4C9AFF', '#36B37E', '#FFAB00', '#FF5630', '#6554C0',
  '#00B8D9', '#FF8B00', '#998DD9', '#57D9A3', '#C0B6F2',
];

const INVESTMENT_TYPE_LABELS: Record<Investment['type'], string> = {
  fondo: 'Fondos',
  etf: 'ETFs',
  accion: 'Acciones',
};

type RangeKey = '1S' | '1M' | '6M' | '1A' | '2A' | '5A';

/** Rangos del gráfico de evolución. `days` es la ventana hacia atrás desde hoy. */
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '1S', label: '1 sem', days: 7 },
  { key: '1M', label: '1 mes', days: 31 },
  { key: '6M', label: '6 meses', days: 183 },
  { key: '1A', label: '1 año', days: 366 },
  { key: '2A', label: '2 años', days: 731 },
  { key: '5A', label: '5 años', days: 1827 },
];

/** "2026-06-15" para una fecha local. */
function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function PatrimonioScreen() {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [range, setRange] = useState<RangeKey>('1M');

  const load = useCallback(async () => {
    // Cada visita registra la foto del día para ir construyendo el histórico.
    await recordNetWorthSnapshot(db);
    setAccounts(await getAccounts(db));
    setInvestments(await getInvestments(db));
    setSnapshots(await getNetWorthSnapshots(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const { slices, cashTotal, investedTotal } = useMemo(() => {
    const cashTotal = accounts.reduce((sum, a) => sum + a.balance, 0);
    const investedTotal = investments.reduce((sum, i) => sum + i.current_value, 0);

    const slices: PieSlice[] = [];
    let colorIndex = 0;
    const nextColor = () => SLICE_COLORS[colorIndex++ % SLICE_COLORS.length];

    for (const account of accounts) {
      if (account.balance > 0) {
        slices.push({ label: account.name, value: account.balance, color: nextColor() });
      }
    }
    for (const type of ['fondo', 'etf', 'accion'] as const) {
      const total = investments
        .filter((i) => i.type === type)
        .reduce((sum, i) => sum + i.current_value, 0);
      if (total > 0) {
        slices.push({ label: INVESTMENT_TYPE_LABELS[type], value: total, color: nextColor() });
      }
    }
    return { slices, cashTotal, investedTotal };
  }, [accounts, investments]);

  const total = cashTotal + investedTotal;

  /**
   * Puntos del gráfico de evolución para el rango elegido.
   *
   * Se filtran las fotos del patrimonio a la ventana del rango (última semana,
   * mes, año...). Si no hay datos para cubrir todo el rango se muestra solo el
   * histórico disponible. En rangos cortos (semana/mes) se dibuja día a día; en
   * rangos largos se agrupa por mes (último valor de cada mes).
   */
  const evolutionPoints = useMemo<LinePoint[]>(() => {
    if (snapshots.length === 0) return [];

    const rangeDef = RANGES.find((r) => r.key === range)!;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDef.days);
    const cutoffKey = toDateKey(cutoff);
    const filtered = snapshots.filter((s) => s.date >= cutoffKey);
    if (filtered.length === 0) return [];

    // Rangos cortos: día a día. Rangos largos: un punto por mes.
    if (rangeDef.days <= 31) {
      return filtered.map((s) => ({
        label: `${Number(s.date.slice(8, 10))}/${Number(s.date.slice(5, 7))}`,
        value: s.total,
      }));
    }
    const lastPerMonth = new Map<string, NetWorthSnapshot>();
    for (const s of filtered) lastPerMonth.set(s.date.slice(0, 7), s);
    return [...lastPerMonth.values()].map((s) => ({
      label: `${monthShortName(Number(s.date.slice(5, 7)))} ${s.date.slice(2, 4)}`,
      value: s.total,
    }));
  }, [snapshots, range]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={[styles.title, { color: palette.text }]}>Patrimonio</Text>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <PieChart data={slices} />
      </View>

      <View style={styles.totalBlock}>
        <Text style={[styles.totalLabel, { color: palette.muted }]}>Patrimonio Total</Text>
        <Text style={[styles.totalValue, { color: palette.text }]}>{formatCurrency(total)}</Text>
      </View>

      {/* Evolución temporal */}
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.breakdownLabel, { color: palette.text }]}>
          📊 Evolución del Patrimonio
        </Text>
        <View style={styles.rangeSelector}>
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[
                  styles.rangeChip,
                  { borderColor: active ? palette.tint : palette.border },
                  active && { backgroundColor: palette.tint },
                ]}>
                <Text
                  style={[
                    styles.rangeChipText,
                    { color: active ? palette.background : palette.muted },
                  ]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <LineChart points={evolutionPoints} baselineZero />
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.breakdownRow}>
          <Text style={[styles.breakdownLabel, { color: palette.text }]}>💶 Efectivo en cuentas</Text>
          <Text style={[styles.breakdownValue, { color: palette.text }]}>
            {formatCurrency(cashTotal)}
          </Text>
        </View>
        {accounts.map((account) => (
          <View key={account.id} style={styles.breakdownSubRow}>
            <Text style={[styles.breakdownSubLabel, { color: palette.muted }]}>{account.name}</Text>
            <Text style={[styles.breakdownSubValue, { color: palette.muted }]}>
              {formatCurrency(account.balance)}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.breakdownRow}>
          <Text style={[styles.breakdownLabel, { color: palette.text }]}>📈 Dinero invertido</Text>
          <Text style={[styles.breakdownValue, { color: palette.text }]}>
            {formatCurrency(investedTotal)}
          </Text>
        </View>
        {investments.map((inv) => (
          <View key={inv.id} style={styles.breakdownSubRow}>
            <Text style={[styles.breakdownSubLabel, { color: palette.muted }]} numberOfLines={1}>
              {inv.name}
            </Text>
            <Text style={[styles.breakdownSubValue, { color: palette.muted }]}>
              {formatCurrency(inv.current_value)}
            </Text>
          </View>
        ))}
        {investments.length === 0 && (
          <Text style={[styles.breakdownSubLabel, { color: palette.muted }]}>
            Sin inversiones todavía
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  totalBlock: {
    alignItems: 'center',
    gap: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  rangeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 2,
  },
  rangeChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  rangeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  breakdownSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 12,
  },
  breakdownSubLabel: {
    fontSize: 14,
    flex: 1,
  },
  breakdownSubValue: {
    fontSize: 14,
  },
});
