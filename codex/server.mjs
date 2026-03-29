import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const feedbackFile = path.join(dataDir, "feedback.json");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

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

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(feedbackFile, "utf8");
  } catch {
    await writeFile(feedbackFile, "[]\n", "utf8");
  }
}

async function readEntries() {
  await ensureStore();
  const raw = await readFile(feedbackFile, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeEntries(entries) {
  await ensureStore();
  await writeFile(feedbackFile, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
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

function summarizeEntries(entries) {
  const categoryMap = new Map();
  for (const entry of entries) {
    const categories = categorizeMessage(entry.message);
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
  const categories = categorizeMessage(entry.message).join(" ").toLowerCase();
  for (const token of queryTokens) {
    if (categories.includes(token)) {
      score += 2;
    }
  }
  return score;
}

function buildChatResponse(entries, question) {
  const queryTokens = tokenize(question);
  const ranked = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.createdAt.localeCompare(a.entry.createdAt))
    .slice(0, 5);

  if (ranked.length === 0) {
    const summary = summarizeEntries(entries).slice(0, 3);
    if (summary.length === 0) {
      return {
        answer: "No feedback has been submitted yet, so there is nothing to search. Submit a few suggestions and the chat results will become useful.",
        matches: []
      };
    }

    return {
      answer: `I couldn't match that question directly, but the current leading themes are ${summary.map((item) => `${item.category} (${item.count})`).join(", ")}.`,
      matches: summary.flatMap((item) => item.examples)
    };
  }

  const categoryCounts = new Map();
  for (const { entry } of ranked) {
    for (const category of categorizeMessage(entry.message)) {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
  }

  const topThemes = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([category]) => category);

  const answer = [
    topThemes.length > 0 ? `Relevant themes: ${topThemes.join(", ")}.` : null,
    "Closest suggestions:",
    ...ranked.map(({ entry }) => `#${entry.id}: ${entry.message}`)
  ]
    .filter(Boolean)
    .join(" ");

  return {
    answer,
    matches: ranked.map(({ entry }) => ({
      id: entry.id,
      message: entry.message,
      twitterHandle: entry.twitterHandle,
      agent: entry.agent,
      createdAt: entry.createdAt
    }))
  };
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
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/summary") {
    const entries = await readEntries();
    json(res, 200, {
      total: entries.length,
      topCategories: summarizeEntries(entries)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/feedback") {
    const entries = await readEntries();
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = 100;
    const ordered = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (page - 1) * pageSize;
    const slice = ordered.slice(start, start + pageSize);
    json(res, 200, {
      page,
      pageSize,
      total: ordered.length,
      totalPages: Math.max(1, Math.ceil(ordered.length / pageSize)),
      rows: slice
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

    const entries = await readEntries();
    const entry = {
      id: entries.length === 0 ? 1 : Math.max(...entries.map((item) => item.id)) + 1,
      message,
      twitterHandle: twitterHandle ? normalizeHandle(twitterHandle) : "",
      agent,
      createdAt: new Date().toISOString()
    };

    entries.push(entry);
    await writeEntries(entries);

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

    const entries = await readEntries();
    json(res, 200, buildChatResponse(entries, question));
    return;
  }

  serveStatic(req, res);
});

await ensureStore();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, host, () => {
    console.log(`Feedback app listening on http://${host}:${port}`);
  });
}
