import { type SQLiteDatabase } from 'expo-sqlite';

import { resetDatabase } from '@/db/database';
import { createAccount, getAccounts, getCategories, setBaseAccountId } from '@/db/queries';

/**
 * Datos de prueba SOLO para desarrollo (Expo Go).
 *
 * Genera un conjunto realista de cuentas, gastos, ingresos y transferencias a lo
 * largo de ~18 meses, además de un histórico de patrimonio (net_worth_snapshots)
 * de ~24 meses, para poder probar las vistas semanal/mensual/anual de Balance y
 * los distintos rangos del gráfico de Patrimonio.
 *
 * REEMPLAZA todos los datos actuales. La pantalla que lo invoca solo se muestra
 * cuando `__DEV__` es true, por lo que nunca aparece en una build de producción.
 */

/** PRNG determinista (mulberry32) para que el mock sea reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

function isoDate(year: number, month0: number, day: number, hour: number, min: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}T${pad(hour)}:${pad(min)}:00`;
}

function dateKeyDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Rango de importe por categoría de gasto.
const EXPENSE_RANGES: Record<string, [number, number]> = {
  Supermercado: [15, 90],
  Ocio: [8, 60],
  Restaurantes: [12, 70],
  Transporte: [5, 40],
  Hogar: [20, 200],
  Salud: [10, 120],
  Otros: [5, 100],
};

const SAMPLE_NOTES: Record<string, string[]> = {
  Supermercado: ['Compra semanal', 'Mercadona', 'Fruta y verdura'],
  Ocio: ['Cine', 'Concierto', 'Suscripción'],
  Restaurantes: ['Cena con amigos', 'Comida del finde', 'Café'],
  Transporte: ['Gasolina', 'Abono transporte', 'Taxi'],
  Hogar: ['Recibo luz', 'Internet', 'Compra muebles'],
  Salud: ['Farmacia', 'Dentista', 'Óptica'],
  Otros: ['Regalo', 'Varios', 'Imprevisto'],
};

export async function seedMockData(db: SQLiteDatabase): Promise<void> {
  await resetDatabase(db);

  // Cuentas: renombramos la cuenta base por defecto y añadimos dos más.
  const accounts = await getAccounts(db);
  const baseId = accounts[0].id;
  await db.runAsync('UPDATE accounts SET name = ? WHERE id = ?', 'Santander', baseId);
  const trId = await createAccount(db, 'Trade Republic', 0);
  const myId = await createAccount(db, 'MyInvestor', 0);
  await setBaseAccountId(db, baseId);

  const gastos = await getCategories(db, 'gasto');
  const ingresos = await getCategories(db, 'ingreso');
  const gastoId = (name: string) => gastos.find((c) => c.name === name)?.id ?? gastos[0].id;
  const nominaId = ingresos.find((c) => c.name === 'Nómina')?.id ?? ingresos[0].id;
  const bizumId = ingresos.find((c) => c.name === 'Bizum')?.id ?? ingresos[0].id;

  const rng = mulberry32(20260615);
  const rand = (a: number, b: number) => a + (b - a) * rng();
  const randint = (a: number, b: number) => Math.floor(rand(a, b + 1));
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const insertTx = async (
    type: 'gasto' | 'ingreso' | 'transferencia',
    amount: number,
    categoryId: number | null,
    accountId: number,
    date: string,
    note: string | null,
    toAccountId: number | null
  ) => {
    await db.runAsync(
      `INSERT INTO transactions (type, amount, category_id, account_id, to_account_id, note, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      type,
      amount,
      categoryId,
      accountId,
      toAccountId,
      note,
      date
    );
    if (type === 'ingreso') {
      await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', amount, accountId);
    } else if (type === 'gasto') {
      await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', amount, accountId);
    } else {
      await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', amount, accountId);
      await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', amount, toAccountId);
    }
  };

  const gastoNames = Object.keys(EXPENSE_RANGES);

  await db.withTransactionAsync(async () => {
    for (let monthsAgo = 17; monthsAgo >= 0; monthsAgo--) {
      const ref = new Date();
      ref.setDate(1);
      ref.setMonth(ref.getMonth() - monthsAgo);
      const year = ref.getFullYear();
      const month0 = ref.getMonth();
      const daysInMonth = new Date(year, month0 + 1, 0).getDate();
      const isCurrentMonth = monthsAgo === 0;
      const today = new Date().getDate();
      const maxDay = isCurrentMonth ? today : daysInMonth;

      // Nómina el día 1.
      await insertTx('ingreso', round2(rand(1800, 2200)), nominaId, baseId,
        isoDate(year, month0, 1, 9, 0), null, null);

      // Gastos repartidos por el mes.
      const nExpenses = randint(8, 15);
      for (let i = 0; i < nExpenses; i++) {
        const day = randint(1, maxDay);
        const name = gastoNames[randint(0, gastoNames.length - 1)];
        const [lo, hi] = EXPENSE_RANGES[name];
        const amount = round2(rand(lo, hi));
        let note: string | null = null;
        if (rng() < 0.25) {
          const opts = SAMPLE_NOTES[name];
          note = opts[randint(0, opts.length - 1)];
        }
        await insertTx('gasto', amount, gastoId(name), baseId,
          isoDate(year, month0, day, randint(8, 22), randint(0, 59)), note, null);
      }

      // Algún Bizum recibido.
      if (rng() < 0.6) {
        await insertTx('ingreso', round2(rand(10, 120)), bizumId, baseId,
          isoDate(year, month0, randint(1, maxDay), 13, 30), null, null);
      }

      // Aportación mensual a inversión (transferencia a una plataforma).
      if (rng() < 0.7) {
        const toAcc = rng() < 0.5 ? trId : myId;
        await insertTx('transferencia', round2(rand(100, 400)), null, baseId,
          isoDate(year, month0, Math.min(5, maxDay), 10, 0), null, toAcc);
      }
    }
  });

  // Histórico de patrimonio: snapshots mensuales (2..24 meses) + diarios (1..35 días).
  await db.withTransactionAsync(async () => {
    const totalForMonthsAgo = (m: number) => {
      // Crece de ~4.000 € (hace 24 meses) a ~18.000 € (hoy) con algo de ruido.
      const base = 18000 - m * 580;
      return Math.max(2500, round2(base + rand(-350, 350)));
    };
    const writeSnapshot = (dateKey: string, total: number) => {
      const invested = round2(total * 0.35);
      const cash = round2(total - invested);
      return db.runAsync(
        'INSERT OR REPLACE INTO net_worth_snapshots (date, cash, invested, total) VALUES (?, ?, ?, ?)',
        dateKey,
        cash,
        invested,
        total
      );
    };

    // Mensuales: día 15 de cada mes, de hace 24 a hace 2 meses.
    for (let m = 24; m >= 2; m--) {
      const ref = new Date();
      ref.setDate(15);
      ref.setMonth(ref.getMonth() - m);
      const key = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-15`;
      await writeSnapshot(key, totalForMonthsAgo(m));
    }
    // Diarios: últimos 35 días (sin contar hoy, que lo registra la app al abrir Patrimonio).
    for (let d = 35; d >= 1; d--) {
      const monthsFraction = d / 30;
      const total = Math.max(2500, round2(18000 - monthsFraction * 580 + rand(-150, 150)));
      await writeSnapshot(dateKeyDaysAgo(d), total);
    }
  });
}
