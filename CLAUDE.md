# Agents.md — firstkey (Convex All Gas Hackathon)

> This file is written **for the agent**, not for public documentation. It **supplements**—and never replaces—the auto-generated block `<!-- convex-ai-start -->...<!-- convex-ai-end -->` already present at the top of `AGENTS.md`/`CLAUDE.md` in this repo, managed by `npx convex ai-files install`. Do not delete or duplicate it here: paste the content below **after** this block.
>
> Last sync: actual code + prod deployment state as of 2026-09-09 (commits through `e358214`, plus a same-day prod env/deploy sync — see `hackathon.md`) + strategy conversation "Analysis and Strategy for a Winning Project". If the two diverge, this file explicitly flags the discrepancy rather than silently overriding it.

## Hackathon Context — Rules and Judging Criteria

- **Event**: Convex All Gas Hackathon. Timeframe: August 25 → September 22, 12:00 PM PT. Solo, part-time.
- **Required for submission**: new app started after 08/25 ✅, Convex backend ✅, public GitHub repo ✅, deployed on `convex.site` (no localhost), demo video < 3 min, X/LinkedIn post tagging **@convex @OpenAI @firecrawl @agentmail**, submission on vibeapps.dev.
- **Judging criteria, in order of importance**:
  1. **Real-world use** — “a real person would use this this week.” A consumer or SMB product in a real industry, not a developer tool. *“Copycats and developer-only tools score low.”*
  2. **Actual Convex depth** (queries/mutations/live updates/auth/components) — *"A thin frontend on a hosted page does not count."*
  3. **Sponsors must actually do real work within the product** — Firecrawl, OpenAI, and AgentMail must each perform real work **at runtime**, not just be mentioned or used for coding (Codex does not count for OpenAI).
  4. Functional public URL, short video demo, social traction.
- **Non-negotiable judging requirement**: *the listing feed must be publicly visible without requiring a login.* ✅ Fixed `e30fe46` — Clerk now only protects the personal profile and inbox, never the main feed. **However**: as of 2026-09-09 prod's `listings`/`agencies` tables are empty (only dev has ever been seeded), so a judge visiting the public URL right now sees a working but empty feed. Seeding prod with real agencies is the next priority — see Open Issues.

## Product

**Rental Copilot** (working title): a co-pilot for finding housing in Geneva. It detects new listings posted directly on real estate agencies’ websites (Naef, de Rham, Fongérant, Gérofinance, SPG-Intercity, Livit, Régie du Rhône, etc.) — **deliberately excluding major portals** (Homegate, ImmoScout24, Comparis).

**Why this choice of source is a product decision, not a technical shortcut**: real estate agencies often post their listings on their own websites before they appear on aggregator portals. Targeting real estate agency websites (a) avoids the strict terms of service and robust anti-bot measures of major portals—significantly lower legal/technical risk for a part-time solo project—and (b) provides a defensible product angle to present to the jury: *“We’re looking at a source that home seekers never check individually, so we’re faster.”* Never expand the crawl to a major aggregator portal without re-evaluating this decision.

The product then matches these listings against a search profile (budget, number of rooms, market) and sends a personalized application to the real estate agency on the user’s behalf, with a chat thread that updates in real time when the agency responds.

- **Who creates the data**: the Firecrawl crawler (currently triggered manually).
- **Who consumes it**: tenants (via their `profile`) who receive matches, and property management companies that receive an automated outreach.
- **Source of truth**: Convex only (`convex/schema.ts`) .
- **Public vs. authenticated**: The listing feed must remain public (see judgment constraint above); only `/profile` and the inbox require Clerk.
- **Strictly server-side**: The Firecrawl call (API key), the OpenAI call (API key), and anything related to `agencies.contactEmail`.

## Discrepancies between strategy and current code — history (all resolved as of 2026-09-09)

Kept for context; every item below is now closed. See `hackathon.md` for the commit/date of each fix.

