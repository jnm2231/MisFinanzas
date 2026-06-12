import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { type CategoryTotal } from '@/db/queries';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency } from '@/lib/format';

type Props = {
  title: string;
  items: CategoryTotal[];
  barColor: string;
};

/** Barras horizontales con el desglose por categoría de un periodo. */
export function CategoryBars({ title, items, barColor }: Props) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const total = items.reduce((sum, item) => sum + item.total, 0);

  if (items.length === 0 || total <= 0) return null;

  const max = Math.max(...items.map((item) => item.total));

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: barColor }]}>{title}</Text>
      {items.map((item, index) => {
        const pct = (item.total / total) * 100;
        return (
          <View key={index} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>
                {item.category_name ?? 'Sin categoría'}
              </Text>
              <Text style={[styles.amount, { color: palette.muted }]}>
                {formatCurrency(item.total)} · {pct.toFixed(1)}%
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: palette.background }]}>
              <View
                style={[
                  styles.bar,
                  { backgroundColor: barColor, width: `${(item.total / max) * 100}%` },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  amount: {
    fontSize: 13,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
});
