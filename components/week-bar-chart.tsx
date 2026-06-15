import { Fragment, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCompactNet } from '@/lib/format';

export type WeekDayBar = {
  label: string;
  income: number;
  expense: number;
};

type Props = {
  days: WeekDayBar[];
  height?: number;
};

/**
 * Gráfico de barras de la semana con ejes.
 *   - Eje X: días de la semana (lunes a domingo).
 *   - Eje Y: dinero. Los ingresos son barras verdes por encima de 0 y los
 *     gastos barras rojas por debajo de 0.
 * La escala es simétrica respecto al 0 usando la mayor magnitud de la semana.
 */
export function WeekBarChart({ days, height = 200 }: Props) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const [width, setWidth] = useState(0);

  const maxMagnitude = Math.max(
    1,
    ...days.map((d) => d.income),
    ...days.map((d) => d.expense)
  );
  const hasData = days.some((d) => d.income > 0 || d.expense > 0);

  const PAD_TOP = 14;
  const PAD_BOTTOM = 20; // espacio para las etiquetas de los días
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const zeroY = PAD_TOP + plotHeight / 2;
  const halfHeight = plotHeight / 2;

  const colWidth = width / days.length;
  const barWidth = Math.min(26, colWidth * 0.5);

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.success }]} />
          <Text style={[styles.legendText, { color: palette.muted }]}>Ingresos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.danger }]} />
          <Text style={[styles.legendText, { color: palette.muted }]}>Gastos</Text>
        </View>
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {/* Líneas guía superior e inferior */}
            <Line
              x1={0}
              y1={PAD_TOP}
              x2={width}
              y2={PAD_TOP}
              stroke={palette.border}
              strokeWidth={StyleSheet.hairlineWidth}
            />
            <Line
              x1={0}
              y1={PAD_TOP + plotHeight}
              x2={width}
              y2={PAD_TOP + plotHeight}
              stroke={palette.border}
              strokeWidth={StyleSheet.hairlineWidth}
            />
            {/* Eje cero */}
            <Line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={palette.muted} strokeWidth={1} />

            {days.map((d, index) => {
              const cx = colWidth * index + colWidth / 2;
              const incomeH = (d.income / maxMagnitude) * halfHeight;
              const expenseH = (d.expense / maxMagnitude) * halfHeight;
              return (
                <Fragment key={index}>
                  {d.income > 0 && (
                    <Rect
                      x={cx - barWidth / 2}
                      y={zeroY - incomeH}
                      width={barWidth}
                      height={incomeH}
                      rx={3}
                      fill={palette.success}
                    />
                  )}
                  {d.expense > 0 && (
                    <Rect
                      x={cx - barWidth / 2}
                      y={zeroY}
                      width={barWidth}
                      height={expenseH}
                      rx={3}
                      fill={palette.danger}
                    />
                  )}
                  <SvgText
                    x={cx}
                    y={height - 6}
                    fontSize={12}
                    fontWeight="600"
                    fill={palette.muted}
                    textAnchor="middle">
                    {d.label}
                  </SvgText>
                </Fragment>
              );
            })}
          </Svg>
        )}
      </View>

      {!hasData && (
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          Sin movimientos esta semana.
        </Text>
      )}
      {hasData && (
        <View style={styles.scaleRow}>
          <Text style={[styles.scaleText, { color: palette.muted }]}>
            Máx: {formatCompactNet(maxMagnitude)} €
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scaleRow: {
    alignItems: 'flex-end',
  },
  scaleText: {
    fontSize: 11,
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
