import { type SQLiteDatabase } from 'expo-sqlite';

import {
  type Account,
  type Category,
  type Investment,
  type NetWorthSnapshot,
  type Transaction,
} from '@/db/database';
import { nowLocalISO } from '@/lib/format';

/**
 * Copia de seguridad completa de la base de datos.
 *
 * Se exporta/importa en dos formatos:
 *  - JSON: un objeto con todas las tablas.
 *  - CSV: un único archivo con secciones `#TABLE <nombre>`, una por tabla,
 *    cada una con su cabecera de columnas. Campos entrecomillados según RFC 4180.
 *
 * La importación REEMPLAZA todos los datos actuales (restauración completa),
 * conservando los ids originales para mantener las relaciones entre tablas.
 */

const BACKUP_HEADER = '#mis-finanzas-backup';

type SettingRow = { key: string; value: string | null };

export type BackupData = {
  version: number;
  exported_at: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  investments: Investment[];
  settings: SettingRow[];
  net_worth_snapshots: NetWorthSnapshot[];
};

// Columnas de cada tabla, en el orden en que se serializan en CSV.
const TABLE_COLUMNS = {
  accounts: ['id', 'name', 'balance', 'created_at'],
  categories: ['id', 'name', 'type'],
  transactions: ['id', 'type', 'amount', 'category_id', 'account_id', 'to_account_id', 'note', 'date'],
  investments: ['id', 'name', 'type', 'platform_account_id', 'symbol', 'invested', 'units', 'current_value', 'last_updated'],
  settings: ['key', 'value'],
  net_worth_snapshots: ['date', 'cash', 'invested', 'total'],
} as const;

type TableName = keyof typeof TABLE_COLUMNS;

const NUMERIC_COLUMNS = new Set([
  'id', 'balance', 'amount', 'category_id', 'account_id', 'to_account_id',
  'platform_account_id', 'invested', 'units', 'current_value', 'cash', 'total',
]);

// ---------- Lectura / escritura en la base de datos ----------

export async function exportAll(db: SQLiteDatabase): Promise<BackupData> {
  return {
    version: 1,
    exported_at: nowLocalISO(),
    accounts: await db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY id'),
    categories: await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY id'),
    transactions: await db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY id'),
    investments: await db.getAllAsync<Investment>('SELECT * FROM investments ORDER BY id'),
    settings: await db.getAllAsync<SettingRow>('SELECT * FROM settings'),
    net_worth_snapshots: await db.getAllAsync<NetWorthSnapshot>(
      'SELECT * FROM net_worth_snapshots ORDER BY date'
    ),
  };
}

/** Reemplaza todo el contenido de la base de datos con el del backup. */
export async function importAll(db: SQLiteDatabase, data: BackupData): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Borrado en orden inverso a las claves foráneas.
    await db.execAsync(`
      DELETE FROM net_worth_snapshots;
      DELETE FROM transactions;
      DELETE FROM investments;
      DELETE FROM categories;
      DELETE FROM accounts;
      DELETE FROM settings;
    `);

    for (const row of data.accounts) {
      await db.runAsync(
        'INSERT INTO accounts (id, name, balance, created_at) VALUES (?, ?, ?, ?)',
        row.id, row.name, row.balance, row.created_at
      );
    }
    for (const row of data.categories) {
      await db.runAsync(
        'INSERT INTO categories (id, name, type) VALUES (?, ?, ?)',
        row.id, row.name, row.type
      );
    }
    for (const row of data.transactions) {
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, to_account_id, note, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.type, row.amount, row.category_id, row.account_id,
        row.to_account_id, row.note, row.date
      );
    }
    for (const row of data.investments) {
      await db.runAsync(
        `INSERT INTO investments (id, name, type, platform_account_id, symbol, invested, units, current_value, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.name, row.type, row.platform_account_id, row.symbol,
        row.invested, row.units, row.current_value, row.last_updated
      );
    }
    for (const row of data.settings) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', row.key, row.value);
    }
    for (const row of data.net_worth_snapshots) {
      await db.runAsync(
        'INSERT INTO net_worth_snapshots (date, cash, invested, total) VALUES (?, ?, ?, ?)',
        row.date, row.cash, row.invested, row.total
      );
    }
  });
}

// ---------- Serialización JSON ----------

export function toJSON(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}

// ---------- Serialización CSV ----------

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCSV(data: BackupData): string {
  const lines: string[] = [`${BACKUP_HEADER},version=${data.version},exported_at=${data.exported_at}`];
  for (const table of Object.keys(TABLE_COLUMNS) as TableName[]) {
    const columns = TABLE_COLUMNS[table];
    lines.push(`#TABLE ${table}`);
    lines.push(columns.join(','));
    for (const row of data[table] as Record<string, unknown>[]) {
      lines.push(columns.map((col) => csvEscape(row[col])).join(','));
    }
  }
  return lines.join('\r\n');
}

/** Parser CSV (RFC 4180): admite comillas, comas y saltos de línea dentro de campos. */
function parseCSVRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      pushField();
      i++;
    } else if (char === '\r') {
      i++;
    } else if (char === '\n') {
      pushRecord();
      i++;
    } else {
      field += char;
      i++;
    }
  }
  if (field !== '' || record.length > 0) pushRecord();
  return records;
}

function parseCSV(text: string): BackupData {
  const records = parseCSVRecords(text);
  if (records.length === 0 || !records[0][0]?.startsWith(BACKUP_HEADER)) {
    throw new Error('No es un backup de Mis Finanzas');
  }

  const data: Record<string, Record<string, unknown>[]> = {
    accounts: [], categories: [], transactions: [],
    investments: [], settings: [], net_worth_snapshots: [],
  };

  let currentTable: TableName | null = null;
  let currentColumns: string[] = [];

  for (let r = 1; r < records.length; r++) {
    const record = records[r];
    const first = record[0] ?? '';
    if (first.startsWith('#TABLE ')) {
      const name = first.slice('#TABLE '.length).trim() as TableName;
      if (!(name in TABLE_COLUMNS)) throw new Error(`Tabla desconocida: ${name}`);
      currentTable = name;
      currentColumns = [];
      continue;
    }
    if (!currentTable) continue;
    if (currentColumns.length === 0) {
      currentColumns = record;
      continue;
    }
    if (record.length === 1 && record[0] === '') continue;

    const row: Record<string, unknown> = {};
    currentColumns.forEach((col, index) => {
      const raw = record[index] ?? '';
      if (raw === '') {
        row[col] = null;
      } else if (NUMERIC_COLUMNS.has(col)) {
        const num = Number(raw);
        if (!Number.isFinite(num)) throw new Error(`Valor numérico no válido en ${currentTable}.${col}`);
        row[col] = num;
      } else {
        row[col] = raw;
      }
    });
    data[currentTable].push(row);
  }

  return {
    version: 1,
    exported_at: nowLocalISO(),
    ...data,
  } as unknown as BackupData;
}

function parseJSON(text: string): BackupData {
  const data = JSON.parse(text) as Partial<BackupData>;
  for (const table of Object.keys(TABLE_COLUMNS) as TableName[]) {
    if (!Array.isArray(data[table])) {
      throw new Error(`Falta la tabla "${table}" en el backup`);
    }
  }
  return data as BackupData;
}

/** Detecta el formato (JSON o CSV) y devuelve los datos del backup. Lanza si no es válido. */
export function parseBackup(text: string): BackupData {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return parseJSON(trimmed);
  return parseCSV(trimmed);
}
