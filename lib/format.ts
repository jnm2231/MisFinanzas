export function formatCurrency(value: number): string {
  try {
    return value.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${value.toFixed(2)} €`;
  }
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} %`;
}

/** Convierte el texto de un input a número, aceptando coma decimal (teclado español). */
export function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(/\./g, '.').replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

/** Fecha-hora actual en formato ISO local: 2026-06-11T18:30:00 */
export function nowLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS_ES[month - 1]} ${year}`;
}

/** "2026-06-11T18:30:00" -> "11 jun" */
export function formatShortDate(isoDate: string): string {
  const [datePart] = isoDate.split('T');
  const [, month, day] = datePart.split('-').map(Number);
  return `${day} ${MONTHS_ES[month - 1].slice(0, 3)}`;
}

/** Balance neto compacto para celdas pequeñas del calendario: "+850", "-1,2k". */
export function formatCompactNet(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 10000) return `${sign}${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1).replace('.', ',')}k`;
  return `${sign}${Math.round(abs)}`;
}

/** "11 de junio de 2026" */
export function formatFullDate(year: number, month: number, day: number): string {
  return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}

export function monthShortName(month: number): string {
  return MONTHS_ES[month - 1].slice(0, 3);
}

export function monthName(month: number): string {
  return MONTHS_ES[month - 1];
}

/** Etiquetas de los días de la semana (lunes a domingo) para los ejes. */
export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Clave de fecha local "2026-06-15". */
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Índice del día de la semana con lunes = 0 ... domingo = 6. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export type WeekRange = {
  monday: Date;
  sunday: Date;
  /** Día 1-31, mes 1-12 y año del lunes y domingo, para etiquetas. */
  startKey: string;
  /** Lunes de la semana siguiente (exclusivo) para filtrar rangos. */
  endExclusiveKey: string;
};

/** Semana (lunes-domingo) que contiene el día indicado. */
export function getWeekRange(year: number, month: number, day: number): WeekRange {
  const base = new Date(year, month - 1, day);
  const monday = new Date(base);
  monday.setDate(base.getDate() - mondayIndex(base));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return {
    monday,
    sunday,
    startKey: toDateKey(monday),
    endExclusiveKey: toDateKey(nextMonday),
  };
}

/** "9 - 15 jun 2026", "30 jun - 6 jul 2026" o "30 dic 2025 - 5 ene 2026". */
export function formatWeekRange(monday: Date, sunday: Date): string {
  const dM = monday.getDate();
  const dS = sunday.getDate();
  const mM = monthShortName(monday.getMonth() + 1);
  const mS = monthShortName(sunday.getMonth() + 1);
  const yM = monday.getFullYear();
  const yS = sunday.getFullYear();
  if (yM !== yS) return `${dM} ${mM} ${yM} - ${dS} ${mS} ${yS}`;
  if (monday.getMonth() !== sunday.getMonth()) return `${dM} ${mM} - ${dS} ${mS} ${yS}`;
  return `${dM} - ${dS} ${mS} ${yS}`;
}

/** "Lunes 15 jun" a partir de una clave de fecha "2026-06-15". */
export function formatDayHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekday = WEEKDAY_NAMES[mondayIndex(new Date(y, m - 1, d))];
  return `${weekday} ${d} ${monthShortName(m)}`;
}

/** "2026-06-11T18:30:00" -> "11/06/2026 18:30" */
export function formatDateTime(isoDate: string): string {
  const [datePart, timePart] = isoDate.split('T');
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}${timePart ? ` ${timePart.slice(0, 5)}` : ''}`;
}
