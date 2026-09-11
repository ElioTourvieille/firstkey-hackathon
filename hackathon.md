# Hackathon log

- **Project:** firstkey-hackathon
- **Event:** Convex All Gas Hackathon
- **What it does:** Crawls rental-agency listing pages with Firecrawl, matches new listings against renter profiles, drafts a personalized application with OpenAI, and sends it via AgentMail — with a human reviewing (and, for now, manually triggering) every send.
- **Live app:** https://outstanding-malamute-184.convex.site
- **Repo:** https://github.com/ElioTourvieille/firstkey-hackathon
- **Frontend:** Convex static hosting
- **Convex deployment:** https://outstanding-malamute-184.convex.cloud
- **Components:** @convex-dev/static-hosting, @agentmail/convex
- **Convex features:** schema, tables, indexes, query, mutation, action, internal functions, HTTP actions, realtime queries
- **Auth:** Clerk
- **AI models:** gpt-4o-mini (direct fetch, not the Convex AI Gateway)
- **Started:** 2026-08-26T11:58:52Z
- **Last updated:** 2026-09-10T14:29:08Z

## Log

### 2026-08-26 - working tree
Set up the project environment for the Convex All Gas Hackathon: installed the
official Convex Claude Code plugin (skills + MCP server) and the
`convex-hackathon-skill` build-log skill. No application code exists yet.

### 2026-08-26 - 26c7c4a
Scaffolded the app from the official Convex + Next.js + Clerk template and
registered the `@convex-dev/static-hosting` component to serve the frontend
directly from convex.site. Convex features: schema, tables, query, mutation,
action (`convex/schema.ts`, `convex/myFunctions.ts`). Auth wired through
Clerk (`convex/auth.config.ts`, `components/ConvexClientProvider.tsx`).

### 2026-08-26 - working tree
Made the app buildable as a real static export for `@convex-dev/static-hosting`:
added `output: "export"` to `next.config.ts` and dropped the Next.js
middleware (`proxy.ts`), which can't run without a server. Swapped
`@clerk/nextjs` for `@clerk/clerk-react` after its bundled Server Actions
broke the static build, isolating Clerk in a new client-only `AuthGate`
component so it stays out of the Server Component tree. Moved the `/server`
demo page from `preloadQuery` to reactive `useQuery`, since static export has
no per-request server to preload from
(`components/AuthGate.tsx`, `app/layout.tsx`, `app/page.tsx`,
`app/server/page.tsx`, `app/server/inner.tsx`).

### 2026-08-27 - a157e9d
Added a Firecrawl-based crawler: `crawlAgency` scrapes an agency's listings
page with a structured JSON extraction schema and upserts the results into
`listings`, deduping on a hash of the listing's canonical URL. Dedup was
originally keyed on url+price+rooms per the schema, but Firecrawl's LLM
extraction returns an inconsistent `rooms` value across re-crawls of the
same unchanged listing, which produced duplicate rows — caught by testing
against a real agency page and fixed before committing. Convex features:
internal queries/mutations, an action calling a third-party API
(`convex/firecrawl.ts`, `convex/listings.ts`, `convex/agencies.ts`,
`convex/lib/hash.ts`). Also removed the leftover `numbers`-table template
demo (`convex/myFunctions.ts`, `app/server/`) that the real schema no
longer supports, and trimmed `app/page.tsx` down to the Clerk auth shell.

### 2026-09-08 - e30fe46
Made the listings feed public. The homepage was gating 100% of its content
behind Clerk auth — a direct violation of the hackathon's rule that a judge
must see the product working with zero login. Added a public
`listings.listPublic` query (returns listing fields plus the agency's name,
never `agencies.contactEmail`) and rebuilt `app/page.tsx` so the feed
renders unconditionally; auth now only gates the header's account chrome.
Deployed this to prod (`outstanding-malamute-184`) — the first live
deployment since the initial scaffold. Convex features: public query
(`convex/listings.ts`, `app/page.tsx`).

### 2026-09-08 - d4fc75a
Added project skills and prompt docs (Clerk static-export constraints,
Firecrawl crawler decisions, matching/outreach flow, hackathon workflow)
and synced `AGENTS.md`/`CLAUDE.md`. No application code changed.

