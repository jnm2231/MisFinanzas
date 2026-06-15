import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type LinePoint = {
  label: string;
  value: number;
};

type Props = {
  points: LinePoint[];
  height?: number;
  /**
   * Si es true, la base del eje Y es 0 € (o el mínimo si hay valores negativos)
   * en lugar del valor más bajo de los datos. Así, según crece el patrimonio el
   * eje se compacta y la gráfica no aumenta de tamaño.
   */
  baselineZero?: boolean;
};

/** Valor de dinero compacto para las etiquetas del eje: "120 €", "1,2k €", "3M €". */
function compactEuro(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')}M €`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace('.', ',')}k €`;
  return `${sign}${Math.round(abs)} €`;
}

const PAD_LEFT = 52; // hueco para las etiquetas del eje Y
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 22; // hueco para las etiquetas del eje X
const Y_TICKS = 4; // nº de divisiones del eje Y (genera Y_TICKS + 1 marcas)

/** Gráfico de líneas (react-native-svg) para la evolución del patrimonio, con ejes. */
export function LineChart({ points, height = 200, baselineZero = false }: Props) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const [width, setWidth] = useState(0);

  if (points.length < 2) {
    return (
      <Text style={[styles.emptyText, { color: palette.muted }]}>
        Aún no hay suficiente histórico. El gráfico se irá construyendo a medida que uses la app.
      </Text>
    );
  }

  const values = points.map((p) => p.value);
  const dataMin = Math.min(...values);
  const max = Math.max(...values);
  const min = baselineZero ? Math.min(0, dataMin) : dataMin;
  const range = max - min || Math.abs(max) || 1;

  const plotLeft = PAD_LEFT;
  const plotRight = Math.max(width - PAD_RIGHT, plotLeft + 1);
  const plotWidth = plotRight - plotLeft;
  const plotTop = PAD_TOP;
  const plotBottom = height - PAD_BOTTOM;
  const plotHeight = plotBottom - plotTop;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const yOf = (value: number) => plotBottom - ((value - min) / range) * plotHeight;
  const coords = points.map((p, index) => ({ x: plotLeft + index * stepX, y: yOf(p.value), value: p.value }));
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPoints = `${polylinePoints} ${coords[coords.length - 1].x},${plotBottom} ${coords[0].x},${plotBottom}`;

  // Marcas del eje Y (de min a max).
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => min + (range * i) / Y_TICKS);

  // Mostramos el valor sobre cada punto solo cuando son pocos, para no saturar.
  const showPointValues = points.length <= 8;

  // Etiquetas del eje X: primera, central y última.
  const middleIndex = Math.floor((points.length - 1) / 2);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {/* Marcas y líneas guía del eje Y */}
          {yTicks.map((tickValue, i) => {
            const y = yOf(tickValue);
            return (
              <Line
                key={`grid-${i}`}
                x1={plotLeft}
                y1={y}
                x2={plotRight}
                y2={y}
                stroke={palette.border}
                strokeWidth={StyleSheet.hairlineWidth}
              />
            );
          })}
          {yTicks.map((tickValue, i) => (
            <SvgText
              key={`ylabel-${i}`}
              x={plotLeft - 6}
              y={yOf(tickValue) + 4}
              fontSize={10}
              fill={palette.muted}
              textAnchor="end">
              {compactEuro(tickValue)}
            </SvgText>
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
            coords.map((c, index) => <Circle key={`dot-${index}`} cx={c.x} cy={c.y} r={3} fill={palette.tint} />)}

          {showPointValues &&
            coords.map((c, index) => (
              <SvgText
                key={`pval-${index}`}
                x={c.x}
                y={c.y - 8}
                fontSize={9}
                fontWeight="700"
                fill={palette.text}
                textAnchor="middle">
                {compactEuro(c.value)}
              </SvgText>
            ))}

          {/* Etiquetas del eje X */}
          <SvgText x={plotLeft} y={height - 6} fontSize={10} fill={palette.muted} textAnchor="start">
            {points[0].label}
          </SvgText>
          {points.length > 2 && (
            <SvgText
              x={coords[middleIndex].x}
              y={height - 6}
              fontSize={10}
              fill={palette.muted}
              textAnchor="middle">
              {points[middleIndex].label}
            </SvgText>
          )}
          <SvgText x={plotRight} y={height - 6} fontSize={10} fill={palette.muted} textAnchor="end">
            {points[points.length - 1].label}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    fontSize: 14,
    paddingVertical: 8,
  },
});
