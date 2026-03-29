import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'feedback.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
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

{
  const cols = db.prepare(`PRAGMA table_info(chat_message)`).all();
  if (!cols.some((c) => c.name === 'role')) {
    db.exec(`ALTER TABLE chat_message ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  }
}

const CATEGORY_RULES = [
  {
    id: 'projects_cli',
    label: 'Stripe Projects CLI & provisioning',
    patterns: [/\bprojects?\b/i, /\bcli\b/i, /\bprovision/i, /\.projects\b/i, /vault/i, /env pull/i],
  },
  {
    id: 'providers_catalog',
    label: 'Providers, catalog & billing',
    patterns: [/provider/i, /catalog/i, /billing/i, /tier/i, /upgrade/i, /neon\b/i, /vercel/i, /supabase/i],
  },
  {
    id: 'auth_identity',
    label: 'Authentication & identity',
    patterns: [/auth/i, /clerk/i, /sso/i, /login/i, /oauth/i],
  },
  {
    id: 'data_layer',
    label: 'Databases & storage',
    patterns: [/database/i, /postgres/i, /mysql/i, /sqlite/i, /turso/i, /storage/i, /bucket/i],
  },
  {
    id: 'vector_search',
    label: 'Vector & search / AI context',
    patterns: [/vector/i, /embedding/i, /chroma/i, /semantic/i, /rag\b/i, /llm/i],
  },
  {
    id: 'hosting_deploy',
    label: 'Hosting, deploy & compute',
    patterns: [/hosting/i, /deploy/i, /vercel/i, /railway/i, /runloop/i, /sandbox/i, /compute/i],
  },
  {
    id: 'dashboard_ux',
    label: 'Dashboard UX & workflows',
    patterns: [/dashboard/i, /\bux\b/i, /workflow/i, /navigation/i, /usability/i],
  },
  {
    id: 'api_webhooks',
    label: 'APIs, webhooks & integrations',
    patterns: [/api\b/i, /webhook/i, /integration/i, /sdk\b/i],
  },
  {
    id: 'docs_learning',
    label: 'Documentation & onboarding',
    patterns: [/doc(s|umentation)?/i, /onboarding/i, /tutorial/i, /example/i],
  },
  {
    id: 'performance',
    label: 'Performance & reliability',
    patterns: [/performance/i, /latency/i, /slow/i, /reliability/i, /outage/i],
  },
  {
    id: 'security',
    label: 'Security & compliance',
    patterns: [/security/i, /compliance/i, /pci/i, /secret/i, /credential/i],
  },
  {
    id: 'analytics',
    label: 'Analytics & observability',
    patterns: [/analytics/i, /posthog/i, /metrics/i, /logging/i, /trace/i],
  },
  {
    id: 'agents_coding',
    label: 'Coding agents & automation',
    patterns: [/agent/i, /cursor/i, /copilot/i, /codex/i, /claude/i, /automation/i],
  },
  {
    id: 'pricing_limits',
    label: 'Pricing, limits & plans',
    patterns: [/pricing/i, /plan/i, /limit/i, /quota/i, /free tier/i],
  },
];

const MISC = { id: 'feedback_misc', label: 'General product feedback' };

function scoreTextAgainstCategories(text) {
  const scores = new Map();
  for (const rule of CATEGORY_RULES) {
    let s = 0;
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (m) s += m[0].length > 2 ? 2 : 1;
    }
    scores.set(rule.id, { ...rule, score: s });
  }
  return scores;
}

function summarizeFeedbackRows(rows) {
  const agg = new Map();
  for (const rule of CATEGORY_RULES) {
    agg.set(rule.id, { id: rule.id, label: rule.label, count: 0, score: 0 });
  }
  agg.set(MISC.id, { id: MISC.id, label: MISC.label, count: 0, score: 0 });
  for (const row of rows) {
    const text = `${row.message} ${row.twitter ?? ''} ${row.agent_used ?? ''}`;
    const scores = scoreTextAgainstCategories(text);
    let maxId = MISC.id;
    let maxS = 0;
    for (const [id, v] of scores) {
      if (v.score > maxS) {
        maxS = v.score;
        maxId = id;
      }
    }
    const slot = agg.get(maxS > 0 ? maxId : MISC.id);
    slot.count += 1;
    slot.score += maxS;
  }
  const list = [...agg.values()]
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || b.score - a.score);
  return list.slice(0, 10).map(({ id, label, count }) => ({ id, label, count }));
}

const insertFeedback = db.prepare(
  `INSERT INTO feedback (message, twitter, agent_used, created_at) VALUES (?, ?, ?, ?)`
);
const insertChat = db.prepare(
  `INSERT INTO chat_message (body, twitter, created_at, role) VALUES (?, ?, ?, ?)`
);

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/summary', (_req, res) => {
  const rows = db.prepare(`SELECT message, twitter, agent_used FROM feedback`).all();
  res.json({ categories: summarizeFeedbackRows(rows), total: rows.length });
});

app.post('/api/feedback', (req, res) => {
  const message = String(req.body?.message ?? '').trim();
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }
  const twitter = req.body?.twitter != null ? String(req.body.twitter).trim() || null : null;
  const agent_used =
    req.body?.agent_used != null ? String(req.body.agent_used).trim() || null : null;
  const created_at = new Date().toISOString();
  const info = insertFeedback.run(message, twitter, agent_used, created_at);
  res.status(201).json({ id: info.lastInsertRowid, created_at });
});

app.get('/api/feedback', (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10) || 100));
  const offset = (page - 1) * limit;
  const total = db.prepare(`SELECT COUNT(*) AS c FROM feedback`).get().c;
  const rows = db
    .prepare(
      `SELECT id, message, twitter, agent_used, created_at FROM feedback ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
  res.json({ page, limit, total, rows });
});

app.get('/api/chat', (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? '200'), 10) || 200));
  const rows = db
    .prepare(
      `SELECT id, body, twitter, created_at FROM chat_message ORDER BY datetime(created_at) DESC LIMIT ?`
    )
    .all(limit);
  res.json({ rows: rows.reverse() });
});

app.post('/api/chat', (req, res) => {
  const body = String(req.body?.body ?? '').trim();
  if (!body) {
    res.status(400).json({ error: 'body is required' });
    return;
  }
  const twitter = req.body?.twitter != null ? String(req.body.twitter).trim() || null : null;
  const created_at = new Date().toISOString();
  const info = insertChat.run(body, twitter, created_at);
  res.status(201).json({ id: info.lastInsertRowid, created_at });
});

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const port = Number(process.env.PORT) || 3847;
app.listen(port, () => {
  console.log(`stripe-projects-feedback listening on http://127.0.0.1:${port}`);
});
