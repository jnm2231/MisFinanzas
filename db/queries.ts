import { type SQLiteDatabase } from 'expo-sqlite';

import { nowLocalISO } from '@/lib/format';
import { fetchQuote } from '@/lib/quotes';

import {
  type Account,
  type Category,
  type CategoryType,
  type Investment,
  type InvestmentType,
  type NetWorthSnapshot,
  type Transaction,
} from './database';

/** Prefijo de fecha para filtrar por año, mes o día: "2026", "2026-06", "2026-06-11". */
function datePrefix(year: number, month?: number, day?: number): string {
  let prefix = String(year);
  if (month !== undefined) {
    prefix += `-${String(month).padStart(2, '0')}`;
    if (day !== undefined) prefix += `-${String(day).padStart(2, '0')}`;
  }
  return prefix;
}

// ---------- Ajustes / Cuenta Base ----------

export async function getBaseAccountId(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'base_account_id'"
  );
  return row ? Number(row.value) : null;
}

export async function setBaseAccountId(db: SQLiteDatabase, accountId: number) {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('base_account_id', ?)",
    String(accountId)
  );
}

export async function getBaseAccount(db: SQLiteDatabase): Promise<Account | null> {
  const id = await getBaseAccountId(db);
  if (id === null) return null;
  return await db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', id);
}

// ---------- Cuentas ----------

export async function getAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return await db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY name');
}

export async function createAccount(
  db: SQLiteDatabase,
  name: string,
  initialBalance: number
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO accounts (name, balance) VALUES (?, ?)',
    name.trim(),
    initialBalance
  );
  return result.lastInsertRowId;
}

/** Solo permite borrar cuentas sin movimientos, sin inversiones y que no sean la base. */
export async function deleteAccount(
  db: SQLiteDatabase,
  accountId: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const baseId = await getBaseAccountId(db);
  if (accountId === baseId) {
    return { ok: false, reason: 'Es la Cuenta Base. Cambia la Cuenta Base en Ajustes antes de borrarla.' };
  }
  const tx = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? OR to_account_id = ?',
    accountId,
    accountId
  );
  if (tx && tx.n > 0) {
    return { ok: false, reason: 'Tiene movimientos asociados.' };
  }
  const inv = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM investments WHERE platform_account_id = ?',
    accountId
  );
  if (inv && inv.n > 0) {
    return { ok: false, reason: 'Tiene inversiones asociadas.' };
  }
  await db.runAsync('DELETE FROM accounts WHERE id = ?', accountId);
  return { ok: true };
}

export async function transferBetweenAccounts(
  db: SQLiteDatabase,
  fromAccountId: number,
  toAccountId: number,
  amount: number
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      amount,
      fromAccountId
    );
    await db.runAsync(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      amount,
      toAccountId
    );
    await db.runAsync(
      `INSERT INTO transactions (type, amount, account_id, to_account_id, date)
       VALUES ('transferencia', ?, ?, ?, ?)`,
      amount,
      fromAccountId,
      toAccountId,
      nowLocalISO()
    );
  });
}

// ---------- Categorías ----------

export async function getCategories(
  db: SQLiteDatabase,
  type: CategoryType
): Promise<Category[]> {
  return await db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE type = ? ORDER BY name',
    type
  );
}

export async function addCategory(db: SQLiteDatabase, name: string, type: CategoryType) {
  await db.runAsync(
    'INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)',
    name.trim(),
    type
  );
}

export async function deleteCategory(db: SQLiteDatabase, categoryId: number) {
  await db.runAsync('DELETE FROM categories WHERE id = ?', categoryId);
}

// ---------- Transacciones ----------

/**
 * Registra un gasto o ingreso contra la Cuenta Base y actualiza su saldo.
 * Devuelve false si no hay Cuenta Base configurada.
 */
export async function addTransaction(
  db: SQLiteDatabase,
  type: 'gasto' | 'ingreso',
  amount: number,
  categoryId: number
): Promise<boolean> {
  const baseId = await getBaseAccountId(db);
  if (baseId === null) return false;

  const delta = type === 'gasto' ? -amount : amount;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions (type, amount, category_id, account_id, date)
       VALUES (?, ?, ?, ?, ?)`,
      type,
      amount,
      categoryId,
      baseId,
      nowLocalISO()
    );
    await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', delta, baseId);
  });
  return true;
}

/** Borra una transacción revirtiendo su efecto en los saldos. */
export async function deleteTransaction(db: SQLiteDatabase, transactionId: number) {
  const tx = await db.getFirstAsync<Transaction>(
    'SELECT * FROM transactions WHERE id = ?',
    transactionId
  );
  if (!tx) return;

  await db.withTransactionAsync(async () => {
    if (tx.type === 'transferencia' && tx.to_account_id !== null) {
      await db.runAsync(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        tx.amount,
        tx.account_id
      );
      await db.runAsync(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        tx.amount,
        tx.to_account_id
      );
    } else {
      const delta = tx.type === 'gasto' ? tx.amount : -tx.amount;
      await db.runAsync(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        delta,
        tx.account_id
      );
    }
    await db.runAsync('DELETE FROM transactions WHERE id = ?', transactionId);
  });
}

/**
 * Gastos e ingresos de un periodo: año entero, mes concreto o día concreto
 * según cuántos componentes de fecha se pasen.
 */
export async function getTransactionsForPeriod(
  db: SQLiteDatabase,
  year: number,
  month?: number,
  day?: number
): Promise<Transaction[]> {
  return await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name AS category_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.date LIKE ? AND t.type IN ('gasto', 'ingreso')
     ORDER BY t.date DESC`,
    `${datePrefix(year, month, day)}%`
  );
}

