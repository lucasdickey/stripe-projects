import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

export function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || '';
}

export function createAnthropicClient() {
  const key = getAnthropicApiKey();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

function parseJsonArray(text) {
  let t = String(text).trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) t = fence[1].trim();
  const parsed = JSON.parse(t);
  if (!Array.isArray(parsed)) throw new Error('expected JSON array');
  return parsed;
}

function normalizeCategories(raw, max = 10) {
  const out = [];
  for (const item of raw) {
    if (out.length >= max) break;
    if (!item || typeof item !== 'object') continue;
    const label = String(item.label ?? item.title ?? '').trim().slice(0, 120);
    const count = Math.max(0, Math.floor(Number(item.count) || 0));
    if (!label || count < 1) continue;
    let id = String(item.id ?? item.slug ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 64);
    if (!id) {
      id = label
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 64);
    }
    if (!id) id = `theme_${out.length}`;
    out.push({ id, label, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, max);
}

/**
 * Cluster all feedback into up to 10 themes with counts (Anthropic Messages API).
 */
const MAX_SUBMISSIONS_FOR_SUMMARY = 200;

export async function summarizeCategoriesWithAnthropic(client, rows) {
  if (!rows.length) return [];

  const slice = rows.length > MAX_SUBMISSIONS_FOR_SUMMARY ? rows.slice(0, MAX_SUBMISSIONS_FOR_SUMMARY) : rows;

  const lines = slice.map((r, i) => {
    const meta = [r.twitter ? `x:${r.twitter}` : '', r.agent_used ? `agent:${r.agent_used}` : '']
      .filter(Boolean)
      .join(' ');
    const msg = String(r.message ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
    return `${i + 1}. ${msg}${meta ? ` (${meta})` : ''}`;
  });

  const corpus = lines.join('\n');
  const userPrompt = `You are analyzing public feedback about **Stripe Projects** (CLI, provisioning, providers, docs at docs.stripe.com/projects).

Below are ${slice.length} submissions (numbered; ${rows.length > slice.length ? `showing first ${slice.length} of ${rows.length} total` : 'full set'}). Return **only** valid JSON: an array of up to 10 objects, each:
{"id":"snake_case_id","label":"Short readable theme (2-7 words)","count":<integer>}

Rules:
- Themes are substantive clusters (not single-word duplicates).
- \`count\` = how many submissions you assign as **primary** fit for that theme (each submission counts toward **at most one** theme; apportion so totals are reasonable).
- Sort by count descending. Omit themes with count 0.
- Use lowercase snake_case for \`id\`, unique.

Submissions:
${corpus}`;

  const resp = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = (resp.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const arr = parseJsonArray(text);
  return normalizeCategories(arr, 10);
}