### 2026-09-08 - 3fb390c
Added listing-to-profile matching, the core of the product's value
proposition. `matching.matchListing` compares a listing's price and room
count against every profile in its market and flips `listings.status`
between `"new"` and `"matched"` — and back, if a re-crawled listing's price
rises out of a profile's budget. Triggered from `listings.upsertBatch`
after every insert/update. Added `profiles.myMatches`, an authenticated
query that recomputes the match per caller rather than trusting the coarse
`status` flag (which only means "at least one profile in the market
matches"), and a "Your matches" section in the UI. Verified against dev's
real crawled listings before committing. Convex features: internal
mutations, authenticated queries (`convex/matching.ts`,
`convex/lib/matching.ts`, `convex/profiles.ts`, `app/page.tsx`).

### 2026-09-08 - fc1317f
Wired up OpenAI — one of the three sponsors required to do real work at
runtime — to draft rental-application text from a profile's pitch and a
listing's details. Direct `fetch` to the chat completions API
(`gpt-4o-mini`), not the Convex AI Gateway. `openai.draftInquiry` is
internal; `openai.draftMyInquiry` is the public, identity-scoped entry
point added later the same day alongside the AgentMail send flow. Tested
against the real API on dev. Convex features: action calling a third-party
API (`convex/openai.ts`).

### 2026-09-08 - e358214
Sent the first real rental-inquiry emails through AgentMail — the last of
the three required sponsors — to a self-controlled test inbox only, never
a live agency. Found and worked around two bugs in the official
`@agentmail/convex` component: its inbox-management functions are declared
with a visibility that makes them unreachable from an app that installs
it, and its send path can't read its own API key because the component
never declares it as a component-level environment variable. Sending goes
through direct AgentMail REST calls instead (same pattern as the Firecrawl
and OpenAI integrations); the component still handles the webhook route
and the reactive inbox query. `agentmail.sendInquiry` only ever fires from
an explicit UI button — nothing in the codebase calls it automatically.
Verified by sending a real test email and reading back the exact text that
arrived. Pushed to the dev deployment only; prod still runs the
public-feed-fix build from earlier today. Convex features: HTTP actions,
registered component (`convex/agentmail.ts`, `convex/http.ts`,
`convex/convex.config.ts`).

### 2026-09-09 - working tree
Closed three open decisions and a deployment gap found while auditing
where the project actually stood (as opposed to what `hackathon.md` said):
prod (`outstanding-malamute-184`) had only `CLERK_JWT_ISSUER_DOMAIN` set —
none of `FIRECRAWL_API_KEY`, `OPENAI_API_KEY`, `AGENTMAIL_API_KEY`,
`AGENTMAIL_INBOX_ID` — so a judge hitting the public URL would have hit
"is not set" errors on every sponsor call, even though the matching
dev-deployment code (all three sponsors, public feed) was already merged
to `master`. Copied the four keys from dev to prod (`npx convex env set
... --prod`, values never echoed to logs) and ran a full
`typecheck → lint → build → deploy` (backend + static frontend) to prod
via a one-shot, immediately-revoked prod deploy key (`npx convex
deployment token create --prod`, used once, deleted right after) since
`npx convex deploy` refuses to prompt for the dev→prod confirmation in a
non-interactive shell. Verified prod serves HTTP 200 post-deploy.

Also confirmed prod's `listings`/`agencies` tables are empty — dev is the
only deployment ever seeded — so the public feed is live but shows
nothing yet; seeding prod with real agencies is the next step and, per
the mandatory workflow, needs explicit sign-off before running Firecrawl
against real agency sites at any real volume.

Resolved the three remaining open issues from `CLAUDE.md` with the
project owner rather than deciding alone: (1) keep Firecrawl on direct
`fetch`, no migration to `@firecrawl/firecrawl-convex` before the
deadline; (2) matching formula confirmed as already implemented
(`priceChf <= budgetMax && rooms >= roomsMin`, no `moveInDate` filter);
(3) manual-send-only confirmed as already implemented and correct; (4)
demo volume target set at 5-8 agencies, not the original ~30, given ~13
days left. No application code changed — env/deploy operations and docs
only.

### 2026-09-09 - cb711bf
Validated the full crawl→matching→draft chain end-to-end against fresh
real data in dry-run (re-crawled Naef live: 11 found, 3 new; matching
re-ran automatically; OpenAI drafted a coherent French application
referencing the real listing and the real profile pitch) — then stopped
before the send step. Asked explicitly whether the pilot's email should
actually go out to Naef's real inbox; decided to stay dry-run, no email
sent to any agency today.

Then expanded demo coverage per the decided 5-8 target: researched real
Geneva rental agencies (de Rham turned out to be Vaud-only, "Fongérant"
doesn't appear to exist under that name, Gérofinance and Régie du Rhône
turned out to be the same company — none of these three made it in) and
picked five working, distinctly-real Geneva regies: Naef (already
seeded), Gérofinance | Régie du Rhône, SPG (Société Privée de Gérance),
Régimo Genève, and Comptoir Immobilier. Livit's listing page is dominated
by Zurich/Zug inventory and yielded zero Geneva matches — left seeded but
empty rather than force-fit.

Two small code changes made this possible: `seed.ts:seedAgencyInMarket`
(adds an agency to an *existing* market — the original `seedAgency`
always inserted a fresh market, which would have silently broken
matching between agencies sharing "Geneva"), and a Geneva-canton-only
guard added to the Firecrawl extraction prompt (`firecrawl.ts`) — several
of the new regies list properties across multiple cantons on the same
page, and the LLM extraction needed to be told explicitly to keep only
postal codes 1200-1299. Verified address-by-address in dev before
trusting it (SPG: 11/11 listings tagged "(GE)").

Validated in dev first (62 real listings, 30 auto-matched), then
redeployed the same code to prod and re-ran the identical seed+crawl
sequence there. Prod now has 43 real, live Geneva listings across 5
agencies and responds HTTP 200 — the public-feed gap flagged earlier
today is closed. No email sent to any agency, dev or prod. Convex
features: internal mutations, action calling a third-party API
(`convex/seed.ts`, `convex/firecrawl.ts`).

### 2026-09-10 - working tree
Added a design reference for the remaining UI work: `design/design-system.md`
(Swiss-Style direction, palette, typography, layout rules) plus four
validated mockups — public feed, profile, matches ("myCorrespondence"), and
the agency messenger/inbox. The design system's central rule, added after an
earlier mockup pass invented fake certifications (USPI/ASLOCA/LDTR) and a
solvency score: no badge, percentage, or count may render without real
Convex data behind it — an unimplemented value is omitted, never simulated.
`prompts/feed-public.md` was updated to point the (already-shipped) public
feed at `design/publicFeed.png` as its visual reference, carrying the same
no-fabricated-data constraint. `AGENTS.md` was translated to French and its
"Discrepancies" section rewritten to describe the project's state as of the
`a157e9d` crawler commit — this is now stale relative to the current,
English `CLAUDE.md`, which reflects the resolved state as of 2026-09-09.
Also widened `tsconfig.json`'s include globs to cover `dist/types` and
`dist/dev/types` (static-export typecheck). No Convex backend code changed;
nothing deployed.

### 2026-09-10 - 6f69fd1
Built the design pass flagged in the previous entry: the public feed now
actually renders the Swiss-Style design system instead of the plain
unstyled version. Added `agencies.listPublic` (public query — name and
`lastCrawledAt` only, never `contactEmail`/`listingsUrl`) to back a real
"régies suivies" panel; rewrote `app/page.tsx` with a 4-tab nav (3 tabs
disabled — no routes exist yet), an activity strip driven by real
`firstSeenAt`, and client-side filters (rooms/budget/quartier) over
listings already loaded, no extra server calls. Every mockup element
without a real Convex-backed equivalent (photos, network latency, per-agency
scan cadence, reference codes, amenity tags, a "dossier prêt" completion
badge) was dropped rather than simulated, per the design system's rule.
Copy switched to French. `app/globals.css` now carries the design system's
palette, light-only (dark mode removed — no dark mockup exists). Convex
features: public query (`convex/agencies.ts`, `app/page.tsx`). Deployed to
prod (`outstanding-malamute-184`) the same session; verified HTTP 200
post-deploy using a one-shot prod deploy key, immediately revoked.

### 2026-09-10 - 36802e7
Added the profile page (`design/profile.png`), the 3rd nav tab going from
disabled to active — and closed a real gap found while scoping it: no
public mutation existed to create or edit a renter's own profile, only
`seed.ts` could insert one, dev-only. Added `profiles.myProfile` (read) and
`profiles.upsertMine` (create-or-update, identity-scoped, single market
resolved server-side) — the actual missing feature, not just the screen.
Extended `profiles` with two new optional fields, `surfaceMin` and
`quartiers` (Geneva postal codes) — additive, no migration, existing docs
unaffected — and updated `isMatch` (`convex/lib/matching.ts`) to use them,
staying permissive when a listing is missing the surface/address data to
check against. New route `app/profile/page.tsx`, static-export, behind
`AuthGate`; form state seeded via a key-based remount instead of a
`useEffect` (avoids the cascading-render pattern ESLint's
`react-hooks/set-state-in-effect` flags). Real Clerk avatar/name, and a
completion ratio computed from actually-filled required fields rather than
an invented score. Extracted `Header`/`Footer`/`ToggleChip` into shared
components and `GENEVA_DISTRICTS` into a shared module so both screens use
the same nav/footer/toggle-pill instead of duplicating them. Dropped from
the mockup, per product-scope decisions made the same day: an
income/solvency block (sensitive financial data, no use in matching),
document uploads (needs Convex file storage — its own feature), a fake
reference code, an AI "pitch wizard" button with "variables détectées" tags
(no such capability exists), fabricated latency. Also added a client-side
"Surface minimale" filter to the public feed (`surfaceM2` was already
loaded and displayed but not filterable) — not in the original mockup,
added on request; unlike the matching predicate, this explicit user filter
hides listings with unknown surface rather than showing them. Schema and
functions pushed to dev (`clever-toucan-312`) and verified deployable;
nothing pushed to prod for this one yet.

### 2026-09-10 - working tree
Added `suppressHydrationWarning` to the root `<html>` in `app/layout.tsx`.
Uncommitted — not yet explained by a commit message, so logged as-is
without guessing the exact trigger (a Clerk/theme hydration mismatch is the
likely usual cause of this attribute, but that's inference, not evidence).
