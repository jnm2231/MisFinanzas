import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency } from '@/lib/format';

export type PieSlice = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  data: PieSlice[];
  size?: number;
};

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** Gráfico circular con leyenda, dibujado a mano con react-native-svg. */
export function PieChart({ data, size = 220 }: Props) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const slices = data.filter((s) => s.value > 0);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  if (total <= 0) {
    return (
      <View style={styles.container}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke={palette.border} strokeWidth={2} />
        </Svg>
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          Sin datos que mostrar todavía
        </Text>
      </View>
    );
  }

  let angle = -Math.PI / 2;
  const paths = slices.map((slice, index) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const start = polarToCartesian(cx, cy, r, angle);
    const end = polarToCartesian(cx, cy, r, angle + sweep);
    const largeArc = sweep > Math.PI ? 1 : 0;
    angle += sweep;
    return { d: `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`, color: slice.color, key: index };
  });

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {slices.length === 1 ? (
          <Circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
        ) : (
          paths.map((p) => (
            <Path key={p.key} d={p.d} fill={p.color} stroke={palette.background} strokeWidth={1} />
          ))
        )}
      </Svg>
      <View style={styles.legend}>
        {slices.map((slice, index) => (
          <View key={index} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <Text style={[styles.legendLabel, { color: palette.text }]} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={[styles.legendValue, { color: palette.muted }]}>
              {formatCurrency(slice.value)} · {((slice.value / total) * 100).toFixed(1)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 15,
  },
  legend: {
    alignSelf: 'stretch',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 15,
    flex: 1,
  },
  legendValue: {
    fontSize: 14,
  },
});
