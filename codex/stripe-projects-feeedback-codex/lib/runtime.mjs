import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CloudClient } from "chromadb";
import { PostHog } from "posthog-node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

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
const pool = pgConfig ? new Pool(pgConfig) : null;
const posthog = createPosthogClient();
const chromaCollectionPromise = createChromaCollection();
const bootstrapPromise = bootstrap();

function loadDotEnv(filename) {
  try {
    const lines = readFileSync(filename, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

function resolvePostgresConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) return null;
  return {
    connectionString,
    ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false }
  };
}

function createPosthogClient() {
  if (!process.env.POSTHOG_API_KEY || !process.env.POSTHOG_HOST) return null;
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
    metadata: { description: "Stripe Projects feedback messages" }
  });
}

async function bootstrap() {
  if (!pool) return;
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

export function normalizeHandle(value) {
  return value.trim().replace(/^@+/, "@");
}

export function tokenize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@._-\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

export function categorizeMessage(message) {
  const text = message.toLowerCase();
  const matched = CATEGORY_RULES
    .filter((rule) => rule.patterns.some((pattern) => text.includes(pattern)))
    .map((rule) => rule.label);
  if (matched.length > 0) return matched;

  const counts = new Map();
  for (const token of tokenize(message)) {
    if (token.length < 4) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  const fallback = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([token]) => token[0].toUpperCase() + token.slice(1));
  return fallback.length > 0 ? fallback : ["General Feedback"];
}

function normalizeEntry(entry) {
  return {
    id: Number(entry.id),
    message: entry.message,
    twitterHandle: entry.twitterHandle || "",
    agent: entry.agent || "",
    categories: Array.isArray(entry.categories) ? entry.categories : [],
    createdAt: entry.createdAt
  };
}

async function listEntriesFromPostgres() {
  if (!pool) return [];
  await bootstrapPromise;
  const result = await pool.query(
    `SELECT id, message, twitter_handle AS "twitterHandle", agent, categories, created_at AS "createdAt"
     FROM feedback_entries
     ORDER BY created_at DESC, id DESC`
  );
  return result.rows.map(normalizeEntry);
}

async function listEntriesFromChroma() {
  const collection = await chromaCollectionPromise;
  if (!collection) return [];
  const result = await collection.get({
    include: ["documents", "metadatas"]
  });
  const ids = result.ids || [];
  const documents = result.documents || [];
  const metadatas = result.metadatas || [];
  const entries = ids.map((id, index) =>
    normalizeEntry({
      id,
      message: documents[index] || "",
      twitterHandle: metadatas[index]?.twitter_handle || "",
      agent: metadatas[index]?.agent || "",
      categories: typeof metadatas[index]?.categories === "string" && metadatas[index].categories
        ? metadatas[index].categories.split("|").filter(Boolean)
        : [],
      createdAt: metadatas[index]?.created_at || new Date(0).toISOString()
    })
  );
  return entries.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.id - a.id);
}

export async function listEntries() {
  if (pool) {
    try {
      return await listEntriesFromPostgres();
    } catch {}
  }
  return listEntriesFromChroma();
}

export async function insertEntry({ message, twitterHandle, agent }) {
  const categories = categorizeMessage(message);
  let entry;

  if (pool) {
    try {
      await bootstrapPromise;
      const inserted = await pool.query(
        `INSERT INTO feedback_entries (message, twitter_handle, agent, categories)
         VALUES ($1, $2, $3, $4)
         RETURNING id, message, twitter_handle AS "twitterHandle", agent, categories, created_at AS "createdAt"`,
        [message, twitterHandle ? normalizeHandle(twitterHandle) : "", agent, categories]
      );
      entry = normalizeEntry(inserted.rows[0]);
    } catch {}
  }

  if (!entry) {
    entry = normalizeEntry({
      id: Date.now(),
      message,
      twitterHandle: twitterHandle ? normalizeHandle(twitterHandle) : "",
      agent,
      categories,
      createdAt: new Date().toISOString()
    });
  }

  const collection = await chromaCollectionPromise;
  if (collection) {
    await collection.upsert({
      ids: [String(entry.id)],
      documents: [entry.message],
      metadatas: [
        {
          twitter_handle: entry.twitterHandle,
          agent: entry.agent,
          created_at: entry.createdAt,
          categories: entry.categories.join("|")
        }
      ]
    });
  }

  captureEvent(`feedback-${entry.id}`, "feedback_submitted", {
    categories,
    has_twitter_handle: Boolean(entry.twitterHandle),
    agent: entry.agent || "unknown"
  });

  return entry;
}

