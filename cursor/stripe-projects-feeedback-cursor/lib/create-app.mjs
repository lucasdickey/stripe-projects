import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from './db.mjs';
import { summarizeFeedbackHeuristic } from './heuristic-summary.mjs';
import {
  ANTHROPIC_MODEL,
  createAnthropicClient,
  getAnthropicApiKey,
  summarizeCategoriesWithAnthropic,
} from './llm.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveIndexHtmlPath() {
  const candidates = [
    path.join(process.cwd(), 'index.html'),
    path.join(__dirname, '..', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
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
      const client = createAnthropicClient();
      let categories;
      let summarySource;

      if (client && rows.length > 0) {
        try {
          categories = await summarizeCategoriesWithAnthropic(client, rows);
          summarySource = categories.length > 0 ? 'llm' : 'heuristic';
          if (!categories.length) {
            categories = summarizeFeedbackHeuristic(rows);
            summarySource = 'heuristic';
          }
        } catch (err) {
          console.error('Anthropic summary error:', err);
          categories = summarizeFeedbackHeuristic(rows);
          summarySource = 'heuristic_fallback';
        }
      } else {
        categories = summarizeFeedbackHeuristic(rows);
        summarySource = rows.length === 0 ? 'none' : client ? 'none' : 'heuristic';
      }

      res.json({ categories, total: rows.length, summarySource });
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
    const key = getAnthropicApiKey();
    res.json({
      aiEnabled: Boolean(key),
      summaryUsesLlm: Boolean(key),
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

    const client = createAnthropicClient();
    if (!client) {
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

  if (process.env.VERCEL !== '1') {
    const publicDir = path.join(process.cwd(), 'public');
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
    }
    app.get('*', (req, res) => {
      const indexPath = resolveIndexHtmlPath();
      if (!fs.existsSync(indexPath)) {
        console.error('Missing index.html at', indexPath);
        res.status(500).type('text').send('Server misconfiguration: index.html not found.');
        return;
      }
      res.sendFile(indexPath);
    });
  }

  return app;
}
