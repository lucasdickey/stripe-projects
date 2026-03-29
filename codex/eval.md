# Session Evaluation

## 1. Where the most churn was caused when interacting with Stripe Projects

The most churn came from hosting, especially `Railway/hosting`.

It provisioned successfully through Stripe Projects, but the resulting Railway project repeatedly landed in a workspace/account that the Railway CLI session could not access. That caused repeated cycles of login, link attempts, reprovisioning, URL checking, and retries. A secondary source of churn was the gap between "resource provisioned" and "runtime-ready connection details", especially for deploy-time database usage.

## 2. Which account did or didn't provision easily, and why

Accounts/providers that provisioned easily:

- Stripe authentication eventually completed cleanly.
- PostHog linked and provisioned easily.
- Chroma linked easily; provisioning worked once billing was completed.
- Vercel eventually provisioned cleanly once the provider-side account verification issue was resolved.

Accounts/providers that did not provision easily:

- Railway as a provider linked, but the actual hosting project did not provision into a CLI-accessible workspace. The main problem was not auth itself, but workspace/account mismatch after provisioning.
- The initial Vercel attempt failed because the provider required additional account verification/signup before project creation.

## 3. Which services did or didn't provision easily, and why

Services that provisioned easily:

- `railway/postgres`
- `posthog/analytics`
- `vercel/project` on the second attempt

Services that required extra steps:

- `chroma/database`
  It required billing setup and spend-limit confirmation because it is a paid service.

Services that did not provision easily:

- `railway/hosting`
  It required repo/image config, then provisioned into an inaccessible Railway workspace, and reprovisioning did not fix that workspace-access mismatch.

Services that provisioned but were still awkward operationally:

- `railway/postgres`
  It did not hand off a straightforward runtime-ready connection string in local env, so using it in the deployed runtime was not smooth.

## 4. Whether `projects.md` or the built-in skill was used to figure out what to do next

Both were used, but the built-in/generated guidance and live CLI state were more useful once the project existed.

- `projects.md` was used early to confirm the Stripe Projects CLI workflow and expected commands.
- After initialization, the built-in Stripe Projects guidance and generated provider skill files (`stripe-projects-cli`, `sp-posthog`, `sp-chroma`, `sp-vercel`) plus live `stripe projects status`, `catalog`, and `env` output were the main sources for next actions.
- In practice, the most useful source for "what next" was the live CLI state, not the static docs.
