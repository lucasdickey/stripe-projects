/** Rule-based category rollup when Anthropic is unavailable or fails. */

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

export function summarizeFeedbackHeuristic(rows) {
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
