# Yap: Multi-Tenant Coding Agent Platform

**Status:** Planning / pre-implementation
**Author:** Dylan (+ AI-assisted planning)
**Last updated:** April 2026

---

## 1. Vision

Yap is a Slack-first, multi-tenant coding agent platform. Teams connect their Slack workspace, GitHub org, and (optionally) their own Vercel account, and any team member can request code changes through a chat interface. The agent runs in isolated sandboxes, opens PRs, and surfaces live preview URLs back into the conversation — abstracting away the dev-environment and deployment knowledge normally required to ship.

Think "Cursor, but async, Slack-native, and with zero local setup." The closest existing analogue for the UX pattern is Ramp's internal "Inspect" tool ([https://builders.ramp.com/post/why-we-built-our-background-agent](https://builders.ramp.com/post/why-we-built-our-background-agent)): any teammate can request a change, any teammate can review, nobody needs a local dev environment.

## 2. Starting Point: Vercel's Open Agents Template

We're forking `[vercel-labs/open-agents](https://github.com/vercel-labs/open-agents)` as the scaffold. It's the best public reference architecture for what we're building.

### Why this template

The template gets three critical things right:

- **Three-layer separation:** Web UI → durable agent workflow → sandbox VM. The agent runs *outside* the sandbox and interacts with it through tools (read, edit, search, shell). This is exactly the pattern we'd otherwise build from scratch.
- **Durable workflows via Vercel's Workflow SDK.** Agent runs persist across many steps, can be cancelled and resumed, and aren't tied to a single HTTP request lifecycle. A user can close their laptop and the agent keeps going.
- **Installation-based GitHub App integration** already wired up — the correct pattern for multi-tenant, where each customer org installs our app on the repos they want.

### What the template is missing (and we must build)

- **No tenant model.** Every session, sandbox, and GitHub installation implicitly belongs to "the deployment." No workspaces, no RLS, no BYOK.
- **Vercel OAuth used as the identity provider.** Wrong for us — forces every end user to have a Vercel account.
- **No Slack surface.** Web chat only.
- **No billing / metering.**
- **Sandbox snapshots are deployment-wide**, not per-workspace.

## 3. Key Architectural Commitments

We're deliberately committing hard to Vercel's ecosystem to reduce integration surface area. These commitments are made up-front and shape every downstream decision:

1. **Single Yap deployment runs on our Vercel account.** All sandboxes are billed to us, passed through to customers via Stripe metering. See §4 for why we can't bill sandboxes to users' Vercel accounts directly.
2. **Chat SDK ([chat-sdk.dev](https://chat-sdk.dev)) as the chat abstraction.** Slack first, but written against the adapter interface so Teams / Discord / Google Chat come later without a rewrite.
3. **Supabase** stays as DB + auth + RLS layer. Not swapping to Vercel Postgres — RLS is the whole game for tenant isolation and Supabase does it natively.
4. **BYOK for LLM tokens** at the workspace level (Anthropic key required, others optional). We meter sandbox minutes via Stripe.
5. **"Connect your Vercel" is for the customer's application previews, not for Yap's runtime.** See §5 for the full model.

## 4. Important Correction: Sandbox Billing Cannot Be Passed to Users' Vercel Accounts

An early design instinct was to piggyback on users connecting their own Vercel accounts — "make Yap an all-in-one solution where using it requires Vercel, similar to how some products require Google Workspace." This doesn't work for sandbox compute, and the reason matters:

Vercel Sandboxes run in whichever Vercel team holds the API token that created them. All Sandbox usage on Pro plans is charged against the $20/month credit of *that* team, and then billed at list rates. There is no API mechanism to "run this sandbox in the customer's Vercel team and bill them directly."

Workarounds that technically function but don't actually work:

- **Each customer creates their own Vercel team and pastes a token:** terrible onboarding; breaks multi-user workspaces (whose token gets used when teammate B triggers a run?); a sandbox created by one teammate is invisible to others sharing the workspace.
- **Yap orchestrates deployments to customer's Vercel:** only applies to the *output* (their app's preview), not the sandbox where the agent works.

### The model that actually works

**We stay the Vercel customer for sandbox compute.** We meter usage and pass it through via Stripe. This is identical to your earlier Modal cost-calculator conclusion: sandbox compute is cheap relative to LLM tokens (which go BYOK direct to the customer's Anthropic bill), so metering + markup is viable.

**We "piggyback on the user's Vercel" only for their own app's preview deployments.** When the agent pushes a branch, the customer's Vercel auto-builds a preview and Yap surfaces the URL in the chat thread. This is the genuine differentiator: Cursor has no "here's your running branch" story at all.

The Gmail/Calendar analogy done right: *their* product's hosting lives in *their* Vercel; Yap's runtime lives in *ours*.

## 5. System Architecture

```
          ┌─────────────────────────────────────────────────┐
          │           Yap (our Vercel account)         │
          │                                                 │
Slack ───►│  ┌──────────┐   ┌──────────────┐   ┌─────────┐ │
          │  │ Chat SDK │──►│  Next.js app │──►│Workflow │ │
Web UI ──►│  │ adapters │   │ (auth, UI,   │   │  SDK    │ │
          │  └──────────┘   │  tenant mgmt)│   │ (agent) │ │
          │                 └──────┬───────┘   └────┬────┘ │
          │                        │                │      │
          │                        ▼                ▼      │
          │                 ┌──────────────────────────┐   │
          │                 │ Supabase (Postgres + RLS)│   │
          │                 └──────────────────────────┘   │
          │                                 │              │
          │                                 ▼              │
          │                  ┌──────────────────────────┐  │
          │                  │ Vercel Sandbox (per run) │  │
          │                  └───────────┬──────────────┘  │
          └──────────────────────────────┼─────────────────┘
                                         │ git push
                                         ▼
                               ┌─────────────────┐
                               │ Customer GitHub │
                               └────────┬────────┘
                                        │ webhook
                                        ▼
                           ┌──────────────────────────┐
                           │ Customer's Vercel team   │
                           │  (preview deployments)   │
                           └──────────────────────────┘
                                        │
                                        ▼
                       Preview URL surfaced back into Slack thread
```

**Key properties:**

- Agent execution is decoupled from sandbox lifecycle (template gives us this).
- Sandbox is operator-paid, metered, passed through to customer.
- Customer's preview deployments are on their own Vercel account, auto-built by their own Vercel project. We just look up the URL and surface it.

## 6. Data Model

### New tables


| Table                           | Purpose                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workspaces`                    | id, name, slug, plan_tier, created_at                                                                                                                                                |
| `workspace_members`             | workspace_id, user_id, role (owner / admin / member)                                                                                                                                 |
| `workspace_invitations`         | pending invites (email + role + expiry)                                                                                                                                              |
| `workspace_secrets`             | encrypted BYOK storage (Anthropic key, optionally OpenAI, customer's Vercel personal token) — reuse the template's `ENCRYPTION_KEY` + encryption helpers rather than rolling our own |
| `workspace_billing`             | Stripe customer id, subscription id, metered usage counters                                                                                                                          |
| `workspace_vercel_connections`  | OAuth tokens for the customer's Vercel (separate from Yap's own Vercel credentials which stay in env vars)                                                                           |
| `workspace_slack_installations` | per-workspace Slack bot tokens, team_id, default channel preferences                                                                                                                 |


### Modifications to existing template tables

Every existing table (`sessions`, `runs`, `sandboxes`, `github_installations`, `user_preferences`, etc.) gets a `workspace_id` foreign key and RLS policies keyed off `auth.jwt()->>'workspace_id'`.

Specific constraints worth calling out:

- `github_installations` gets `workspace_id` with a unique constraint — a GitHub org can only be installed in one workspace.
- `workspace_secrets` values are encrypted at rest using the template's existing encryption helper (`ENCRYPTION_KEY`).
- Indices on `(workspace_id, created_at)` on sessions and runs — all list queries will be workspace-scoped.

### RLS policy pattern

```sql
-- Example: sessions table
alter table sessions enable row level security;

create policy "members see own workspace sessions"
  on sessions for select
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "members create in own workspace"
  on sessions for insert
  with check (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );
```

Apply the same pattern to every workspace-scoped table. Admin-only operations (managing secrets, billing, disconnecting integrations) get additional role checks.

## 7. Auth Redesign

The template uses Vercel OAuth as the identity provider. We split this into two concepts:

### Yap identity (new)

Supabase Auth. Email + magic link to start; Google OAuth as an optional provider. This is who the user *is*, independent of any integration.

### Per-workspace integrations (repurposed)

The existing Vercel OAuth code gets moved out of the sign-in path and into workspace settings as a connection action: "Connect your Vercel to get preview URLs in Slack."

Same pattern for:

- Slack installation (new, via Chat SDK)
- GitHub App installation (already in template, just rebind to workspace instead of user)
- Vercel connection (repurposed from template's sign-in path)

### Workspace switching

Users can belong to multiple workspaces. JWT claim `workspace_id` is scoped per session; switcher in the top nav issues a new session token with the target workspace_id.

## 8. Agent / Sandbox Plumbing Changes

Every tool invocation, every workflow run, every sandbox create/resume call needs `workspace_id` threaded through. Concretely:

- **Workflow runs** gain `workspace_id` and `slack_channel_id` (nullable) in their payload.
- **Sandbox creation** reads model provider keys from `workspace_secrets`, not from deployment-wide env vars.
- **Sandbox snapshots** stay one-shared-base for v1, become per-workspace in v2 (so a workspace's Python / Ruby / custom-toolchain choices persist across sessions).
- **Agent tool-call context** carries `workspace_id` so logs, artifacts, and PR attribution all bind correctly.
- **Cost accounting hooks** on sandbox create + teardown push usage events to Stripe tagged by workspace.

## 9. Chat Layer: Slack via Chat SDK

Chat SDK is Vercel's unified TypeScript SDK for chat bots across Slack, Teams, Google Chat, Discord and more. Write bot logic once, deploy to any platform. It has a ready-made Slack + Next.js + Redis guide and — critically — a code-review-bot-with-Vercel-Sandbox guide that's essentially Yap's reference architecture written up by Vercel themselves.

### Integration shape

- One shared Chat SDK bot instance running on a webhook route in the Next.js app
- Slack adapter receives events → resolves `team_id` → `workspace_id` via `workspace_slack_installations` → starts or resumes a workflow run scoped to that workspace
- Web UI and Slack become two entry points into the **same** session model. A user can kick off a run in Slack and watch it continue in the web UI. The template's durable workflow design already decouples the run from any particular client, so this is cheaper than it sounds.

### The Ramp "Inspect" pattern on top

- Any teammate `@Yap`s a thread with a request
- Agent runs, opens PR, posts back a Chat SDK card with:
  - PR link
  - Live preview URL (from §10)
  - Approve / request changes / merge actions
- Any teammate (with appropriate role) can action the card

### Chat SDK beta caveat

Chat SDK is currently in beta. Shipping production on it is a real commitment to tracking upstream. Given our whole stack is already Vercel-committed and Chat SDK is Vercel-maintained, the risk is acceptable — but flag it.

## 10. Preview URL Surfacing (the differentiator)

Once the user has connected their Vercel via workspace-level OAuth:

1. Agent pushes branch to customer GitHub
2. Their Vercel project auto-builds a preview (existing Vercel behaviour, zero work on our side)
3. Yap either:
  - Polls Vercel's API for the deployment matching the branch name, OR
  - Receives a Vercel deployment webhook → our handler → pushes chat update
4. Preview URL surfaced as a Chat SDK card: "Preview ready:  · View diff · Merge"

Small feature in isolation, huge differentiator vs Cursor. Budget ~1 week.

### Limitation worth noting

Vercel Sandbox is currently only available in the `iad1` (US East) region. For UK/EU customers this adds ~100ms latency per shell tool call. Not a blocker for v1 but tell customers.

## 11. Billing

- Stripe Checkout for workspace subscriptions (per-seat tier + metered sandbox minutes)
- Usage records posted from sandbox lifecycle hooks via `stripe.subscription_items.createUsageRecord`
- **BYOK means we don't meter LLM tokens at all** — those go direct to the customer's Anthropic bill. We only meter what *we* pay for: sandbox compute, storage, maybe Slack message volume if it becomes a cost
- Stripe customer portal for self-serve billing management
- Free tier: N minutes of sandbox compute/month; paid tiers unlock more + seats

## 12. GitHub App Scoping

The template's GitHub App is already installation-based, which is right. The only change: when a user initiates the install flow, bind the resulting `installation_id` to their **workspace**, not to their user. Workspace-admin-only permission controls who can connect / disconnect repos.

One shared Yap GitHub App (rather than per-workspace apps) is simpler and how most SaaS does it (Vercel, Linear, etc.). Verify GitHub App installation limits don't bite at scale — unlikely at our stage.

## 13. Build Order (8-week v1)


| Week | Focus                       | Deliverable                                                                                                                                                                                                                                                                                    |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2  | **Tenancy foundation**      | Fork template. Migrate Supabase schema: workspaces, members, RLS policies. Rip out Vercel-OAuth-as-auth, replace with Supabase Auth. Repurpose Vercel OAuth code as the "connect Vercel for previews" settings action. Thread `workspace_id` through every existing tool and workflow handler. |
| 3–4  | **BYOK + billing skeleton** | `workspace_secrets` table, settings UI for Anthropic key entry, wire sandbox creation to read from workspace secrets. Stripe integration: subscription creation, metered usage events emitted from sandbox lifecycle.                                                                          |
| 5–6  | **Slack via Chat SDK**      | Install Chat SDK + Slack adapter. Build Slack install flow. Implement `@Yap` mention → run agent → post PR back pattern. Mirror Inspect approve/reject card UX.                                                                                                                                |
| 7    | **Preview URL surfacing**   | Vercel OAuth for customer's Vercel, deployment URL lookup, Chat SDK card integration.                                                                                                                                                                                                          |
| 8    | **Polish**                  | Workspace invitations UI, audit logging, onboarding flow, ship v1.                                                                                                                                                                                                                             |


## 14. Open Questions & Risks

**Chat SDK beta risk.** Upstream churn possible. Mitigation: pin versions, review changelog weekly, keep adapter layer thin enough to swap if needed.

`**iad1`-only sandbox latency for EU users.** Flag to customers. No workaround until Vercel adds regions.

**Monorepo tooling:** template uses Bun + Turborepo.

**Per-workspace sandbox snapshots:** v2 concern. For v1, the template's shared base snapshot (Node + git + dev servers) covers most customer stacks. Revisit when a customer needs Python / Ruby / Postgres.

**Workflow SDK lock-in.** Durable runs depend on Vercel's Workflow SDK. Ever wanting to leave Vercel's platform means a real migration. Fine for v1; go in eyes-open.

**Vercel-labs maintenance model.** The template is a reference implementation, not a maintained library. Forking means we own it — no upstream bugfixes. Healthy right now (3k stars, ~900 commits) but treat it as a starting skeleton we adopt, not a dependency we track.

## 15. Decisions Already Made (Don't Re-Litigate)

These came out of prior architectural sessions and the analysis above. They're locked for v1:

- Slack-first chat surface; web UI secondary
- BYOK for Anthropic key at workspace level
- Stripe metered billing for sandbox compute
- Supabase for DB + auth + RLS
- GitHub as sole Git provider for MVP
- One shared Yap GitHub App (not per-workspace)
- Vercel Sandbox for execution (not E2B, not Modal, not self-hosted agentOS/VFS for v1)
- Ramp "Inspect" pattern for review UX
- Yap bills customers directly; does not attempt to route sandbox compute through customers' Vercel accounts

## 16. Appendix: Repo Layout (from template)

```
apps/web          Next.js app, workflows, auth, chat UI
packages/agent    agent implementation, tools, subagents, skills
packages/sandbox  sandbox abstraction and Vercel sandbox integration
packages/shared   shared utilities
```

Expect to add:

```
packages/chat     Chat SDK bot definition, Slack handlers, card components
packages/billing  Stripe integration, usage metering, plan definitions
packages/tenant   Workspace model, invitations, RLS helpers, auth guards
```

## 17. References

- [Open Agents template (vercel-labs/open-agents)](https://github.com/vercel-labs/open-agents)
- [Chat SDK docs](https://chat-sdk.dev)
- [Chat SDK: Slack + Next.js + Redis guide](https://chat-sdk.dev/docs/guides/slack-nextjs)
- [Chat SDK: Code review bot with Vercel Sandbox](https://chat-sdk.dev/docs/guides/code-review-hono)
- [Vercel Sandbox pricing](https://vercel.com/docs/vercel-sandbox/pricing)
- [Vercel Workflow SDK](https://useworkflow.dev)

