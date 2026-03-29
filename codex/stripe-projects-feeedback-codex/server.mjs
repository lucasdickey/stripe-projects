import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CloudClient } from "chromadb";
import { PostHog } from "posthog-node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const envPath = path.join(__dirname, ".env");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

loadDotEnv(envPath);

const CATEGORY_RULES = [
  { label: "Onboarding", patterns: ["onboarding", "setup", "start", "getting started", "bootstrap"] },
  { label: "CLI Workflow", patterns: ["cli", "command", "terminal", "shell", "plugin"] },
  { label: "Authentication", patterns: ["auth", "oauth", "login", "signin", "sign in", "session"] },
  { label: "Environment Sync", patterns: ["env", ".env", "secret", "credential", "variable", "vault"] },
  { label: "Provider Integrations", patterns: ["provider", "vercel", "railway", "supabase", "neon", "turso", "clerk", "posthog", "chroma"] },
  { label: "Deployment", patterns: ["deploy", "hosting", "preview", "production", "rollback"] },
  { label: "Observability", patterns: ["logs", "trace", "monitor", "debug", "analytics", "metrics"] },
  { label: "Collaboration", patterns: ["team", "share", "collaborate", "workspace", "permissions"] },
  { label: "Billing", patterns: ["billing", "price", "cost", "quota", "usage", "upgrade"] },
  { label: "Documentation", patterns: ["docs", "documentation", "example", "guide", "tutorial"] },
  { label: "User Experience", patterns: ["ux", "ui", "layout", "navigation", "feedback", "form"] },
  { label: "Reliability", patterns: ["error", "retry", "fail", "stability", "timeout", "reliability"] }
];

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have",
  "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or", "our", "so", "that", "the",
  "their", "them", "there", "these", "this", "to", "us", "was", "we", "were", "will", "with", "would", "you", "your"
]);

const pgConfig = resolvePostgresConfig();
if (!pgConfig) {
  throw new Error("Postgres credentials are missing. Expected Railway/Postgres environment variables.");
}

const pool = new Pool(pgConfig);
const posthog = createPosthogClient();
const chromaCollectionPromise = createChromaCollection();
const bootstrapPromise = bootstrap();

function loadDotEnv(filename) {
  if (!existsSync(filename)) {
    return;
  }

  const lines = readFileSync(filename, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function resolvePostgresConfig() {
  let railwayVars = {};

  if (process.env.RAILWAY_POSTGRES_VARIABLES) {
    try {
      railwayVars = JSON.parse(process.env.RAILWAY_POSTGRES_VARIABLES);
    } catch {
      railwayVars = {};
    }
  }

  const connectionString =
    railwayVars.DATABASE_URL ||
    railwayVars.DATABASE_PUBLIC_URL ||
    railwayVars.POSTGRES_URL ||
    railwayVars.POSTGRESQL_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (connectionString) {
    return {
      connectionString,
      ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false }
    };
  }

  const hostValue = railwayVars.PGHOST || process.env.PGHOST;
  if (!hostValue) {
    return null;
  }

  return {
    host: hostValue,
    port: Number(railwayVars.PGPORT || process.env.PGPORT || 5432),
    user: railwayVars.PGUSER || process.env.PGUSER,
    password: railwayVars.PGPASSWORD || process.env.PGPASSWORD,
    database: railwayVars.PGDATABASE || process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false }
  };
}

function createPosthogClient() {
  if (!process.env.POSTHOG_API_KEY || !process.env.POSTHOG_HOST) {
    return null;
  }

  return new PostHog(process.env.POSTHOG_API_KEY, {
    host: process.env.POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0
  });
}

async function createChromaCollection() {
  if (!process.env.CHROMA_API_KEY || !process.env.CHROMA_DATABASE || !process.env.CHROMA_TENANT) {
    return null;
  }

  const client = new CloudClient();
  return client.getOrCreateCollection({
    name: "feedback_suggestions",
    metadata: {
      description: "Stripe Projects feedback messages"
    }
  });
}

