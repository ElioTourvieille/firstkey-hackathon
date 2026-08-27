import { v } from "convex/values";
import { action, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { sourceHash } from "./lib/hash";

// JSON Schema passed to Firecrawl's `formats: [{ type: "json", schema }]`
// extraction — see https://docs.firecrawl.dev (POST /v2/scrape).
const LISTINGS_SCHEMA = {
  type: "object",
  properties: {
    listings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          priceChf: { type: "number" },
          rooms: { type: "number" },
          surfaceM2: { type: "number" },
          address: { type: "string" },
        },
        required: ["title", "url", "priceChf", "rooms"],
      },
    },
  },
  required: ["listings"],
};

type ExtractedListing = {
  title?: string;
  url?: string;
  priceChf?: number;
  rooms?: number;
  surfaceM2?: number;
  address?: string;
};

// Manually-triggered for now (run with `npx convex run firecrawl:crawlAgency
// '{"agencyId":"..."}'`) — a cron can call this later once it's proven out.
export const crawlAgency = action({
  args: { agencyId: v.id("agencies") },
  returns: v.object({ found: v.number(), inserted: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const apiKey = env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "FIRECRAWL_API_KEY is not set. Run `npx convex env set FIRECRAWL_API_KEY <key>`.",
      );
    }

    const agency = await ctx.runQuery(internal.agencies.get, {
      agencyId: args.agencyId,
    });
    if (!agency) {
      throw new Error(`Agency ${args.agencyId} not found`);
    }

    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: agency.listingsUrl,
        formats: [
          {
            type: "json",
            prompt:
              "Extract every rental listing shown on this page. priceChf is the monthly rent in Swiss francs as a plain number (no currency symbol or thousands separator). rooms is the number of rooms (e.g. 3.5). url is the absolute link to the listing's own detail page.",
            schema: LISTINGS_SCHEMA,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Firecrawl request failed (${res.status}): ${await res.text()}`);
    }

    const payload = await res.json();
    if (!payload.success) {
      throw new Error(`Firecrawl returned an error: ${JSON.stringify(payload)}`);
    }

    const extracted = payload.data?.json ?? payload.data ?? {};
    const rawListings: ExtractedListing[] = Array.isArray(extracted.listings)
      ? extracted.listings
      : [];

    const normalized = rawListings
      .map((listing) => {
        if (!listing.url || !listing.title) return null;
        if (typeof listing.priceChf !== "number" || typeof listing.rooms !== "number") {
          return null;
        }
        // Strip the query string (tracking params like `?origin=...&zoom=8`)
        // so the same listing hashes the same way across crawls — see
        // convex/lib/hash.ts for why price/rooms can't be part of the key.
        const canonicalUrl = new URL(listing.url, agency.listingsUrl);
        canonicalUrl.search = "";
        canonicalUrl.hash = "";
        const url = canonicalUrl.toString();
        return {
          url,
          title: listing.title,
          priceChf: listing.priceChf,
          rooms: listing.rooms,
          surfaceM2: listing.surfaceM2,
          address: listing.address,
          sourceHash: sourceHash(url),
        };
      })
      .filter((listing): listing is NonNullable<typeof listing> => listing !== null);

    const result: { inserted: number; updated: number } = await ctx.runMutation(
      internal.listings.upsertBatch,
      {
        agencyId: agency._id,
        marketId: agency.marketId,
        listings: normalized,
      },
    );

    return { found: rawListings.length, ...result };
  },
});
