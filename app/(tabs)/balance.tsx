import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { type Transaction } from '@/db/database';
import { deleteTransaction, getTransactionsForPeriod } from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, formatMonthYear, formatShortDate } from '@/lib/format';

type Mode = 'mensual' | 'anual';

export default function BalanceScreen() {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const today = new Date();
  const [mode, setMode] = useState<Mode>('mensual');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    const rows = await getTransactionsForPeriod(
      db,
      year,
      mode === 'mensual' ? month : undefined
    );
    setTransactions(rows);
  }, [db, year, month, mode]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const movePeriod = (direction: -1 | 1) => {
    if (mode === 'anual') {
      setYear((y) => y + direction);
      return;
    }
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth === 0) {
      newMonth = 12;
      newYear--;
    } else if (newMonth === 13) {
      newMonth = 1;
      newYear++;
    }
    setMonth(newMonth);
    setYear(newYear);
  };

  const { incomes, expenses, totalIncome, totalExpense } = useMemo(() => {
    const incomes = transactions.filter((t) => t.type === 'ingreso');
    const expenses = transactions.filter((t) => t.type === 'gasto');
    return {
      incomes,
      expenses,
      totalIncome: incomes.reduce((sum, t) => sum + t.amount, 0),
      totalExpense: expenses.reduce((sum, t) => sum + t.amount, 0),
    };
  }, [transactions]);

  const balance = totalIncome - totalExpense;

  const confirmDelete = (tx: Transaction) => {
    Alert.alert(
      'Eliminar movimiento',
      `¿Eliminar este ${tx.type} de ${formatCurrency(tx.amount)}? El saldo de la cuenta se revertirá.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(db, tx.id);
            await load();
          },
        },
      ]
    );
  };

  const renderRow = (tx: Transaction) => (
    <View key={tx.id} style={[styles.row, { borderBottomColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowCategory, { color: palette.text }]}>
          {tx.category_name ?? 'Sin categoría'}
        </Text>
        <Text style={[styles.rowDate, { color: palette.muted }]}>{formatShortDate(tx.date)}</Text>
      </View>
      <Text
        style={[
          styles.rowAmount,
          { color: tx.type === 'gasto' ? palette.danger : palette.success },
        ]}>
        {tx.type === 'gasto' ? '-' : '+'}
        {formatCurrency(tx.amount)}
      </Text>
      <Pressable hitSlop={8} onPress={() => confirmDelete(tx)}>
        <MaterialCommunityIcons name="trash-can-outline" size={20} color={palette.muted} />
      </Pressable>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={[styles.title, { color: palette.text }]}>Balance</Text>

      {/* Selector Mensual / Anual */}
      <View style={[styles.segment, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {(['mensual', 'anual'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.segmentItem, mode === m && { backgroundColor: palette.tint }]}
            onPress={() => setMode(m)}>
            <Text
              style={[
                styles.segmentText,
                { color: mode === m ? palette.background : palette.text },
              ]}>
              {m === 'mensual' ? 'Mensual' : 'Anual'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Navegación de periodo */}
      <View style={styles.periodNav}>
        <Pressable hitSlop={8} onPress={() => movePeriod(-1)}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={palette.text} />
        </Pressable>
        <Text style={[styles.periodLabel, { color: palette.text }]}>
          {mode === 'mensual' ? formatMonthYear(year, month) : String(year)}
        </Text>
        <Pressable hitSlop={8} onPress={() => movePeriod(1)}>
          <MaterialCommunityIcons name="chevron-right" size={28} color={palette.text} />
        </Pressable>
      </View>

      {/* Resumen */}
      <View style={[styles.summary, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: palette.muted }]}>Ingresos</Text>
          <Text style={[styles.summaryValue, { color: palette.success }]}>
            {formatCurrency(totalIncome)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: palette.muted }]}>Gastos</Text>
          <Text style={[styles.summaryValue, { color: palette.danger }]}>
            {formatCurrency(totalExpense)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: palette.muted }]}>Balance</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: balance >= 0 ? palette.success : palette.danger },
            ]}>
            {formatCurrency(balance)}
          </Text>
        </View>
      </View>

      {/* Listados */}
      <View style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.listTitle, { color: palette.success }]}>Ingresos</Text>
        {incomes.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.muted }]}>
            Sin ingresos en este periodo
          </Text>
        ) : (
          incomes.map(renderRow)
        )}
      </View>

      <View style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.listTitle, { color: palette.danger }]}>Gastos</Text>
        {expenses.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.muted }]}>
            Sin gastos en este periodo
          </Text>
        ) : (
          expenses.map(renderRow)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodLabel: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  summary: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowCategory: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowDate: {
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 8,
  },
});