/**
 * Gastos e ingresos cuyo día (YYYY-MM-DD) cae en [startKey, endExclusiveKey).
 * Pensado para rangos arbitrarios como una semana.
 */
export async function getTransactionsForRange(
  db: SQLiteDatabase,
  startKey: string,
  endExclusiveKey: string
): Promise<Transaction[]> {
  return await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name AS category_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE substr(t.date, 1, 10) >= ? AND substr(t.date, 1, 10) < ?
       AND t.type IN ('gasto', 'ingreso')
     ORDER BY t.date DESC`,
    startKey,
    endExclusiveKey
  );
}

/** Igual que getCategoryTotals pero para un rango de fechas [startKey, endExclusiveKey). */
export async function getCategoryTotalsForRange(
  db: SQLiteDatabase,
  type: 'gasto' | 'ingreso',
  startKey: string,
  endExclusiveKey: string
): Promise<CategoryTotal[]> {
  return await db.getAllAsync<CategoryTotal>(
    `SELECT c.name AS category_name, SUM(t.amount) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE substr(t.date, 1, 10) >= ? AND substr(t.date, 1, 10) < ? AND t.type = ?
     GROUP BY t.category_id
     ORDER BY total DESC`,
    startKey,
    endExclusiveKey,
    type
  );
}

export type CategoryTotal = {
  category_name: string | null;
  total: number;
};

/** Total gastado/ingresado por categoría en el periodo, de mayor a menor. */
export async function getCategoryTotals(
  db: SQLiteDatabase,
  type: 'gasto' | 'ingreso',
  year: number,
  month?: number,
  day?: number
): Promise<CategoryTotal[]> {
  return await db.getAllAsync<CategoryTotal>(
    `SELECT c.name AS category_name, SUM(t.amount) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.date LIKE ? AND t.type = ?
     GROUP BY t.category_id
     ORDER BY total DESC`,
    `${datePrefix(year, month, day)}%`,
    type
  );
}

export type MonthlyTotal = {
  month: number;
  income: number;
  expense: number;
};

/** Ingresos y gastos de un año agrupados por mes (solo meses con movimientos). */
export async function getMonthlyTotals(
  db: SQLiteDatabase,
  year: number
): Promise<MonthlyTotal[]> {
  return await db.getAllAsync<MonthlyTotal>(
    `SELECT CAST(substr(date, 6, 2) AS INTEGER) AS month,
            SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'gasto' THEN amount ELSE 0 END) AS expense
     FROM transactions
     WHERE date LIKE ? AND type IN ('gasto', 'ingreso')
     GROUP BY month
     ORDER BY month`,
    `${year}%`
  );
}

// ---------- Datos para el calendario (balance neto por celda) ----------

type NetRow = { key: string; net: number };

function netRowsToMap(rows: NetRow[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of rows) map.set(Number(row.key), row.net);
  return map;
}

/** Balance neto (ingresos - gastos) de cada día de un mes. Clave: día 1-31. */
export async function getDailyNets(
  db: SQLiteDatabase,
  year: number,
  month: number
): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<NetRow>(
    `SELECT substr(date, 9, 2) AS key,
            SUM(CASE WHEN type = 'ingreso' THEN amount ELSE -amount END) AS net
     FROM transactions
     WHERE date LIKE ? AND type IN ('gasto', 'ingreso')
     GROUP BY key`,
    `${datePrefix(year, month)}%`
  );
  return netRowsToMap(rows);
}

/** Balance neto de cada mes de un año. Clave: mes 1-12. */
export async function getMonthlyNets(
  db: SQLiteDatabase,
  year: number
): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<NetRow>(
    `SELECT substr(date, 6, 2) AS key,
            SUM(CASE WHEN type = 'ingreso' THEN amount ELSE -amount END) AS net
     FROM transactions
     WHERE date LIKE ? AND type IN ('gasto', 'ingreso')
     GROUP BY key`,
    `${year}%`
  );
  return netRowsToMap(rows);
}

/** Balance neto de cada año con movimientos. Clave: año. */
export async function getYearlyNets(db: SQLiteDatabase): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<NetRow>(
    `SELECT substr(date, 1, 4) AS key,
            SUM(CASE WHEN type = 'ingreso' THEN amount ELSE -amount END) AS net
     FROM transactions
     WHERE type IN ('gasto', 'ingreso')
     GROUP BY key`
  );
  return netRowsToMap(rows);
}

// ---------- Inversiones ----------

export async function getInvestments(db: SQLiteDatabase): Promise<Investment[]> {
  return await db.getAllAsync<Investment>(
    `SELECT i.*, a.name AS platform_name
     FROM investments i
     JOIN accounts a ON a.id = i.platform_account_id
     ORDER BY i.type, i.name`
  );
}

export type InvestmentResult = { ok: true } | { ok: false; reason: string };

/** Comprueba que la cuenta tiene saldo suficiente antes de invertir desde ella. */
async function checkSufficientBalance(
  db: SQLiteDatabase,
  accountId: number,
  amount: number
): Promise<InvestmentResult> {
  const account = await db.getFirstAsync<Account>(
    'SELECT * FROM accounts WHERE id = ?',
    accountId
  );
  if (!account) return { ok: false, reason: 'La cuenta no existe.' };
  if (account.balance < amount) {
    return {
      ok: false,
      reason: `Saldo insuficiente en "${account.name}". Disponible: ${account.balance.toFixed(2)} €.`,
    };
  }
  return { ok: true };
}

/**
 * Crea una inversión nueva. El importe sale del saldo de la cuenta plataforma
 * (el dinero pasa de "efectivo" a "invertido", el patrimonio total no cambia).
 * Si hay símbolo intenta obtener la cotización para guardar las participaciones.
 */
export async function createInvestment(
  db: SQLiteDatabase,
  params: {
    name: string;
    type: InvestmentType;
    platformAccountId: number;
    symbol: string | null;
    amount: number;
  }
): Promise<InvestmentResult> {
  const check = await checkSufficientBalance(db, params.platformAccountId, params.amount);
  if (!check.ok) return check;

  let units: number | null = null;
  if (params.symbol) {
    const quote = await fetchQuote(params.symbol);
    if (quote && quote.price > 0) units = params.amount / quote.price;
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO investments (name, type, platform_account_id, symbol, invested, units, current_value, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params.name.trim(),
      params.type,
      params.platformAccountId,
      params.symbol ? params.symbol.trim().toUpperCase() : null,
      params.amount,
      units,
      params.amount,
      nowLocalISO()
    );
    await db.runAsync(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      params.amount,
      params.platformAccountId
    );
  });
  return { ok: true };
}

/**
 * Aportación a una inversión existente: suma capital, descuenta de la plataforma
 * y recalcula participaciones/valor si hay cotización disponible.
 */
export async function addContribution(
  db: SQLiteDatabase,
  investmentId: number,
  amount: number
): Promise<InvestmentResult> {
  const inv = await db.getFirstAsync<Investment>(
    'SELECT * FROM investments WHERE id = ?',
    investmentId
  );
  if (!inv) return { ok: false, reason: 'La inversión no existe.' };

  const check = await checkSufficientBalance(db, inv.platform_account_id, amount);
  if (!check.ok) return check;

  let newUnits = inv.units;
  let newValue = inv.current_value + amount;

  if (inv.symbol) {
    const quote = await fetchQuote(inv.symbol);
    if (quote && quote.price > 0) {
      const boughtUnits = amount / quote.price;
      newUnits = (inv.units ?? 0) + boughtUnits;
      newValue = newUnits * quote.price;
    }
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE investments
       SET invested = invested + ?, units = ?, current_value = ?, last_updated = ?
       WHERE id = ?`,
      amount,
      newUnits,
      newValue,
      nowLocalISO(),
      investmentId
    );
    await db.runAsync(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      amount,
      inv.platform_account_id
    );
  });
  return { ok: true };
}