export function summarizeEntries(entries) {
  const categoryMap = new Map();
  for (const entry of entries) {
    const categories = entry.categories?.length ? entry.categories : categorizeMessage(entry.message);
    for (const category of categories) {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, count: 0, examples: [] });
      }
      const bucket = categoryMap.get(category);
      bucket.count += 1;
      if (bucket.examples.length < 3) {
        bucket.examples.push({ id: entry.id, excerpt: entry.message.slice(0, 120) });
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
  for (const token of queryTokens) if (haystack.includes(token)) score += token.length > 4 ? 3 : 1;
  const categories = (entry.categories || []).join(" ").toLowerCase();
  for (const token of queryTokens) if (categories.includes(token)) score += 2;
  return score;
}

export async function buildChatResponse(question) {
  const queryTokens = tokenize(question);
  const allEntries = await listEntries();
  const summary = summarizeEntries(allEntries);

  const collection = await chromaCollectionPromise;
  if (collection) {
    try {
      const result = await collection.query({
        queryTexts: [question],
        nResults: 5,
        include: ["documents", "metadatas"]
      });
      const matches = (result.ids?.[0] || []).map((id, index) =>
        normalizeEntry({
          id,
          message: result.documents?.[0]?.[index] || "",
          twitterHandle: result.metadatas?.[0]?.[index]?.twitter_handle || "",
          agent: result.metadatas?.[0]?.[index]?.agent || "",
          categories: typeof result.metadatas?.[0]?.[index]?.categories === "string"
            ? result.metadatas[0][index].categories.split("|").filter(Boolean)
            : [],
          createdAt: result.metadatas?.[0]?.[index]?.created_at || new Date(0).toISOString()
        })
      ).filter((entry) => entry.message);

      if (matches.length > 0) {
        const topThemes = summarizeEntries(matches).slice(0, 3).map((item) => item.category);
        captureEvent("chat-user", "feedback_chat_queried", {
          question_length: question.length,
          match_count: matches.length
        });
        return {
          answer: `${topThemes.length > 0 ? `Relevant themes: ${topThemes.join(", ")}. ` : ""}Closest suggestions: ${matches.map((entry) => `#${entry.id}: ${entry.message}`).join(" ")}`,
          matches
        };
      }
    } catch {}
  }

  const ranked = allEntries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.entry.createdAt).localeCompare(String(a.entry.createdAt)))
    .slice(0, 5)
    .map((item) => item.entry);

  captureEvent("chat-user", "feedback_chat_queried", {
    question_length: question.length,
    match_count: ranked.length
  });

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

export function paginateEntries(entries, page) {
  const pageSize = 100;
  const safePage = Math.max(1, Number(page || 1));
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    total: entries.length,
    totalPages: Math.max(1, Math.ceil(entries.length / pageSize)),
    rows: entries.slice(start, start + pageSize)
  };
}

function captureEvent(distinctId, event, properties) {
  if (!posthog) return;
  posthog.capture({ distinctId, event, properties });
}

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export async function handleApi(req, res) {
  await bootstrapPromise;
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      services: {
        postgres: Boolean(pool),
        chroma: Boolean(process.env.CHROMA_API_KEY),
        posthog: Boolean(process.env.POSTHOG_API_KEY)
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    return json(res, 200, {
      posthogEnabled: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST),
      runtime: {
        database: pool ? "Railway Postgres" : "Chroma",
        analytics: "PostHog",
        vector: process.env.CHROMA_API_KEY ? "Chroma" : "Disabled",
        hosting: "Vercel"
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/summary") {
    const entries = await listEntries();
    return json(res, 200, { total: entries.length, topCategories: summarizeEntries(entries) });
  }

  if (req.method === "GET" && url.pathname === "/api/feedback") {
    const entries = await listEntries();
    return json(res, 200, paginateEntries(entries, url.searchParams.get("page")));
  }

  if (req.method === "POST" && url.pathname === "/api/feedback") {
    const payload = await readJsonBody(req, res);
    if (!payload) return;
    const message = String(payload.message || "").trim();
    const twitterHandle = String(payload.twitterHandle || "").trim();
    const agent = String(payload.agent || "").trim();
    if (!message) return json(res, 400, { error: "Message is required." });
    const entry = await insertEntry({ message, twitterHandle, agent });
    const entries = await listEntries();
    return json(res, 201, { entry, topCategories: summarizeEntries(entries) });
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const payload = await readJsonBody(req, res);
    if (!payload) return;
    const question = String(payload.question || "").trim();
    if (!question) return json(res, 400, { error: "Question is required." });
    return json(res, 200, await buildChatResponse(question));
  }

  return json(res, 404, { error: "Not found." });
}

async function readJsonBody(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    json(res, 400, { error: "Invalid JSON body." });
    return null;
  }
}
