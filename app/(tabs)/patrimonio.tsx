import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PieChart, type PieSlice } from '@/components/pie-chart';
import { Colors } from '@/constants/theme';
import { type Account, type Investment } from '@/db/database';
import { getAccounts, getInvestments } from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency } from '@/lib/format';

const SLICE_COLORS = [
  '#4C9AFF', '#36B37E', '#FFAB00', '#FF5630', '#6554C0',
  '#00B8D9', '#FF8B00', '#998DD9', '#57D9A3', '#C0B6F2',
];

const INVESTMENT_TYPE_LABELS: Record<Investment['type'], string> = {
  fondo: 'Fondos',
  etf: 'ETFs',
  accion: 'Acciones',
};

export default function PatrimonioScreen() {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  const load = useCallback(async () => {
    setAccounts(await getAccounts(db));
    setInvestments(await getInvestments(db));
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
