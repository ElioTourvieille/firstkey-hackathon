# Hackathon log

- **Project:** firstkey-hackathon
- **Event:** Convex All Gas Hackathon
- **What it does:** Crawls rental-agency listing pages with Firecrawl and stores structured Swiss rental listings in Convex, on a schema built to match them against renter profiles and reach out to agencies.
- **Live app:** not deployed
- **Repo:** https://github.com/ElioTourvieille/firstkey-hackathon
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, query, mutation, action, internal functions, realtime queries
- **Auth:** Clerk
- **AI models:** none
- **Started:** 2026-08-26T11:58:52Z
- **Last updated:** 2026-08-27T16:17:06Z

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