1. **✅ The feed is not public.** Fixed `e30fe46`.
2. **✅ OpenAI is not integrated.** Fixed `fc1317f` — `convex/openai.ts`, direct `fetch`, `gpt-4o-mini`.
3. **✅ AgentMail is not integrated.** Fixed `e358214` — manual-send-only, `convex/agentmail.ts`.
4. **✅ Matching does not exist.** Fixed `3fb390c` — `convex/matching.ts`.
5. **✅ Firecrawl direct `fetch` vs. official component — decided.** Keep the direct REST `fetch`. Confirmed with the project owner 2026-09-09: not worth the rewrite risk this late, and the sponsor already counts (real runtime call) with this approach.
6. **✅ Deployment status — reconfirmed and fixed.** Prod (`outstanding-malamute-184`) was missing all four sponsor env vars (`FIRECRAWL_API_KEY`, `OPENAI_API_KEY`, `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`) even though the code was merged — fixed 2026-09-09 (env vars copied from dev, full `typecheck → lint → build → deploy` pushed to prod). **New follow-up, not yet fixed**: prod's database is empty (dev is the only deployment ever seeded) — see Open Issues.

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
| `firecrawl-crawler-firstkey` | Project | Modify crawling, add a control panel, add a new agency |
| `clerk-static-export-firstkey` | Project | Auth, new page/route, any component touching Clerk |
| `matching-outreach-firstkey` | Project | Touch matching (OpenAI) or outreach (AgentMail) — both implemented, this documents the decisions behind them |
| `origin-studio-hackathon-workflow` | Personal, reusable | Still in the background |

## Structure du projet

- `convex/schema.ts` — source de vérité du modèle de données, fidèle à l'architecture décidée.
- `convex/firecrawl.ts` — `action` en `fetch` REST direct (décision confirmée, voir écart n°5 ci-dessus — ne pas migrer vers `@firecrawl/firecrawl-convex` sans re-décision explicite).
- `convex/listings.ts`, `convex/agencies.ts` — uniquement `internalMutation`/`internalQuery`, sauf `listings.listPublic` (publique, feed public). **Toute nouvelle fonction publique sur `agencies` doit omettre `contactEmail`.**
- `convex/lib/hash.ts` — dédup par hash d'URL canonique.
- `convex/lib/matching.ts` — prédicat `isMatch` (prix + pièces, pas de `moveInDate`), partagé entre `convex/matching.ts` (écrit `listings.status`) et `convex/profiles.ts` (lit les matches du profil courant).
- `convex/matching.ts` — matching listing→profils, déclenché depuis `listings.upsertBatch`.
- `convex/openai.ts` — `draftInquiry` (internal) / `draftMyInquiry` (public, scopé identité), `fetch` direct vers `gpt-4o-mini`.
- `convex/agentmail.ts` — `sendInquiry`, déclenché uniquement par un bouton UI explicite (jamais automatique). Envoi en `fetch` REST direct (contournement de deux bugs du composant officiel `@agentmail/convex` — voir commentaire en tête du fichier); le composant reste utilisé pour la route webhook et la query réactive d'inbox.
- `convex/profiles.ts` — `myMatches` (authentifiée, recalcule le match plutôt que de faire confiance au `status` grossier).
- `convex/seed.ts` — dev-only, jamais exécuté sur prod pour l'instant (voir Open Issues : prod n'a aucune donnée).
- `components/AuthGate.tsx` / `components/ConvexClientProvider.tsx` — Clerk confiné en Client Component (export statique).
- `app/page.tsx` — feed public inconditionnel + zone authentifiée (profil/matches/inbox) gérée par Clerk uniquement pour le chrome de compte.
- Toujours manquant par rapport au plan : `convex/crons.ts` (pas de re-crawl automatique, tout est déclenché manuellement), `app/profile/`, `app/inbox/` (dédiées — le flow actuel vit dans `app/page.tsx`).

## Tech Stack

