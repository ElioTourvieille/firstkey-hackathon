import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import schema from "./schema";

// Internal-only: fetched by the firecrawl action to know what to crawl.
// Not exposed publicly since it returns the agency's contact email.
export const get = internalQuery({
  args: { agencyId: v.id("agencies") },
  returns: v.union(schema.doc("agencies"), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("agencies", args.agencyId);
  },
});

// Public: powers the "régies suivies" panel on the homepage (name + last
// crawl time only, so the feed can show real sync freshness instead of a
// fabricated uptime/ping metric). Never returns `contactEmail` or
// `listingsUrl` — the latter is the exact page we scrape, no reason to hand
// a third party the crawl target.
export const listPublic = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("agencies"),
      name: v.string(),
      lastCrawledAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const agencies = await ctx.db.query("agencies").collect();
    return agencies.map((agency) => ({
      _id: agency._id,
      name: agency.name,
      lastCrawledAt: agency.lastCrawledAt,
    }));
  },
});