async function bootstrap() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback_entries (
      id BIGSERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      twitter_handle TEXT NOT NULL DEFAULT '',
      agent TEXT NOT NULL DEFAULT '',
      categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function tokenize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@._-\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function normalizeHandle(value) {
  return value.trim().replace(/^@+/, "@");
}

function categorizeMessage(message) {
  const text = message.toLowerCase();
  const matched = CATEGORY_RULES
    .filter((rule) => rule.patterns.some((pattern) => text.includes(pattern)))
    .map((rule) => rule.label);

  if (matched.length > 0) {
    return matched;
  }

  const counts = new Map();
  for (const token of tokenize(message)) {
    if (token.length < 4) {
      continue;
    }
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const fallback = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([token]) => token[0].toUpperCase() + token.slice(1));

  return fallback.length > 0 ? fallback : ["General Feedback"];
}

async function listEntries() {
  const result = await pool.query(
    `SELECT id, message, twitter_handle AS "twitterHandle", agent, categories, created_at AS "createdAt"
     FROM feedback_entries
     ORDER BY created_at DESC, id DESC`
  );
  return result.rows;
}

async function listEntriesPage(page) {
  const pageSize = 100;
  const safePage = Math.max(1, Number(page || 1));
  const countResult = await pool.query("SELECT COUNT(*)::INT AS total FROM feedback_entries");
  const total = countResult.rows[0]?.total || 0;
  const offset = (safePage - 1) * pageSize;
  const rowsResult = await pool.query(
    `SELECT id, message, twitter_handle AS "twitterHandle", agent, categories, created_at AS "createdAt"
     FROM feedback_entries
     ORDER BY created_at DESC, id DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  return {
    page: safePage,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    rows: rowsResult.rows
  };
}

function summarizeEntries(entries) {
  const categoryMap = new Map();
  for (const entry of entries) {
    const categories = entry.categories?.length ? entry.categories : categorizeMessage(entry.message);
    for (const category of categories) {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          count: 0,
          examples: []
        });
      }
      const bucket = categoryMap.get(category);
      bucket.count += 1;
      if (bucket.examples.length < 3) {
        bucket.examples.push({
          id: entry.id,
          excerpt: entry.message.slice(0, 120)
        });
      }
    }
  }

  return [...categoryMap.values()]
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .slice(0, 10);
}

function scoreEntry(entry, queryTokens) {
  const haystack = `${entry.message} ${entry.twitterHandle || ""} ${entry.agent || ""}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += token.length > 4 ? 3 : 1;
    }
  }
  const categories = (entry.categories || []).join(" ").toLowerCase();
  for (const token of queryTokens) {
    if (categories.includes(token)) {
      score += 2;
    }
  }
  return score;
}

async function buildChatResponse(question) {
  const queryTokens = tokenize(question);
  const allEntries = await listEntries();
  const summary = summarizeEntries(allEntries);

  const collection = await chromaCollectionPromise;
  if (collection) {
    try {
      const result = await collection.query({
        queryTexts: [question],
        nResults: 5,
        include: ["documents", "metadatas", "distances"]
      });

      const ids = (result.ids?.[0] || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      if (ids.length > 0) {
        const rowsResult = await pool.query(
          `SELECT id, message, twitter_handle AS "twitterHandle", agent, categories, created_at AS "createdAt"
           FROM feedback_entries
           WHERE id = ANY($1::BIGINT[])`,
          [ids]
        );

        const rowMap = new Map(rowsResult.rows.map((row) => [row.id, row]));
        const matches = ids.map((id) => rowMap.get(id)).filter(Boolean);
        const topThemes = summarizeEntries(matches).slice(0, 3).map((item) => item.category);

        return {
          answer: `${topThemes.length > 0 ? `Relevant themes: ${topThemes.join(", ")}. ` : ""}Closest suggestions: ${matches.map((entry) => `#${entry.id}: ${entry.message}`).join(" ")}`,
          matches
        };
      }
    } catch {
      // Fall through to lexical search if Chroma query fails.
    }
  }

  const ranked = allEntries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.entry.createdAt).localeCompare(String(a.entry.createdAt)))
    .slice(0, 5)
    .map((item) => item.entry);

  if (ranked.length === 0) {
    if (summary.length === 0) {
      return {
        answer: "No feedback has been submitted yet, so there is nothing to search. Submit a few suggestions and the chat results will become useful.",
        matches: []
      };
    }

    return {
      answer: `I couldn't match that question directly, but the current leading themes are ${summary.slice(0, 3).map((item) => `${item.category} (${item.count})`).join(", ")}.`,
      matches: summary.flatMap((item) => item.examples)
    };
  }

  const topThemes = summarizeEntries(ranked).slice(0, 3).map((item) => item.category);
  return {
    answer: `${topThemes.length > 0 ? `Relevant themes: ${topThemes.join(", ")}. ` : ""}Closest suggestions: ${ranked.map((entry) => `#${entry.id}: ${entry.message}`).join(" ")}`,
    matches: ranked
  };
}