- Next.js 16 with **static export** (`output: "export"`, `distDir: "dist"`) — served by `@convex-dev/static-hosting`, no Next server.
- Convex 1.44.
- Clerk via `@clerk/clerk-react` (not `@clerk/nextjs`).
- Firecrawl — direct REST `fetch`, confirmed final for this project (see discrepancy #5).
- **OpenAI — direct `fetch` call to the API (`gpt-4o-mini`), not the Convex AI Gateway** (reserved for paid plans). Implemented, `convex/openai.ts`.
- **AgentMail — direct REST `fetch` for sending** (workaround for two upstream bugs in `@agentmail/convex`, see `convex/agentmail.ts`), the official component still handles the webhook route and the reactive inbox query. Implemented.
- pnpm. Deployment: `npm run deploy` → `npx @convex-dev/static-hosting deploy` (backend + static frontend, one shot). Non-interactive/CI deploys to prod need a one-shot prod deploy key (`npx convex deployment token create <name> --prod`, export as `CONVEX_DEPLOY_KEY`, delete right after) since `npx convex deploy` refuses to prompt for the dev→prod confirmation without a TTY.

## Data Model (current state as of 2026-09-09)

- `markets`, `agencies` (`contactEmail` is sensitive, never public), `listings` (`status: new|matched|contacted|replied`; `new`/`matched` are live via `convex/matching.ts`, `contacted` is set on send, `replied` is schema-ready but nothing sets it yet — no inbound-reply handling exists), deduplication via canonical URL hash. `profiles` (read/written via `convex/profiles.ts`/`seed.ts`). `inquiries` (schema ready, `agentmailThreadId` populated by `convex/agentmail.ts:sendInquiry`).
- **Dev (`clever-toucan-312`) has seed data (1 market/agency, some test listings/profiles); prod (`outstanding-malamute-184`) has zero rows in any table** — the app has never been seeded on prod. This is the current top-priority gap: the public feed is live and working but empty.

## Open Issues — truly unresolved (to be distinguished from “just not coded yet”)

1. **Prod has no data.** Next real task: seed prod with the 5-8 target agencies (see decision below) and run Firecrawl against them for real. Per the mandatory workflow, this needs explicit human sign-off before it happens (first real large-scale crawl against real agency sites) — do not just run it.
2. **No automatic re-crawl.** `convex/crons.ts` still doesn't exist; every crawl is a manual `npx convex run firecrawl:...` call. Not blocking for the demo, but worth flagging if the demo needs listings to feel "live" without a manual step.
3. **Inbound replies unhandled.** `listings.status = "replied"` and the "chat thread that updates in real time" from the product description have no implementation — `agentmail`'s webhook route exists (`convex/http.ts`) but nothing has been verified end-to-end for an agency's reply flowing back into the UI.

### Resolved decisions (kept for the record, 2026-09-09)
- **Firecrawl**: keep direct `fetch`, no migration to `@firecrawl/firecrawl-convex`.
- **Matching formula**: `priceChf <= profile.budgetMax && rooms >= profile.roomsMin`, same market, no `moveInDate` filter (deliberately out of scope — no listing-availability field exists). Implemented in `convex/lib/matching.ts`.
- **Human review before sending**: manual only, confirmed correct as implemented — `agentmail.sendInquiry` only ever fires from an explicit UI button.
- **Demo volume**: target 5-8 real agencies (revised down from the original ~30, given ~13 days left as of 2026-09-09), not yet seeded on prod — see Open Issue #1 above.

## What the agent must never do

- Make `contactEmail` accessible via a public query.
- Build a feature that re-caches the feed behind authentication—this is the opposite of the priority fix.
- Crawl a large aggregator portal (Homegate, ImmoScout24, Comparis) without explicitly revalidating this choice—this is a deliberate product decision, not an oversight.
- Send a real email via AgentMail without explicit confirmation, even in a test.
- Reintroduce `@clerk/nextjs`, Server Actions, or Next middleware.
- Use Codex or a code agent as a substitute for a real OpenAI runtime call—this does not count toward the sponsor evaluation criteria.
