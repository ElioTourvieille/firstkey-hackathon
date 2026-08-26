# Hackathon log

- **Project:** firstkey-hackathon
- **Event:** Convex All Gas Hackathon
- **What it does:** Not documented yet
- **Live app:** not deployed
- **Repo:** https://github.com/ElioTourvieille/firstkey-hackathon
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, query, mutation, action, realtime queries
- **Auth:** Clerk
- **AI models:** none
- **Started:** 2026-08-26T11:58:52Z
- **Last updated:** 2026-08-26T16:20:05Z

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
