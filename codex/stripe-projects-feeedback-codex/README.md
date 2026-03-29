# Stripe Projects Feedback App

Single-page web app for collecting Stripe Projects improvement suggestions, summarizing the top request categories, and chatting with the submitted backlog.

## Selected stack

Chosen from the live `stripe projects catalog` during this session:

- Compute: `Railway/hosting` selected initially, then revised to `Vercel/project` after Railway hosting required a repo or image source during provisioning
- Database: `Railway/postgres`
- Vector: `Chroma/database`
- Analytics: `PostHog/analytics`

## Current implementation

This workspace is runnable without external dependencies:

- Node.js HTTP server in [`server.mjs`](/Users/lucasdickey/Documents/code/stripe-projects/codex/server.mjs)
- Static SPA in [`public/index.html`](/Users/lucasdickey/Documents/code/stripe-projects/codex/public/index.html)
- Local JSON persistence in [`data/feedback.json`](/Users/lucasdickey/Documents/code/stripe-projects/codex/data/feedback.json)

The runtime stores:

- suggestion message
- optional Twitter handle
- optional agent name
- submission timestamp

The UI includes:

- inline feedback form
- top-10 category summary on initial load
- chat endpoint that searches the submitted feedback and returns the closest matching suggestions
- table view with 100 rows per page

## Stripe Projects workflow

Official docs used: `https://docs.stripe.com/projects.md`

Project initialization was completed with:

```bash
stripe projects init stripe-projects-feeedback-codex
```

Provisioning commands used during this session:

```bash
stripe projects add railway/hosting
stripe projects add railway/postgres
stripe projects add chroma/database
stripe projects add posthog/analytics
stripe projects env --pull
```

Current provisioning status in the generated Stripe project directory:

- `Railway/postgres`: provisioned
- `PostHog/analytics`: provisioned
- `Chroma/database`: linked, awaiting billing confirmation
- `Vercel/project`: blocked on provider-side account verification

## Run locally

```bash
npm run dev
```

Then open `http://localhost:3000`.
