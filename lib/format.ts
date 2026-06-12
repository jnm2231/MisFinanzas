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

/** "2026-06-11T18:30:00" -> "11/06/2026 18:30" */
export function formatDateTime(isoDate: string): string {
  const [datePart, timePart] = isoDate.split('T');
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}${timePart ? ` ${timePart.slice(0, 5)}` : ''}`;
}