/** Ajuste manual del valor actual (icono de lápiz). */
export async function setInvestmentValue(
  db: SQLiteDatabase,
  investmentId: number,
  currentValue: number
) {
  await db.runAsync(
    'UPDATE investments SET current_value = ?, last_updated = ? WHERE id = ?',
    currentValue,
    nowLocalISO(),
    investmentId
  );
}

/**
 * Edición integral de una inversión sin perder el capital aportado ni su historial.
 *
 * - Cambio de plataforma: el capital aportado (`invested`) se devuelve a la cuenta
 *   antigua y se descuenta de la nueva, que debe tener saldo suficiente.
 * - Cambio de símbolo: se recalculan las participaciones con la cotización actual
 *   manteniendo el valor; si la API no responde quedan pendientes y se calculan
 *   en la siguiente actualización de cotizaciones.
 */
export async function updateInvestment(
  db: SQLiteDatabase,
  investmentId: number,
  params: {
    name: string;
    symbol: string | null;
    platformAccountId: number;
    currentValue: number;
  }
): Promise<InvestmentResult> {
  const inv = await db.getFirstAsync<Investment>(
    'SELECT * FROM investments WHERE id = ?',
    investmentId
  );
  if (!inv) return { ok: false, reason: 'La inversión no existe.' };

  const platformChanged = params.platformAccountId !== inv.platform_account_id;
  if (platformChanged) {
    const check = await checkSufficientBalance(db, params.platformAccountId, inv.invested);
    if (!check.ok) return check;
  }

  const newSymbol = params.symbol ? params.symbol.trim().toUpperCase() : null;
  const valueChanged = Math.abs(params.currentValue - inv.current_value) > 0.004;
  let units = inv.units;
  if (newSymbol !== inv.symbol || (valueChanged && newSymbol)) {
    if (newSymbol === null) {
      units = null;
    } else {
      const quote = await fetchQuote(newSymbol);
      units = quote && quote.price > 0 ? params.currentValue / quote.price : null;
    }
  }

  await db.withTransactionAsync(async () => {
    if (platformChanged) {
      await db.runAsync(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        inv.invested,
        inv.platform_account_id
      );
      await db.runAsync(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        inv.invested,
        params.platformAccountId
      );
    }
    await db.runAsync(
      `UPDATE investments
       SET name = ?, symbol = ?, platform_account_id = ?, units = ?, current_value = ?, last_updated = ?
       WHERE id = ?`,
      params.name.trim(),
      newSymbol,
      params.platformAccountId,
      units,
      params.currentValue,
      nowLocalISO(),
      investmentId
    );
  });
  return { ok: true };
}

