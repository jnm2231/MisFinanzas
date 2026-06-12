import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBars } from '@/components/category-bars';
import { PeriodCalendar, type CalendarLevel } from '@/components/period-calendar';
import { Colors } from '@/constants/theme';
import { type Transaction } from '@/db/database';
import {
  deleteTransaction,
  getCategoryTotals,
  getMonthlyTotals,
  getTransactionsForPeriod,
  type CategoryTotal,
  type MonthlyTotal,
} from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  formatCurrency,
  formatFullDate,
  formatMonthYear,
  formatShortDate,
  monthName,
} from '@/lib/format';

type Mode = CalendarLevel; // 'dia' | 'mensual' | 'anual'

const MODE_LABELS: { mode: Mode; label: string }[] = [
  { mode: 'dia', label: 'Día' },
  { mode: 'mensual', label: 'Mensual' },
  { mode: 'anual', label: 'Anual' },
];

export default function BalanceScreen() {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const today = new Date();
  const [mode, setMode] = useState<Mode>('mensual');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [day, setDay] = useState(today.getDate());
  const [calendarVisible, setCalendarVisible] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<CategoryTotal[]>([]);
  const [incomeByCategory, setIncomeByCategory] = useState<CategoryTotal[]>([]);

  const load = useCallback(async () => {
    const m = mode === 'anual' ? undefined : month;
    const d = mode === 'dia' ? day : undefined;

    if (mode === 'anual') {
      setMonthlyTotals(await getMonthlyTotals(db, year));
      setTransactions([]);
    } else {
      setTransactions(await getTransactionsForPeriod(db, year, m, d));
      setMonthlyTotals([]);
    }
    setExpenseByCategory(await getCategoryTotals(db, 'gasto', year, m, d));
    setIncomeByCategory(await getCategoryTotals(db, 'ingreso', year, m, d));
  }, [db, mode, year, month, day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const movePeriod = (direction: -1 | 1) => {
    if (mode === 'anual') {
      setYear((y) => y + direction);
    } else if (mode === 'mensual') {
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
    } else {
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + direction);
      setYear(date.getFullYear());
      setMonth(date.getMonth() + 1);
      setDay(date.getDate());
    }
  };

  const { incomes, expenses, totalIncome, totalExpense } = useMemo(() => {
    if (mode === 'anual') {
      return {
        incomes: [],
        expenses: [],
        totalIncome: monthlyTotals.reduce((sum, m) => sum + m.income, 0),
        totalExpense: monthlyTotals.reduce((sum, m) => sum + m.expense, 0),
      };
    }
    const incomes = transactions.filter((t) => t.type === 'ingreso');
    const expenses = transactions.filter((t) => t.type === 'gasto');
    return {
      incomes,
      expenses,
      totalIncome: incomes.reduce((sum, t) => sum + t.amount, 0),
      totalExpense: expenses.reduce((sum, t) => sum + t.amount, 0),
    };
  }, [mode, transactions, monthlyTotals]);

  const balance = totalIncome - totalExpense;

  const periodLabel =
    mode === 'dia'
      ? formatFullDate(year, month, day)
      : mode === 'mensual'
        ? formatMonthYear(year, month)
        : String(year);

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
        <Text style={[styles.rowDate, { color: palette.muted }]}>
          {mode === 'dia' ? tx.date.slice(11, 16) : formatShortDate(tx.date)}
        </Text>
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

  const renderMonthRow = (item: MonthlyTotal) => {
    const net = item.income - item.expense;
    return (
      <View key={item.month} style={[styles.row, { borderBottomColor: palette.border }]}>
        <Text style={[styles.rowCategory, { color: palette.text, flex: 1, textTransform: 'capitalize' }]}>
          {monthName(item.month)}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.monthAmounts}>
            <Text style={[styles.monthAmount, { color: palette.success }]}>
              +{formatCurrency(item.income)}
            </Text>
            <Text style={[styles.monthAmount, { color: palette.danger }]}>
              -{formatCurrency(item.expense)}
            </Text>
          </View>
          <Text
            style={[
              styles.rowAmount,
              { color: net >= 0 ? palette.success : palette.danger },
            ]}>
            = {formatCurrency(net)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: palette.text }]}>Balance</Text>

        {/* Selector Día / Mensual / Anual */}
        <View style={[styles.segment, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {MODE_LABELS.map(({ mode: m, label }) => (
            <Pressable
              key={m}
              style={[styles.segmentItem, mode === m && { backgroundColor: palette.tint }]}
              onPress={() => setMode(m)}>
              <Text
                style={[
                  styles.segmentText,
                  { color: mode === m ? palette.background : palette.text },
                ]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Navegación de periodo: flechas + etiqueta que abre el calendario */}
        <View style={styles.periodNav}>
          <Pressable hitSlop={8} onPress={() => movePeriod(-1)}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={palette.text} />
          </Pressable>
          <Pressable style={styles.periodButton} onPress={() => setCalendarVisible(true)}>
            <MaterialCommunityIcons name="calendar-month" size={18} color={palette.tint} />
            <Text style={[styles.periodLabel, { color: palette.text }]}>{periodLabel}</Text>
          </Pressable>
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

        {/* Desglose visual por categoría */}
        <CategoryBars title="Gastos por categoría" items={expenseByCategory} barColor={palette.danger} />
        <CategoryBars title="Ingresos por categoría" items={incomeByCategory} barColor={palette.success} />

        {/* Listados */}
        {mode === 'anual' ? (
          <View style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.listTitle, { color: palette.text }]}>Resumen por mes</Text>
            {monthlyTotals.length === 0 ? (
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                Sin movimientos en este año
              </Text>
            ) : (
              monthlyTotals.map(renderMonthRow)
            )}
          </View>
        ) : (
          <>
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
          </>
        )}
      </ScrollView>

      <PeriodCalendar
        visible={calendarVisible}
        level={mode}
        initial={{ year, month, day }}
        onClose={() => setCalendarVisible(false)}
        onSelect={(selection) => {
          setYear(selection.year);
          if (selection.month !== undefined) setMonth(selection.month);
          if (selection.day !== undefined) setDay(selection.day);
          setCalendarVisible(false);
        }}
      />
    </View>
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
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  periodLabel: {
    fontSize: 17,
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
  monthAmounts: {
    flexDirection: 'row',
    gap: 10,
  },
  monthAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 8,
  },
});
