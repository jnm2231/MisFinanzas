/**
 * Notas de versión (patch notes) que se muestran en Ajustes.
 *
 * Cada bloque corresponde a una versión. Los textos están en formato formal,
 * sin emojis. Al publicar una nueva versión, añade un bloque nuevo al principio
 * del array y documenta los cambios también en el archivo de versión (v1.0.md).
 */

export type PatchNote = {
  version: string;
  date: string;
  changes: string[];
};

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '1.0',
    date: '2026-06-15',
    changes: [
      'Se añade esta sección de notas de versión en Ajustes para consultar las novedades de cada actualización.',
      'El gráfico de la pantalla Balance pasa a representar la semana con ejes: el eje horizontal muestra los días de la semana y el eje vertical el dinero. Los gastos aparecen como barras rojas por debajo de cero y los ingresos como barras verdes por encima de cero.',
      'Se sustituye la vista de gastos diarios por una vista de gastos semanales. El historial agrupa los movimientos por día, mostrando de forma diferenciada el día seleccionado y el resto de la semana a continuación.',
      'Se rediseña el calendario de selección de periodo (día, mes y año) con un formato más amplio y cuidado.',
      'Cada gasto o ingreso del historial indica el saldo final que queda en la cuenta afectada tras la operación.',
      'El historial de Balance muestra también las transferencias entre cuentas, indicando la cuenta de origen, la de destino y el saldo final de cada una.',
      'La evolución del patrimonio permite elegir el periodo representado: última semana, último mes, últimos 6 meses, último año, últimos 2 años y últimos 5 años. El eje vertical parte siempre de 0 € y se ajusta automáticamente para que el gráfico no crezca de tamaño. Si todavía no hay datos para cubrir el periodo, se muestra el histórico disponible.',
      'Se añade en Ajustes una sección de notas de backlog para anotar ideas de nuevas funcionalidades, con guardado persistente y copia al portapapeles. Estas notas no se incluyen en las copias de seguridad.',
      'Se establece el icono de la aplicación y la imagen de la pantalla de inicio (splash) con los recursos personalizados de la aplicación.',
      'Los gastos e ingresos admiten un comentario opcional, que se añade desde la pantalla Agregar mediante un campo que se muestra u oculta, y que puede consultarse en el historial de Balance.',
    ],
  },
];
