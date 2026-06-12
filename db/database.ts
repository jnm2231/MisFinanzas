import { type SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'mis-finanzas.db';

/**
 * Esquema relacional:
 *
 *  accounts        Cuentas bancarias (Santander, Trade Republic...). Guardan su saldo actual.
 *  categories      Categorías de gasto y tipos de ingreso (campo `type` las distingue).
 *  transactions    Ingresos, gastos y transferencias internas.
 *                    - gasto/ingreso  -> account_id es la cuenta afectada (la Cuenta Base al crearse).
 *                    - transferencia  -> account_id es origen y to_account_id destino.
 *  investments     Activos de inversión, ligados a una cuenta plataforma (accounts).
 *                    - invested: capital total aportado.
 *                    - units + symbol: para calcular el valor actual con la cotización online.
 *                    - current_value: último valor conocido (manual o automático).
 *  settings        Clave/valor. Aquí vive `base_account_id` (la "Cuenta de Banco Base").
 *  net_worth_snapshots  Foto diaria del patrimonio (efectivo + invertido) para el
 *                       gráfico de evolución temporal. Una fila por día como máximo.
 */
export async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('gasto', 'ingreso')),
      UNIQUE (name, type)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('gasto', 'ingreso', 'transferencia')),
      amount REAL NOT NULL CHECK (amount > 0),
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      to_account_id INTEGER REFERENCES accounts(id),
      note TEXT,
      date TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('fondo', 'etf', 'accion')),
      platform_account_id INTEGER NOT NULL REFERENCES accounts(id),
      symbol TEXT,
      invested REAL NOT NULL DEFAULT 0,
      units REAL,
      current_value REAL NOT NULL DEFAULT 0,
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      date TEXT PRIMARY KEY,
      cash REAL NOT NULL,
      invested REAL NOT NULL,
      total REAL NOT NULL
    );
  `);

  await seedDefaults(db);
}

/** Datos iniciales para que la app sea usable desde el primer arranque. */
async function seedDefaults(db: SQLiteDatabase) {
  const accountCount = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM accounts'
  );
  if (accountCount && accountCount.n === 0) {
    const result = await db.runAsync(
      'INSERT INTO accounts (name, balance) VALUES (?, ?)',
      'Cuenta Principal',
      0
    );
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'base_account_id',
      String(result.lastInsertRowId)
    );
  }

  const categoryCount = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM categories'
  );
  if (categoryCount && categoryCount.n === 0) {
    const gastos = ['Supermercado', 'Ocio', 'Restaurantes', 'Transporte', 'Hogar', 'Salud', 'Otros'];
    const ingresos = ['Nómina', 'Bizum', 'Regalo', 'Otros'];
    for (const name of gastos) {
      await db.runAsync('INSERT INTO categories (name, type) VALUES (?, ?)', name, 'gasto');
    }
    for (const name of ingresos) {
      await db.runAsync('INSERT INTO categories (name, type) VALUES (?, ?)', name, 'ingreso');
    }
  }
}

/** Borra todos los datos y vuelve a crear el esquema con los valores por defecto. */
export async function resetDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    DROP TABLE IF EXISTS net_worth_snapshots;
    DROP TABLE IF EXISTS investments;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS accounts;
    DROP TABLE IF EXISTS settings;
  `);
  await initDatabase(db);
}

// ---------- Tipos ----------

export type Account = {
  id: number;
  name: string;
  balance: number;
  created_at: string;
};

export type CategoryType = 'gasto' | 'ingreso';

export type Category = {
  id: number;
  name: string;
  type: CategoryType;
};

export type TransactionType = 'gasto' | 'ingreso' | 'transferencia';

export type Transaction = {
  id: number;
  type: TransactionType;
  amount: number;
  category_id: number | null;
  account_id: number;
  to_account_id: number | null;
  note: string | null;
  date: string;
  /** Nombre de la categoría (JOIN), null si se borró la categoría. */
  category_name?: string | null;
};

export type NetWorthSnapshot = {
  date: string;
  cash: number;
  invested: number;
  total: number;
};

export type InvestmentType = 'fondo' | 'etf' | 'accion';

export type Investment = {
  id: number;
  name: string;
  type: InvestmentType;
  platform_account_id: number;
  symbol: string | null;
  invested: number;
  units: number | null;
  current_value: number;
  last_updated: string | null;
  /** Nombre de la cuenta plataforma (JOIN). */
  platform_name?: string;
};