export async function deleteInvestment(
  db: SQLiteDatabase,
  investmentId: number,
  refundToAccount: boolean
) {
  const inv = await db.getFirstAsync<Investment>(
    'SELECT * FROM investments WHERE id = ?',
    investmentId
  );
  if (!inv) return;
  await db.withTransactionAsync(async () => {
    if (refundToAccount) {
      await db.runAsync(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        inv.current_value,
        inv.platform_account_id
      );
    }
    await db.runAsync('DELETE FROM investments WHERE id = ?', investmentId);
  });
}

/**
 * Actualiza la cotización de todas las inversiones con símbolo.
 * Si una inversión aún no tiene participaciones (la API falló al crearla o al
 * cambiar el símbolo), se calculan ahora a partir de su valor actual.
 * Devuelve los ids que fallaron para señalarlos en la interfaz, sin alertas.
 */
export async function refreshQuotes(
  db: SQLiteDatabase
): Promise<{ updated: number; failedIds: number[] }> {
  const investments = await db.getAllAsync<Investment>(
    'SELECT * FROM investments WHERE symbol IS NOT NULL'
  );
  let updated = 0;
  const failedIds: number[] = [];
  for (const inv of investments) {
    const quote = await fetchQuote(inv.symbol!);
    if (!quote || quote.price <= 0) {
      failedIds.push(inv.id);
      continue;
    }
    if (inv.units) {
      await db.runAsync(
        'UPDATE investments SET current_value = ?, last_updated = ? WHERE id = ?',
        inv.units * quote.price,
        nowLocalISO(),
        inv.id
      );
    } else {
      await db.runAsync(
        'UPDATE investments SET units = ?, last_updated = ? WHERE id = ?',
        inv.current_value / quote.price,
        nowLocalISO(),
        inv.id
      );
    }
    updated++;
  }
  return { updated, failedIds };
}

// ---------- Patrimonio ----------

export async function getTotals(
  db: SQLiteDatabase
): Promise<{ cash: number; invested: number }> {
  const cash = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(balance) AS total FROM accounts'
  );
  const invested = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(current_value) AS total FROM investments'
  );
  return { cash: cash?.total ?? 0, invested: invested?.total ?? 0 };
}

/** Guarda (o actualiza) la foto del patrimonio de hoy para el gráfico de evolución. */
export async function recordNetWorthSnapshot(db: SQLiteDatabase) {
  const { cash, invested } = await getTotals(db);
  const today = nowLocalISO().slice(0, 10);
  await db.runAsync(
    'INSERT OR REPLACE INTO net_worth_snapshots (date, cash, invested, total) VALUES (?, ?, ?, ?)',
    today,
    cash,
    invested,
    cash + invested
  );
}

export async function getNetWorthSnapshots(
  db: SQLiteDatabase
): Promise<NetWorthSnapshot[]> {
  return await db.getAllAsync<NetWorthSnapshot>(
    'SELECT * FROM net_worth_snapshots ORDER BY date'
  );
}
