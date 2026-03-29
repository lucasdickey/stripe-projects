import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from './lib/db.mjs';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function truncate(s, n) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function anthropicMessagesFromHistory(rows) {
  const out = [];
  for (const r of rows) {
    const role = r.role === 'assistant' ? 'assistant' : 'user';
    const text = String(r.body ?? '').trim();
    if (!text) continue;
    out.push({ role, content: text });
  }
  while (out.length && out[0].role === 'assistant') out.shift();
  return out;
}

export async function buildApp() {
  const db = await createDb();

  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/summary', async (_req, res) => {
    try {
      const rows = await db.all(`SELECT message, twitter, agent_used FROM feedback`);
      res.json({ categories: summarizeFeedbackRows(rows), total: rows.length });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'database error' });
    }
  });

  app.post('/api/feedback', async (req, res) => {
    const message = String(req.body?.message ?? '').trim();
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    const twitter = req.body?.twitter != null ? String(req.body.twitter).trim() || null : null;
    const agent_used =
      req.body?.agent_used != null ? String(req.body.agent_used).trim() || null : null;
    const created_at = new Date().toISOString();
    try {
      const info = await db.run(
        `INSERT INTO feedback (message, twitter, agent_used, created_at) VALUES (?, ?, ?, ?)`,
        [message, twitter, agent_used, created_at]
      );
      res.status(201).json({ id: info.lastInsertRowid, created_at });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'could not save' });
    }
  });

  app.get('/api/feedback', async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10) || 100));
    const offset = (page - 1) * limit;
    try {
      const totalRow = await db.get(`SELECT COUNT(*) AS c FROM feedback`);
      const total = Number(totalRow?.c ?? 0);
      const rows = await db.all(
        `SELECT id, message, twitter, agent_used, created_at FROM feedback ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      res.json({ page, limit, total, rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'database error' });
    }
  });

  async function feedbackContextBlock() {
    const rows = await db.all(
      `SELECT message, twitter, agent_used FROM feedback ORDER BY datetime(created_at) DESC LIMIT 50`
    );
    if (!rows.length) {
      return 'No feedback submissions yet.';
    }
    return rows
      .map((r, i) => {
        const who = [r.twitter ? `X: ${r.twitter}` : null, r.agent_used ? `agent: ${r.agent_used}` : null]
          .filter(Boolean)
          .join(' · ');
        return `${i + 1}. ${truncate(r.message, 450)}${who ? ` (${who})` : ''}`;
      })
      .join('\n');
  }

  app.get('/api/chat/config', (_req, res) => {
    res.json({
      aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      model: ANTHROPIC_MODEL,
    });
  });

  app.get('/api/chat', async (req, res) => {
    const lim = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? '200'), 10) || 200));
    try {
      const rows = await db.all(
        `SELECT id, body, twitter, created_at, role FROM chat_message ORDER BY datetime(created_at) DESC LIMIT ?`,
        [lim]
      );
      res.json({ rows: rows.reverse() });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'database error' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    const body = String(req.body?.body ?? '').trim();
    if (!body) {
      res.status(400).json({ error: 'body is required' });
      return;
    }
    const twitter = req.body?.twitter != null ? String(req.body.twitter).trim() || null : null;
    const created_at = new Date().toISOString();
    let userInfo;
    try {
      userInfo = await db.run(
        `INSERT INTO chat_message (body, twitter, created_at, role) VALUES (?, ?, ?, ?)`,
        [body, twitter, created_at, 'user']
      );
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'could not save' });
      return;
    }

    const userRow = {
      id: userInfo.lastInsertRowid,
      body,
      twitter,
      created_at,
      role: 'user',
    };

    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) {
      res.status(201).json({
        user: userRow,
        assistant: null,
        aiEnabled: false,
      });
      return;
    }

    let historyRows;
    try {
      historyRows = await db.all(
        `SELECT body, role FROM chat_message ORDER BY datetime(created_at) DESC LIMIT 32`
      );
      historyRows.reverse();
    } catch (e) {
      console.error(e);
      res.status(201).json({ user: userRow, assistant: null, aiEnabled: true, assistantError: String(e) });
      return;
    }

    const messages = anthropicMessagesFromHistory(historyRows);
    const ctx = await feedbackContextBlock();
    const system = `You are Claude, helping visitors discuss community feedback about Stripe Projects (CLI, providers, provisioning, docs at https://docs.stripe.com/projects).

Ground your replies in the feedback excerpts below when relevant. You do not have private Stripe information; be honest about limits. Keep replies concise and conversational. If there is no related feedback, you may still discuss Stripe Projects generally.

## Recent feedback submissions (newest listed first)
${ctx}`;

    try {
      const client = new Anthropic({ apiKey: key });
      const resp = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system,
        messages,
      });
      const text = (resp.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (!text) {
        res.status(201).json({
          user: userRow,
          assistant: null,
          aiEnabled: true,
          assistantError: 'Empty model response',
        });
        return;
      }
      const aiCreated = new Date().toISOString();
      const aiInfo = await db.run(
        `INSERT INTO chat_message (body, twitter, created_at, role) VALUES (?, ?, ?, ?)`,
        [text, null, aiCreated, 'assistant']
      );
      res.status(201).json({
        user: userRow,
        assistant: {
          id: aiInfo.lastInsertRowid,
          body: text,
          twitter: null,
          created_at: aiCreated,
          role: 'assistant',
        },
        aiEnabled: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Anthropic chat error:', msg);
      res.status(201).json({
        user: userRow,
        assistant: null,
        aiEnabled: true,
        assistantError: msg,
      });
    }
  });

  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
