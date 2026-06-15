/**
 * Notas de versión (patch notes) que se muestran en Ajustes > Notas de versión.
 *
 * Cada versión tiene una lista de novedades (`features`) y de correcciones
 * (`fixes`), cada una con un título y un detalle opcional. Los textos están en
 * formato formal, sin emojis. Al publicar una versión nueva, añade un bloque al
 * principio del array, actualiza `CURRENT_VERSION` y documéntalo en v1.0.md.
 */

export type PatchEntry = {
  title: string;
  detail?: string;
};

export type PatchNote = {
  version: string;
  /** Fecha "YYYY-MM-DD" o null para la primera versión. */
  date: string | null;
  summary?: string;
  features: PatchEntry[];
  fixes: PatchEntry[];
};

export const CURRENT_VERSION = '1.0';

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '1.0',
    date: '2026-06-15',
    summary:
      'Primera gran actualización: nueva pantalla de Balance, evolución del patrimonio por periodos, comentarios en los movimientos y más.',
    features: [
      {
        title: 'Notas de versión',
        detail: 'Nueva sección en Ajustes que muestra las novedades y correcciones de cada versión.',
      },
      {
        title: 'Gráfico semanal con ejes en Balance',
        detail:
          'El eje horizontal muestra los días de la semana y el vertical el dinero: los gastos son barras rojas por debajo de cero y los ingresos barras verdes por encima.',
      },
      {
        title: 'Vista semanal en lugar de diaria',
        detail:
          'El historial agrupa los movimientos por día, mostrando aparte el día seleccionado y el resto de la semana a continuación.',
      },
      {
        title: 'Calendario rediseñado',
        detail: 'El calendario de selección de periodo (día, mes y año) es más amplio y estilizado.',
      },
      {
        title: 'Saldo final por movimiento',
        detail: 'Cada gasto o ingreso indica el saldo que queda en la cuenta afectada tras la operación.',
      },
      {
        title: 'Transferencias en Balance',
        detail:
          'El historial muestra las transferencias entre cuentas, con la cuenta de origen, la de destino y el saldo final de cada una.',
      },
      {
        title: 'Rangos en la evolución del patrimonio',
        detail:
          'Se puede elegir el periodo del gráfico (semana, mes, 6 meses, año y 5 años). El eje vertical parte de 0 € y se compacta automáticamente.',
      },
      {
        title: 'Notas de backlog en Ajustes',
        detail:
          'Sección para anotar ideas de nuevas funcionalidades, con guardado persistente y copia al portapapeles. No se incluyen en las copias de seguridad.',
      },
      {
        title: 'Icono e imagen de inicio propios',
        detail: 'Se establecen el icono de la aplicación (también el adaptativo de Android) y la pantalla de inicio.',
      },
      {
        title: 'Comentarios en gastos e ingresos',
        detail:
          'Se puede añadir un comentario opcional a cada gasto o ingreso y consultarlo después en el historial de Balance.',
      },
    ],
    fixes: [
      {
        title: 'Scroll en Notas de versión',
        detail: 'Se corrige el desplazamiento dentro de la pantalla de notas de versión.',
      },
      {
        title: 'Eje Y en la evolución del patrimonio',
        detail: 'El gráfico muestra los valores de dinero en el eje vertical y marca el valor de cada punto.',
      },
      {
        title: 'Selector de rangos del patrimonio',
        detail: 'Se elimina el rango de 2 años y se compactan los botones para que quepan en una sola fila.',
      },
    ],
  },
];
