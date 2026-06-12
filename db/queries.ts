import { type SQLiteDatabase } from 'expo-sqlite';

import { nowLocalISO } from '@/lib/format';
import { fetchQuote } from '@/lib/quotes';

import {
  type Account,
  type Category,
  type CategoryType,
  type Investment,
  type InvestmentType,
  type Transaction,
} from './database';

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
 * Gastos e ingresos de un periodo. `month` es opcional: sin él devuelve el año entero.
 */
export async function getTransactionsForPeriod(
  db: SQLiteDatabase,
  year: number,
  month?: number
): Promise<Transaction[]> {
  const prefix =
    month !== undefined ? `${year}-${String(month).padStart(2, '0')}%` : `${year}%`;
  return await db.getAllAsync<Transaction>(
    `SELECT t.*, c.name AS category_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.date LIKE ? AND t.type IN ('gasto', 'ingreso')
     ORDER BY t.date DESC`,
    prefix
  );
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
): Promise<void> {
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
}

/**
 * Aportación a una inversión existente: suma capital, descuenta de la plataforma
 * y recalcula participaciones/valor si hay cotización disponible.
 */
export async function addContribution(
  db: SQLiteDatabase,
  investmentId: number,
  amount: number
): Promise<void> {
  const inv = await db.getFirstAsync<Investment>(
    'SELECT * FROM investments WHERE id = ?',
    investmentId
  );
  if (!inv) return;

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
 * Actualiza la cotización de todas las inversiones con símbolo y participaciones.
 * Devuelve cuántas se actualizaron y cuántas fallaron.
 */
export async function refreshQuotes(
  db: SQLiteDatabase
): Promise<{ updated: number; failed: number }> {
  const investments = await db.getAllAsync<Investment>(
    'SELECT * FROM investments WHERE symbol IS NOT NULL AND units IS NOT NULL'
  );
  let updated = 0;
  let failed = 0;
  for (const inv of investments) {
    const quote = await fetchQuote(inv.symbol!);
    if (quote && quote.price > 0 && inv.units) {
      await db.runAsync(
        'UPDATE investments SET current_value = ?, last_updated = ? WHERE id = ?',
        inv.units * quote.price,
        nowLocalISO(),
        inv.id
      );
      updated++;
    } else {
      failed++;
    }
  }
  return { updated, failed };
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