async function syncEntryToChroma(entry) {
  const collection = await chromaCollectionPromise;
  if (!collection) {
    return;
  }

  await collection.upsert({
    ids: [String(entry.id)],
    documents: [entry.message],
    metadatas: [
      {
        twitter_handle: entry.twitterHandle || "",
        agent: entry.agent || "",
        created_at: String(entry.createdAt),
        categories: (entry.categories || []).join("|")
      }
    ]
  });
}

function captureEvent(distinctId, event, properties) {
  if (!posthog) {
    return;
  }

  posthog.capture({
    distinctId,
    event,
    properties
  });
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const target = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, target));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  readFile(filePath)
    .then((buffer) => {
      const ext = path.extname(filePath);
      const contentType = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8"
      }[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(buffer);
    })
    .catch(() => {
      res.writeHead(404);
      res.end("Not found");
    });
}

export const server = createServer(async (req, res) => {
  await bootstrapPromise;
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, {
      ok: true,
      services: {
        postgres: true,
        chroma: Boolean(process.env.CHROMA_API_KEY),
        posthog: Boolean(process.env.POSTHOG_API_KEY)
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/summary") {
    const entries = await listEntries();
    json(res, 200, {
      total: entries.length,
      topCategories: summarizeEntries(entries)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/feedback") {
    json(res, 200, await listEntriesPage(url.searchParams.get("page")));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    json(res, 200, {
      posthogEnabled: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST),
      runtime: {
        database: "Railway Postgres",
        analytics: "PostHog",
        vector: process.env.CHROMA_API_KEY ? "Chroma" : "Disabled"
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/feedback") {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      json(res, 400, { error: "Invalid JSON body." });
      return;
    }

    const message = String(payload.message || "").trim();
    const twitterHandle = String(payload.twitterHandle || "").trim();
    const agent = String(payload.agent || "").trim();
    if (!message) {
      json(res, 400, { error: "Message is required." });
      return;
    }

    const categories = categorizeMessage(message);
    const insertResult = await pool.query(
      `INSERT INTO feedback_entries (message, twitter_handle, agent, categories)
       VALUES ($1, $2, $3, $4)
       RETURNING id, message, twitter_handle AS "twitterHandle", agent, categories, created_at AS "createdAt"`,
      [message, twitterHandle ? normalizeHandle(twitterHandle) : "", agent, categories]
    );
    const entry = insertResult.rows[0];

    await syncEntryToChroma(entry);
    captureEvent(`feedback-${entry.id}`, "feedback_submitted", {
      categories,
      has_twitter_handle: Boolean(entry.twitterHandle),
      agent: entry.agent || "unknown"
    });

    const entries = await listEntries();
    json(res, 201, {
      entry,
      topCategories: summarizeEntries(entries)
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      json(res, 400, { error: "Invalid JSON body." });
      return;
    }

    const question = String(payload.question || "").trim();
    if (!question) {
      json(res, 400, { error: "Question is required." });
      return;
    }

    const response = await buildChatResponse(question);
    captureEvent("chat-user", "feedback_chat_queried", {
      question_length: question.length,
      match_count: response.matches.length
    });
    json(res, 200, response);
    return;
  }

  serveStatic(req, res);
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, host, () => {
    console.log(`Feedback app listening on http://${host}:${port}`);
  });
}
