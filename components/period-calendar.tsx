import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { getDailyNets, getMonthlyNets, getYearlyNets } from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCompactNet, monthName, monthShortName } from '@/lib/format';

export type CalendarLevel = 'dia' | 'mensual' | 'anual';

export type PeriodSelection = {
  year: number;
  month?: number;
  day?: number;
};

type ViewMode = 'day' | 'month' | 'year';

type Props = {
  visible: boolean;
  /** Qué se está eligiendo: un día, un mes o un año. Determina dónde acaba la selección. */
  level: CalendarLevel;
  initial: { year: number; month: number; day: number };
  onSelect: (selection: PeriodSelection) => void;
  onClose: () => void;
};

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const LEVEL_TO_VIEW: Record<CalendarLevel, ViewMode> = {
  dia: 'day',
  mensual: 'month',
  anual: 'year',
};

/**
 * Calendario emergente para elegir el periodo del Balance.
 * Cada celda (día, mes o año) muestra su balance neto (ingresos - gastos).
 * Tocando el título se sube de nivel (mes -> año); tocando una celda se baja
 * o se selecciona, según el `level` pedido.
 */
export function PeriodCalendar({ visible, level, initial, onSelect, onClose }: Props) {
  const db = useSQLiteContext();
  const palette = Colors[useColorScheme() ?? 'light'];

  const [viewMode, setViewMode] = useState<ViewMode>(LEVEL_TO_VIEW[level]);
  const [displayYear, setDisplayYear] = useState(initial.year);
  const [displayMonth, setDisplayMonth] = useState(initial.month);
  const [nets, setNets] = useState<Map<number, number>>(new Map());
  const [yearList, setYearList] = useState<number[]>([]);

  const todayDate = new Date();
  const todayYear = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth() + 1;
  const todayDay = todayDate.getDate();

  // Al abrir, vuelve al periodo actual y al nivel que corresponde.
  useEffect(() => {
    if (visible) {
      setViewMode(LEVEL_TO_VIEW[level]);
      setDisplayYear(initial.year);
      setDisplayMonth(initial.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      if (viewMode === 'day') {
        setNets(await getDailyNets(db, displayYear, displayMonth));
      } else if (viewMode === 'month') {
        setNets(await getMonthlyNets(db, displayYear));
      } else {
        const yearNets = await getYearlyNets(db);
        setNets(yearNets);
        const currentYear = new Date().getFullYear();
        const years = [...yearNets.keys(), currentYear, initial.year];
        const min = Math.min(...years);
        const max = Math.max(...years);
        const list: number[] = [];
        for (let y = min; y <= max; y++) list.push(y);
        setYearList(list);
      }
    })();
  }, [db, visible, viewMode, displayYear, displayMonth, initial.year]);

  const netColor = (net: number | undefined) =>
    net === undefined || net === 0 ? palette.muted : net > 0 ? palette.success : palette.danger;

  const moveHeader = (direction: -1 | 1) => {
    if (viewMode === 'day') {
      let m = displayMonth + direction;
      let y = displayYear;
      if (m === 0) {
        m = 12;
        y--;
      } else if (m === 13) {
        m = 1;
        y++;
      }
      setDisplayMonth(m);
      setDisplayYear(y);
    } else if (viewMode === 'month') {
      setDisplayYear((y) => y + direction);
    }
  };

  const handleTitlePress = () => {
    if (viewMode === 'day') setViewMode('month');
    else if (viewMode === 'month') setViewMode('year');
  };

  const handleMonthPress = (month: number) => {
    if (level === 'mensual') {
      onSelect({ year: displayYear, month });
    } else {
      setDisplayMonth(month);
      setViewMode('day');
    }
  };

  const handleYearPress = (year: number) => {
    if (level === 'anual') {
      onSelect({ year });
    } else {
      setDisplayYear(year);
      setViewMode('month');
    }
  };

  const HeaderBtn = ({ direction }: { direction: -1 | 1 }) => (
    <Pressable
      hitSlop={8}
      onPress={() => moveHeader(direction)}
      style={[styles.navBtn, { backgroundColor: palette.card }]}>
      <MaterialCommunityIcons
        name={direction === -1 ? 'chevron-left' : 'chevron-right'}
        size={26}
        color={palette.text}
      />
    </Pressable>
  );

  const renderDayGrid = () => {
    const daysInMonth = new Date(displayYear, displayMonth, 0).getDate();
    const firstWeekday = (new Date(displayYear, displayMonth - 1, 1).getDay() + 6) % 7;
    const cells: (number | null)[] = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    return (
      <>
        <View style={styles.grid}>
          {WEEKDAYS.map((d) => (
            <View key={d} style={styles.dayCell}>
              <Text style={[styles.weekday, { color: palette.muted }]}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, index) => {
            if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const isSelected =
              day === initial.day && displayMonth === initial.month && displayYear === initial.year;
            const isToday =
              day === todayDay && displayMonth === todayMonth && displayYear === todayYear;
            return (
              <View key={day} style={styles.dayCell}>
                <Pressable
                  style={[
                    styles.cellBox,
                    { backgroundColor: palette.card, borderColor: palette.border },
                    isToday && { borderColor: palette.tint, borderWidth: 1.5 },
                    isSelected && { backgroundColor: palette.tint, borderColor: palette.tint },
                  ]}
                  onPress={() => onSelect({ year: displayYear, month: displayMonth, day })}>
                  <Text
                    style={[
                      styles.cellNumber,
                      { color: isSelected ? palette.background : palette.text },
                    ]}>
                    {day}
                  </Text>
                  {/* Línea de neto siempre presente (espacio si no hay) para alinear los números */}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.cellNet,
                      { color: isSelected ? palette.background : netColor(nets.get(day)) },
                    ]}>
                    {nets.has(day) ? formatCompactNet(nets.get(day)!) : ' '}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  const renderMonthGrid = () => (
    <View style={styles.grid}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
        const isSelected = month === initial.month && displayYear === initial.year;
        const isCurrent = month === todayMonth && displayYear === todayYear;
        return (
          <View key={month} style={styles.monthCell}>
            <Pressable
              style={[
                styles.cellBox,
                { backgroundColor: palette.card, borderColor: palette.border },
                isCurrent && { borderColor: palette.tint, borderWidth: 1.5 },
                isSelected && { backgroundColor: palette.tint, borderColor: palette.tint },
              ]}
              onPress={() => handleMonthPress(month)}>
              <Text
                style={[styles.cellLabel, { color: isSelected ? palette.background : palette.text }]}>
                {monthShortName(month)}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.cellNet,
                  { color: isSelected ? palette.background : netColor(nets.get(month)) },
                ]}>
                {nets.has(month) ? formatCompactNet(nets.get(month)!) : ' '}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  const renderYearGrid = () => (
    <View style={styles.grid}>
      {yearList.map((year) => {
        const isSelected = year === initial.year;
        const isCurrent = year === todayYear;
        return (
          <View key={year} style={styles.monthCell}>
            <Pressable
              style={[
                styles.cellBox,
                { backgroundColor: palette.card, borderColor: palette.border },
                isCurrent && { borderColor: palette.tint, borderWidth: 1.5 },
                isSelected && { backgroundColor: palette.tint, borderColor: palette.tint },
              ]}
              onPress={() => handleYearPress(year)}>
              <Text
                style={[styles.cellLabel, { color: isSelected ? palette.background : palette.text }]}>
                {year}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.cellNet,
                  { color: isSelected ? palette.background : netColor(nets.get(year)) },
                ]}>
                {nets.has(year) ? formatCompactNet(nets.get(year)!) : ' '}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  const title =
    viewMode === 'day'
      ? `${monthName(displayMonth)} ${displayYear}`
      : viewMode === 'month'
        ? String(displayYear)
        : 'Selecciona un año';

  const subtitle =
    level === 'dia'
      ? 'Elige un día'
      : level === 'mensual'
        ? 'Elige un mes'
        : 'Elige un año';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.border }]}
          onPress={() => {}}>
          <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>
          <View style={styles.header}>
            {viewMode !== 'year' ? <HeaderBtn direction={-1} /> : <View style={styles.navBtn} />}
            <Pressable
              onPress={handleTitlePress}
              disabled={viewMode === 'year'}
              style={styles.titleButton}>
              <Text style={[styles.headerTitle, { color: palette.text }]}>{title}</Text>
              {viewMode !== 'year' && (
                <MaterialCommunityIcons name="chevron-down" size={18} color={palette.muted} />
              )}
            </Pressable>
            {viewMode !== 'year' ? <HeaderBtn direction={1} /> : <View style={styles.navBtn} />}
          </View>

          {viewMode === 'day' && renderDayGrid()}
          {viewMode === 'month' && renderMonthGrid()}
          {viewMode === 'year' && renderYearGrid()}

          <Pressable style={styles.closeRow} onPress={onClose}>
            <Text style={[styles.closeText, { color: palette.tint }]}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 12,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    flexBasis: `${100 / 7}%`,
    maxWidth: `${100 / 7}%`,
    aspectRatio: 0.72,
    padding: 2,
  },
  monthCell: {
    flexBasis: '25%',
    maxWidth: '25%',
    aspectRatio: 1.2,
    padding: 4,
  },
  cellBox: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  weekday: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  cellNumber: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 19,
  },
  cellLabel: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
    lineHeight: 19,
  },
  cellNet: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  closeRow: {
    alignItems: 'center',
    paddingTop: 4,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
