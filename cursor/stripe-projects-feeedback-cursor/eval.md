# Stripe Projects session evaluation

Brief evaluation based on conversation summary and `catalog-stack.json` (not every Stripe CLI line from the original session).

## 1. Where the most churn was (Stripe Projects)

**Compute/hosting and account linking**, not the data/auth/analytics pieces. The catalog shows **Railway hosting** hitting a **free-plan provision limit**, **Vercel** stalling on **account linking (browser auth)**, and **Runloop** blocked by **plan**. Storage was **de-prioritized** after Railway failed, with **Supabase** left **unknown/pending**. Separately (but high drag overall), **Vercel runtime** churn came from **routing/Express vs static**, not from “add resource” in Stripe Projects itself.

## 2. Accounts: easy vs not

- **Rough:** **Railway** (resource limit on free tier), **Vercel** (first pass: **linking/auth timeout**), **Runloop** (**paid plan** required for sandbox).
- **Smoother:** Implied by successful adds for **Turso, Chroma, Clerk, PostHog** — those paths completed without the same class of blockers in the recorded `successful_adds`.

## 3. Services: easy vs not

| Outcome | Services | Why (from catalog) |
|--------|-----------|---------------------|
| **Provisioned cleanly** | **Turso**, **Chroma**, **Clerk**, **PostHog** | Documented as complete with concrete `stripe projects add …` examples. |
| **Not easy / blocked** | **Railway** (hosting) | Free-tier **resource limit**. |
| **Not easy** | **Vercel** (project) | First attempt: **timed out waiting for account linking** (manual browser step). Hosting later worked (separate deployment path / app name). |
| **Blocked** | **Runloop** (sandbox) | **Active plan required**. |
| **Unclear / follow-up** | **Supabase** | Marked **unknown_or_pending**; may need **browser linking** and re-run. |
| **Skipped** | **Railway** (bucket) | Skipped after hosting limit; suggests **Supabase or paid Railway**. |

## 4. `projects.md` vs built-in skill

- **`projects.md`:** A search under `stripe-projects` did not turn up a **`projects.md`** in the repo at the time of this eval; work referenced **`catalog-stack.json`** plus session summary — not a `projects.md`.
- **Built-in skill:** The Cursor agent skills list for this workspace is things like **create-rule**, **create-skill**, **openai-docs**, etc. — **nothing Stripe Projects–specific** there. The prior session, as summarized, looked like **catalog JSON + CLI + `catalog-stack.json`**, not a dedicated “Stripe Projects” skill file.
