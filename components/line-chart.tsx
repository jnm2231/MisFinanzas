import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency } from '@/lib/format';

export type LinePoint = {
  label: string;
  value: number;
};

type Props = {
  points: LinePoint[];
  height?: number;
};

/** Gráfico de líneas sencillo (react-native-svg) para la evolución del patrimonio. */
export function LineChart({ points, height = 180 }: Props) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const [width, setWidth] = useState(0);

  if (points.length < 2) {
    return (
      <Text style={[styles.emptyText, { color: palette.muted }]}>
        Aún no hay suficiente histórico. El gráfico se irá construyendo a medida que uses la app.
      </Text>
    );
  }

  const PAD_X = 8;
  const PAD_Y = 14;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.abs(max) || 1;

  const chartWidth = Math.max(width - PAD_X * 2, 1);
  const chartHeight = height - PAD_Y * 2;
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;

  const coords = points.map((p, index) => ({
    x: PAD_X + index * stepX,
    y: PAD_Y + chartHeight - ((p.value - min) / range) * chartHeight,
  }));
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPoints = `${polylinePoints} ${coords[coords.length - 1].x},${PAD_Y + chartHeight} ${coords[0].x},${PAD_Y + chartHeight}`;

  const first = points[0];
  const last = points[points.length - 1];
  const middle = points[Math.floor((points.length - 1) / 2)];

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.rangeRow}>
        <Text style={[styles.rangeText, { color: palette.muted }]}>
          Mín: {formatCurrency(min)}
        </Text>
        <Text style={[styles.rangeText, { color: palette.muted }]}>
          Máx: {formatCurrency(max)}
        </Text>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line
                key={f}
                x1={PAD_X}
                y1={PAD_Y + chartHeight * f}
                x2={width - PAD_X}
                y2={PAD_Y + chartHeight * f}
                stroke={palette.border}
                strokeWidth={StyleSheet.hairlineWidth}
              />
            ))}
            <Polygon points={areaPoints} fill={palette.tint} opacity={0.12} />
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={palette.tint}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.length <= 24 &&
              coords.map((c, index) => (
                <Circle key={index} cx={c.x} cy={c.y} r={3} fill={palette.tint} />
              ))}
          </Svg>
        )}
      </View>
      <View style={styles.labelsRow}>
        <Text style={[styles.axisLabel, { color: palette.muted }]}>{first.label}</Text>
        {points.length > 2 && middle !== first && middle !== last && (
          <Text style={[styles.axisLabel, { color: palette.muted }]}>{middle.label}</Text>
        )}
        <Text style={[styles.axisLabel, { color: palette.muted }]}>{last.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    fontSize: 14,
    paddingVertical: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeText: {
    fontSize: 12,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: 12,
  },
});
