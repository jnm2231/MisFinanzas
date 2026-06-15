import { Fragment, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCompactNet } from '@/lib/format';

export type BarDatum = {
  label: string;
  income: number;
  expense: number;
};

type Props = {
  bars: BarDatum[];
  height?: number;
  /** Texto cuando no hay datos (varía según el periodo). */
  emptyText?: string;
};

/**
 * Gráfico de barras de ingresos/gastos por intervalo, con ejes.
 *   - Eje X: las etiquetas de cada barra (días de la semana, días del mes o
 *     meses del año). Si hay muchas, se rotula solo 1 de cada N para no solapar.
 *   - Eje Y: dinero. Ingresos verdes por encima de 0 y gastos rojos por debajo.
 * La escala es simétrica respecto al 0 usando la mayor magnitud del periodo.
 */
export function BarChart({ bars, height = 200, emptyText = 'Sin movimientos en este periodo.' }: Props) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const [width, setWidth] = useState(0);

  const maxMagnitude = Math.max(1, ...bars.map((b) => b.income), ...bars.map((b) => b.expense));
  const hasData = bars.some((b) => b.income > 0 || b.expense > 0);

  const PAD_TOP = 14;
  const PAD_BOTTOM = 20; // espacio para las etiquetas del eje X
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const zeroY = PAD_TOP + plotHeight / 2;
  const halfHeight = plotHeight / 2;

  const colWidth = bars.length > 0 ? width / bars.length : width;
  const barWidth = Math.min(22, Math.max(2, colWidth * 0.6));

  // Con muchas barras (p. ej. los días de un mes) se rotula ~1 de cada N.
  const labelStep = bars.length <= 16 ? 1 : Math.ceil(bars.length / 8);

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

            {bars.map((d, index) => {
              const cx = colWidth * index + colWidth / 2;
              const incomeH = (d.income / maxMagnitude) * halfHeight;
              const expenseH = (d.expense / maxMagnitude) * halfHeight;
              const showLabel = index % labelStep === 0 || index === bars.length - 1;
              return (
                <Fragment key={index}>
                  {d.income > 0 && (
                    <Rect
                      x={cx - barWidth / 2}
                      y={zeroY - incomeH}
                      width={barWidth}
                      height={incomeH}
                      rx={2}
                      fill={palette.success}
                    />
                  )}
                  {d.expense > 0 && (
                    <Rect
                      x={cx - barWidth / 2}
                      y={zeroY}
                      width={barWidth}
                      height={expenseH}
                      rx={2}
                      fill={palette.danger}
                    />
                  )}
                  {showLabel && (
                    <SvgText
                      x={cx}
                      y={height - 6}
                      fontSize={11}
                      fontWeight="600"
                      fill={palette.muted}
                      textAnchor="middle">
                      {d.label}
                    </SvgText>
                  )}
                </Fragment>
              );
            })}
          </Svg>
        )}
      </View>

      {!hasData && <Text style={[styles.emptyText, { color: palette.muted }]}>{emptyText}</Text>}
      {hasData && (
        <View style={styles.scaleRow}>
          <Text style={[styles.scaleText, { color: palette.muted }]}>
            Escala: ±{formatCompactNet(maxMagnitude).replace('+', '')} €
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
