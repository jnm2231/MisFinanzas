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
  /** Qué se está eligiendo: un día, un mes o un año. Determina dónde termina la selección. */
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
          {cells.map((day, index) =>
            day === null ? (
              <View key={`blank-${index}`} style={styles.dayCell} />
            ) : (
              <Pressable
                key={day}
                style={[styles.dayCell, styles.cellBox, { borderColor: palette.border }]}
                onPress={() => onSelect({ year: displayYear, month: displayMonth, day })}>
                <Text style={[styles.cellNumber, { color: palette.text }]}>{day}</Text>
                {nets.has(day) && (
                  <Text style={[styles.cellNet, { color: netColor(nets.get(day)) }]}>
                    {formatCompactNet(nets.get(day)!)}
                  </Text>
                )}
              </Pressable>
            )
          )}
        </View>
      </>
    );
  };

  const renderMonthGrid = () => (
    <View style={styles.grid}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
        <Pressable
          key={month}
          style={[styles.monthCell, styles.cellBox, { borderColor: palette.border }]}
          onPress={() => handleMonthPress(month)}>
          <Text style={[styles.cellLabel, { color: palette.text }]}>{monthShortName(month)}</Text>
          {nets.has(month) && (
            <Text style={[styles.cellNet, { color: netColor(nets.get(month)) }]}>
              {formatCompactNet(nets.get(month)!)}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );

  const renderYearGrid = () => (
    <View style={styles.grid}>
      {yearList.map((year) => (
        <Pressable
          key={year}
          style={[styles.monthCell, styles.cellBox, { borderColor: palette.border }]}
          onPress={() => handleYearPress(year)}>
          <Text style={[styles.cellLabel, { color: palette.text }]}>{year}</Text>
          {nets.has(year) && (
            <Text style={[styles.cellNet, { color: netColor(nets.get(year)) }]}>
              {formatCompactNet(nets.get(year)!)}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );

  const title =
    viewMode === 'day'
      ? `${monthName(displayMonth)} ${displayYear}`
      : viewMode === 'month'
        ? String(displayYear)
        : 'Selecciona un año';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.border }]}
          onPress={() => {}}>
          <View style={styles.header}>
            {viewMode !== 'year' ? (
              <Pressable hitSlop={8} onPress={() => moveHeader(-1)}>
                <MaterialCommunityIcons name="chevron-left" size={26} color={palette.text} />
              </Pressable>
            ) : (
              <View style={{ width: 26 }} />
            )}
            <Pressable onPress={handleTitlePress} disabled={viewMode === 'year'}>
              <Text style={[styles.headerTitle, { color: palette.text }]}>
                {title}
                {viewMode !== 'year' && (
                  <Text style={{ color: palette.muted }}>  ▾</Text>
                )}
              </Text>
            </Pressable>
            {viewMode !== 'year' ? (
              <Pressable hitSlop={8} onPress={() => moveHeader(1)}>
                <MaterialCommunityIcons name="chevron-right" size={26} color={palette.text} />
              </Pressable>
            ) : (
              <View style={{ width: 26 }} />
            )}
          </View>

          {viewMode === 'day' && renderDayGrid()}
          {viewMode === 'month' && renderMonthGrid()}
          {viewMode === 'year' && renderYearGrid()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    flexBasis: `${100 / 7}%`,
    maxWidth: `${100 / 7}%`,
    aspectRatio: 0.95,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1,
  },
  monthCell: {
    flexBasis: '25%',
    maxWidth: '25%',
    aspectRatio: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  cellBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  weekday: {
    fontSize: 12,
    fontWeight: '700',
  },
  cellNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  cellLabel: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cellNet: {
    fontSize: 10,
    fontWeight: '600',
  },
});
