# Agents.md — firstkey (Convex All Gas Hackathon)

> This file is written **for the agent**, not for public documentation. It **supplements**—and never replaces—the auto-generated block `<!-- convex-ai-start -->...<!-- convex-ai-end -->` already present at the top of `AGENTS.md`/`CLAUDE.md` in this repo, managed by `npx convex ai-files install`. Do not delete or duplicate it here: paste the content below **after** this block.
>
> Last sync: actual code from the repo (commit `a157e9d`) + strategy conversation “Analysis and Strategy for a Winning Project” (analysis of hackathon rules + architecture decisions). If the two diverge, this file explicitly flags the discrepancy rather than silently overriding it.

## Hackathon Context — Rules and Judging Criteria

- **Event**: Convex All Gas Hackathon. Timeframe: August 25 → September 22, 12:00 PM PT. Solo, part-time.
- **Required for submission**: new app started after 08/25 ✅, Convex backend ✅, public GitHub repo ✅, deployed on `convex.site` (no localhost), demo video < 3 min, X/LinkedIn post tagging **@convex @OpenAI @firecrawl @agentmail**, submission on vibeapps.dev.
- **Judging criteria, in order of importance**:
  1. **Real-world use** — “a real person would use this this week.” A consumer or SMB product in a real industry, not a developer tool. *“Copycats and developer-only tools score low.”*
  2. **Actual Convex depth** (queries/mutations/live updates/auth/components) — *"A thin frontend on a hosted page does not count."*
  3. **Sponsors must actually do real work within the product** — Firecrawl, OpenAI, and AgentMail must each perform real work **at runtime**, not just be mentioned or used for coding (Codex does not count for OpenAI).
  4. Functional public URL, short video demo, social traction.
- **Non-negotiable judging requirement currently violated by the code**: *the listing feed must be publicly visible without requiring a login.* A judge opening the URL `convex.site` must see the product in action immediately — Clerk should only protect the personal profile and inbox, never the main feed.

## Product

**Rental Copilot** (working title): a co-pilot for finding housing in Geneva. It detects new listings posted directly on real estate agencies’ websites (Naef, de Rham, Fongérant, Gérofinance, SPG-Intercity, Livit, Régie du Rhône, etc.) — **deliberately excluding major portals** (Homegate, ImmoScout24, Comparis).

**Why this choice of source is a product decision, not a technical shortcut**: real estate agencies often post their listings on their own websites before they appear on aggregator portals. Targeting real estate agency websites (a) avoids the strict terms of service and robust anti-bot measures of major portals—significantly lower legal/technical risk for a part-time solo project—and (b) provides a defensible product angle to present to the jury: *“We’re looking at a source that home seekers never check individually, so we’re faster.”* Never expand the crawl to a major aggregator portal without re-evaluating this decision.

The product then matches these listings against a search profile (budget, number of rooms, market) and sends a personalized application to the real estate agency on the user’s behalf, with a chat thread that updates in real time when the agency responds.

- **Who creates the data**: the Firecrawl crawler (currently triggered manually).
- **Who consumes it**: tenants (via their `profile`) who receive matches, and property management companies that receive an automated outreach.
- **Source of truth**: Convex only (`convex/schema.ts`) .
- **Public vs. authenticated**: The listing feed must remain public (see judgment constraint above); only `/profile` and the inbox require Clerk.
- **Strictly server-side**: The Firecrawl call (API key), the OpenAI call (API key), and anything related to `agencies.contactEmail`.

## Discrepancies between strategy and current code — to be fixed as a priority

The diagram accurately reflects the agreed-upon architecture. The rest is significantly behind schedule (Week 1 is almost over, Week 2 hasn’t started, even though we’re roughly halfway through the 3-week timeline). In order of impact on the score:

1. **🔴 The feed is not public.** `app/page.tsx` forces a login (`Unauthenticated` → only sign-in/sign-up buttons; nothing visible without an account). This is a direct violation of the most explicit evaluation rule we’ve identified. Must be fixed before any other UI features.
2. **🔴 OpenAI is not integrated.** No dependencies, no calls—`convex/openai.ts` (application text generation via `gpt-4o-mini`, direct `fetch` call, not the Convex AI Gateway reserved for paid plans) does not yet exist. Without this, one of the three required sponsors is at zero.
3. **🔴 AgentMail is not integrated.** The schema anticipates `inquiries.agentmailThreadId`, but nothing sends or receives emails. Second required sponsor is at zero.
4. **🟠 Matching does not exist.** `listings.status` never changes beyond `"new"`. This is the core of the value proposition (“we’ll find you a place that matches your profile”) and is currently missing from the demo.
5. **🟡 The Firecrawl crawler uses direct REST `fetch`, not the official `@firecrawl/firecrawl-convex` component** identified in the strategy as the preferred choice for Convex depth (sustainable crawls, reactive progression written directly to the database). This is still a valid use of Firecrawl (the sponsor isn’t at zero), but it likely scores lower on the “Convex depth/components” criterion than expected. **Decision pending**: stick with the current implementation (already tested, works) or migrate to the official component before the deadline—don’t decide this alone; the risk of a failed rewrite with two weeks to go is real.
6. **🟡 Deployment status to be reconfirmed.** A production deployment (`outstanding-malamute-184.convex.site`) was successful early in the project (just the Clerk shell). The `hackathon.md` file in the repo shows “not deployed” after the crawler was added—either it was never pushed after that commit, or the log is simply out of date. Check this first before building further on it: a broken redeployment discovered at the deadline is the worst-case scenario for this entire plan.

