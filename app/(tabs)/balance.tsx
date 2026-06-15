import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '@/components/bar-chart';
import { CategoryBars } from '@/components/category-bars';
import { PeriodCalendar, type CalendarLevel } from '@/components/period-calendar';
import { Colors } from '@/constants/theme';
import {
  deleteTransaction,
  getCategoryTotals,
  getCategoryTotalsForRange,
  getLedgerForRange,
  getMonthlyTotals,
  type CategoryTotal,
  type LedgerEntry,
  type MonthlyTotal,
} from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  formatCurrency,
  formatDayHeading,
  formatFullDate,
  formatMonthYear,
  formatWeekRange,
  getWeekRange,
  mondayIndex,
  monthName,
  monthShortName,
  toDateKey,
  WEEKDAY_LABELS,
} from '@/lib/format';

type Mode = 'dia' | 'semana' | 'mensual' | 'anual';

const MODE_LABELS: { mode: Mode; label: string }[] = [
  { mode: 'dia', label: 'Día' },
  { mode: 'semana', label: 'Semana' },
  { mode: 'mensual', label: 'Mensual' },
  { mode: 'anual', label: 'Anual' },
];

/** Nivel del calendario emergente según el modo del balance. */
const MODE_TO_CALENDAR: Record<Mode, CalendarLevel> = {
  dia: 'dia',
  semana: 'dia',
  mensual: 'mensual',
  anual: 'anual',
};

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

  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [expenseByCategory, setExpenseByCategory] = useState<CategoryTotal[]>([]);
  const [incomeByCategory, setIncomeByCategory] = useState<CategoryTotal[]>([]);

  const week = useMemo(() => getWeekRange(year, month, day), [year, month, day]);

  const load = useCallback(async () => {
    if (mode === 'anual') {
      setMonthlyTotals(await getMonthlyTotals(db, year));
      setTransactions([]);
      setExpenseByCategory(await getCategoryTotals(db, 'gasto', year));
      setIncomeByCategory(await getCategoryTotals(db, 'ingreso', year));
    } else if (mode === 'mensual') {
      const startKey = `${year}-${String(month).padStart(2, '0')}-01`;
      const endKey = toDateKey(new Date(year, month, 1));
      setTransactions(await getLedgerForRange(db, startKey, endKey));
      setMonthlyTotals([]);
      setExpenseByCategory(await getCategoryTotals(db, 'gasto', year, month));
      setIncomeByCategory(await getCategoryTotals(db, 'ingreso', year, month));
    } else if (mode === 'dia') {
      const startKey = toDateKey(new Date(year, month - 1, day));
      const endKey = toDateKey(new Date(year, month - 1, day + 1));
      setTransactions(await getLedgerForRange(db, startKey, endKey));
      setMonthlyTotals([]);
      setExpenseByCategory(await getCategoryTotalsForRange(db, 'gasto', startKey, endKey));
      setIncomeByCategory(await getCategoryTotalsForRange(db, 'ingreso', startKey, endKey));
    } else {
      const w = getWeekRange(year, month, day);
      setTransactions(await getLedgerForRange(db, w.startKey, w.endExclusiveKey));
      setMonthlyTotals([]);
      setExpenseByCategory(await getCategoryTotalsForRange(db, 'gasto', w.startKey, w.endExclusiveKey));
      setIncomeByCategory(await getCategoryTotalsForRange(db, 'ingreso', w.startKey, w.endExclusiveKey));
    }
  }, [db, mode, year, month, day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const movePeriod = (direction: -1 | 1) => {
    if (mode === 'anual') {
      setYear((y) => y + direction);
    } else if (mode === 'dia') {
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + direction);
      setYear(date.getFullYear());
      setMonth(date.getMonth() + 1);
      setDay(date.getDate());
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
      date.setDate(date.getDate() + direction * 7);
      setYear(date.getFullYear());
      setMonth(date.getMonth() + 1);
      setDay(date.getDate());
    }
  };

  const { totalIncome, totalExpense } = useMemo(() => {
    if (mode === 'anual') {
      return {
        totalIncome: monthlyTotals.reduce((sum, m) => sum + m.income, 0),
        totalExpense: monthlyTotals.reduce((sum, m) => sum + m.expense, 0),
      };
    }
    return {
      totalIncome: transactions
        .filter((t) => t.type === 'ingreso')
        .reduce((sum, t) => sum + t.amount, 0),
      totalExpense: transactions
        .filter((t) => t.type === 'gasto')
        .reduce((sum, t) => sum + t.amount, 0),
    };
  }, [mode, transactions, monthlyTotals]);

  const balance = totalIncome - totalExpense;

  /**
   * Movimientos agrupados por día (más reciente primero) con el neto del día.
   * Se usa en los modos día, semana y mensual.
   */
  const dayGroups = useMemo(() => {
    if (mode === 'anual') return [];
    const byDay = new Map<string, LedgerEntry[]>();
    for (const t of transactions) {
      const key = t.date.slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(t);
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, txs]) => {
        const net = txs.reduce(
          (sum, t) => sum + (t.type === 'ingreso' ? t.amount : t.type === 'gasto' ? -t.amount : 0),
          0
        );
        return { key, txs, net };
      });
  }, [mode, transactions]);

  /**
   * Datos del gráfico de barras según el modo:
   *  - semana: una barra por día de la semana (lunes-domingo).
   *  - mensual: una barra por día del mes.
   *  - anual: una barra por mes del año.
   */
  const bars = useMemo(() => {
    if (mode === 'semana') {
      const arr = WEEKDAY_LABELS.map((label) => ({ label, income: 0, expense: 0 }));
      for (const t of transactions) {
        const [y, m, d] = t.date.slice(0, 10).split('-').map(Number);
        const idx = mondayIndex(new Date(y, m - 1, d));
        if (t.type === 'ingreso') arr[idx].income += t.amount;
        else if (t.type === 'gasto') arr[idx].expense += t.amount;
      }
      return arr;
    }
    if (mode === 'mensual') {
      const daysInMonth = new Date(year, month, 0).getDate();
      const arr = Array.from({ length: daysInMonth }, (_, i) => ({
        label: String(i + 1),
        income: 0,
        expense: 0,
      }));
      for (const t of transactions) {
        const d = Number(t.date.slice(8, 10));
        if (t.type === 'ingreso') arr[d - 1].income += t.amount;
        else if (t.type === 'gasto') arr[d - 1].expense += t.amount;
      }
      return arr;
    }
    if (mode === 'anual') {
      const arr = Array.from({ length: 12 }, (_, i) => ({
        label: monthShortName(i + 1),
        income: 0,
        expense: 0,
      }));
      for (const mt of monthlyTotals) {
        arr[mt.month - 1].income = mt.income;
        arr[mt.month - 1].expense = mt.expense;
      }
      return arr;
    }
    return [];
  }, [mode, transactions, monthlyTotals, year, month]);

  const periodLabel =
    mode === 'dia'
      ? formatFullDate(year, month, day)
      : mode === 'semana'
        ? formatWeekRange(week.monday, week.sunday)
        : mode === 'mensual'
          ? formatMonthYear(year, month)
          : String(year);

  const confirmDelete = (tx: LedgerEntry) => {
    const label =
      tx.type === 'gasto' ? 'gasto' : tx.type === 'ingreso' ? 'ingreso' : 'transferencia';
    Alert.alert(
      'Eliminar movimiento',
      `¿Eliminar esta operación (${label}) de ${formatCurrency(tx.amount)}? El saldo de las cuentas se revertirá.`,
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

  const toggleNote = (id: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderRow = (tx: LedgerEntry) => {
    if (tx.type === 'transferencia') return renderTransferRow(tx);
    const hasNote = !!tx.note && tx.note.trim() !== '';
    const noteOpen = expandedNotes.has(tx.id);
    return (
      <View key={tx.id} style={[styles.row, { borderBottomColor: palette.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowCategory, { color: palette.text }]}>
            {tx.category_name ?? 'Sin categoría'}
          </Text>
          <Text style={[styles.rowDate, { color: palette.muted }]}>{tx.date.slice(11, 16)}</Text>
          <Text style={[styles.rowAccount, { color: palette.muted }]}>
            {tx.account_name} · saldo {formatCurrency(tx.balance_after)}
          </Text>
          {hasNote && (
            <Pressable style={styles.noteToggle} hitSlop={6} onPress={() => toggleNote(tx.id)}>
              <MaterialCommunityIcons name="comment-text-outline" size={14} color={palette.tint} />
              <Text style={[styles.noteToggleText, { color: palette.tint }]}>
                {noteOpen ? 'Ocultar comentario' : 'Comentario'}
              </Text>
            </Pressable>
          )}
          {hasNote && noteOpen && (
            <Text style={[styles.rowNote, { color: palette.muted }]}>{tx.note}</Text>
          )}
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
  };

  const renderTransferRow = (tx: LedgerEntry) => (
    <View key={tx.id} style={[styles.row, { borderBottomColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.transferTitleRow}>
          <MaterialCommunityIcons name="swap-horizontal" size={16} color={palette.tint} />
          <Text style={[styles.rowCategory, { color: palette.text }]}>Transferencia</Text>
        </View>
        <Text style={[styles.rowDate, { color: palette.muted }]}>{tx.date.slice(11, 16)}</Text>
        <Text style={[styles.rowAccount, { color: palette.muted }]}>
          {tx.account_name} → {tx.to_account_name}
        </Text>
        <Text style={[styles.rowAccount, { color: palette.muted }]}>
          {tx.account_name}: {formatCurrency(tx.balance_after)} · {tx.to_account_name}:{' '}
          {tx.to_balance_after !== null ? formatCurrency(tx.to_balance_after) : '—'}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: palette.tint }]}>{formatCurrency(tx.amount)}</Text>
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

        {/* Selector Semana / Mensual / Anual */}
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

        {/* Gráfico de barras con ejes (ingresos arriba, gastos abajo) */}
        {mode !== 'dia' && (
          <View style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.listTitle, { color: palette.text }]}>
              {mode === 'anual' ? 'Ingresos y gastos por mes' : 'Ingresos y gastos por día'}
            </Text>
            <BarChart
              bars={bars}
              emptyText={
                mode === 'anual' ? 'Sin movimientos este año.' : 'Sin movimientos en este periodo.'
              }
            />
          </View>
        )}

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
        ) : dayGroups.length === 0 ? (
          <View style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Sin movimientos en este periodo
            </Text>
          </View>
        ) : (
          dayGroups.map((group) => (
            <View
              key={group.key}
              style={[styles.dayCard, { backgroundColor: palette.card, borderColor: palette.tint }]}>
              <View style={styles.dayCardHeader}>
                <Text style={[styles.dayCardTitle, { color: palette.text }]}>
                  {formatDayHeading(group.key)}
                </Text>
                <Text
                  style={[
                    styles.dayCardNet,
                    { color: group.net >= 0 ? palette.success : palette.danger },
                  ]}>
                  {group.net >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(group.net))}
                </Text>
              </View>
              {group.txs.map(renderRow)}
            </View>
          ))
        )}
      </ScrollView>

      <PeriodCalendar
        visible={calendarVisible}
        level={MODE_TO_CALENDAR[mode]}
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
  dayCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  dayCardNet: {
    fontSize: 15,
    fontWeight: '700',
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
  rowAccount: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  transferTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  noteToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowNote: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
    fontStyle: 'italic',
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
