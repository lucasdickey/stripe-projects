import { createClient } from '@libsql/client';

const url = import.meta.env.VITE_TURSO_DATABASE_URL;
const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.warn('Turso credentials missing. Using mock data.');
}

export const db = createClient({
  url: url || 'libsql://mock.db',
  authToken: authToken || '',
});

export async function initDb() {
  if (!url) return;
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        message TEXT NOT NULL,
        twitter TEXT,
        agent TEXT,
        timestamp TEXT NOT NULL
      )
    `);
  } catch (e) {
    console.error('Failed to init DB:', e);
  }
}