## Mandatory Workflow (Hackathon Edition)

See the `origin-studio-hackathon-workflow` skill. Summary:

1. Read this file + the relevant skills before touching the code.
2. Inspect the actual code, not just `hackathon.md` (we’ve already been caught out once—see discrepancy #6).
3. If the scope involves an issue that’s still open (see section below), ask for clarification before proceeding.
4. For any non-trivial feature, create a short prompt in `/prompts/[feature].md` and have it approved before execution.
5. Human validation is non-negotiable before: the first actual email sent to a real advertising network, the first real large-scale crawl (Firecrawl cost), and any schema change affecting existing data.
6. After implementation: `npm run typecheck`, `npm run lint`, `npm run build`.
7. One branch per feature, PR before merge—provides a defensible history to present to the review panel and a fallback point if a feature breaks the build at the last minute.

## Skills to load

| Skill | Type | Load when... |
|---|---|---|
| `convex`, `convex-quickstart`, `convex-crons`, `convex-env`, `convex-auth`, `convex-setup-auth`, `convex-authz`, `convex-seed`, `convex-test`, `convex-optimize`, `convex-reviewer`, `convex-deploy-guard`, … (complete list: `skills-lock.json`) | Official `get-convex/agent-skills` (already installed) | Any Convex syntax/API |
| `firecrawl-crawler-firstkey` | Project | Modify crawling, add a control panel, address point 5 above |
| `clerk-static-export-firstkey` | Project | Auth, new page/route, make the feed public (point 1) |
| `matching-outreach-firstkey` | Project | Build matching (OpenAI) + outreach (AgentMail) — workflow now decided, just not coded yet |
| `origin-studio-hackathon-workflow` | Personal, reusable | Still in the background |

## Structure du projet

- `convex/schema.ts` — source de vérité du modèle de données, fidèle à l'architecture décidée.
- `convex/firecrawl.ts` — `action` en `fetch` REST direct (voir écart n°5).
- `convex/listings.ts`, `convex/agencies.ts` — uniquement `internalMutation`/`internalQuery`. **Toute nouvelle fonction publique sur `agencies` doit omettre `contactEmail`.**
- `convex/lib/hash.ts` — module utilitaire pur, pas d'endpoint.
- `convex/seed.ts` — dev-only.
- `components/AuthGate.tsx` / `components/ConvexClientProvider.tsx` — Clerk confiné en Client Component (export statique).
- `app/page.tsx` — **à corriger en priorité** : actuellement 100% gated, doit devenir feed public + zone authentifiée pour le profil/inbox.
- Manquants par rapport au plan : `convex/crons.ts`, `convex/matching.ts`, `convex/openai.ts`, `convex/agentmail.ts`, `convex/profiles.ts`, `app/profile/`, `app/inbox/`, `convex/http.ts` (réservé via `httpPrefix: "/api"` dans `convex.config.ts`, utile pour un futur webhook AgentMail).

## Tech Stack

- Next.js 16 with **static export** (`output: "export"`, `distDir: "dist"`) — served by `@convex-dev/static-hosting`, no Next server.
- Convex 1.44.
- Clerk via `@clerk/clerk-react` (not `@clerk/nextjs`).
- Firecrawl — direct REST `fetch` (see discrepancy #5).
- **OpenAI — direct `fetch` call to the API (`gpt-4o-mini`), not the Convex AI Gateway** (reserved for paid plans). Decided but not implemented.
- **AgentMail — official Convex component** planned (threads/labels/messages synchronized reactively). Decided but not implemented.
- pnpm. Deployment: `npm run deploy` → `npx @convex-dev/static-hosting deploy`.

## Data Model (current state as of commit `a157e9d`)

- `markets`, `agencies` (`contactEmail` is sensitive, never public), `listings` (`status: new|matched|contacted|replied`, only `"new"` is reached today, deduplication via canonical URL hash — see Firecrawl skill), `profiles` (schema ready, nothing reads/writes it), `inquiries` (schema ready, `agentmailThreadId` anticipates AgentMail, nothing implemented).

## Open Issues — truly unresolved (to be distinguished from “just not coded yet”)

1. **Point 5 above**: Keep direct `fetch` for Firecrawl or migrate to `@firecrawl/firecrawl-convex`?
2. **Exact matching formula**: the architecture states “compare to active listings in the same market”—the most likely interpretation is `priceChf <= budgetMax` and `rooms >= roomsMin`, but this has never been explicitly confirmed, and there’s no indication whether `moveInDate` should also be a filter. To be confirmed before coding `convex/matching.ts`.
3. **Human review before sending**: Does a match automatically trigger the sending of an AgentMail, or is manual validation still required, at least during the hackathon? Strong recommendation: manual validation until we’ve tested the email template on at least one real agency.
4. **Demo volume**: only one market/agency seeded so far; the plan was to reach ~30 real estate agencies by week 3—what volume should we aim for given the time remaining?

## What the agent must never do

- Make `contactEmail` accessible via a public query.
- Build a feature that re-caches the feed behind authentication—this is the opposite of the priority fix.
- Crawl a large aggregator portal (Homegate, ImmoScout24, Comparis) without explicitly revalidating this choice—this is a deliberate product decision, not an oversight.
- Send a real email via AgentMail without explicit confirmation, even in a test.
- Reintroduce `@clerk/nextjs`, Server Actions, or Next middleware.
- Use Codex or a code agent as a substitute for a real OpenAI runtime call—this does not count toward the sponsor evaluation criteria.
