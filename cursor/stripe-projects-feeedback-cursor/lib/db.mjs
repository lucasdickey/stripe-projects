/**
 * Local: better-sqlite3 file. Production (Vercel): Turso via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN from Stripe Projects.
 */

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'bigint') out[k] = Number(v);
  }
  return out;
}

async function migrateLibsql(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      twitter TEXT,
      agent_used TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS chat_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      twitter TEXT,
      created_at TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_message(created_at DESC)`);
  const info = await client.execute('PRAGMA table_info(chat_message)');
  const colNames = new Set(
    (info.rows || []).map((r) => normalizeRow(r).name || normalizeRow(r).Name).filter(Boolean)
  );
  if (!colNames.has('role')) {
    await client.execute(`ALTER TABLE chat_message ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  }
}

function migrateSqlite(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      twitter TEXT,
      agent_used TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      twitter TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_message(created_at DESC);
  `);
  const cols = db.prepare(`PRAGMA table_info(chat_message)`).all();
  if (!cols.some((c) => c.name === 'role')) {
    db.exec(`ALTER TABLE chat_message ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  }
}

export async function createDb() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (process.env.VERCEL === '1' && !tursoUrl) {
    throw new Error(
      'On Vercel, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (copy from stripe projects env --pull or the Stripe dashboard).'
    );
  }
  const useTurso =
    Boolean(tursoUrl) && (process.env.VERCEL === '1' || process.env.USE_TURSO === '1');

  if (useTurso) {
    const { createClient } = await import('@libsql/client');
    const client = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
    });
    await migrateLibsql(client);
    return {
      kind: 'libsql',
      async all(sql, params = []) {
        const r = await client.execute({ sql, args: params });
        return (r.rows || []).map(normalizeRow);
      },
      async get(sql, params = []) {
        const rows = await this.all(sql, params);
        return rows[0] ?? undefined;
      },
      async run(sql, params = []) {
        const r = await client.execute({ sql, args: params });
        const id = r.lastInsertRowid != null ? Number(r.lastInsertRowid) : 0;
        return { lastInsertRowid: id, changes: Number(r.rowsAffected ?? 0) };
      },
    };
  }

  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const Database = (await import('better-sqlite3')).default;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const DATA_DIR = path.join(__dirname, '..', 'data');
  const DB_PATH = path.join(DATA_DIR, 'feedback.sqlite');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  migrateSqlite(db);
  return {
    kind: 'sqlite',
    async all(sql, params = []) {
      return db.prepare(sql).all(params);
    },
    async get(sql, params = []) {
      return db.prepare(sql).get(params);
    },
    async run(sql, params = []) {
      return db.prepare(sql).run(params);
    },
  };
}
