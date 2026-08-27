import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Called by convex/firecrawl.ts after extracting listings from an agency's
// listingsUrl. Dedups on sourceHash (hash of url+price+rooms) so re-crawling
// the same page doesn't create duplicate listings.
export const upsertBatch = internalMutation({
  args: {
    agencyId: v.id("agencies"),
    marketId: v.id("markets"),
    listings: v.array(
      v.object({
        url: v.string(),
        title: v.string(),
        priceChf: v.number(),
        rooms: v.number(),
        surfaceM2: v.optional(v.number()),
        address: v.optional(v.string()),
        sourceHash: v.string(),
      }),
    ),
  },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;

    for (const listing of args.listings) {
      const [existing] = await ctx.db
        .query("listings")
        .withIndex("by_hash", (q) => q.eq("sourceHash", listing.sourceHash))
        .take(1);

      if (existing) {
        // Same listing (same canonical URL) seen again: refresh the fields
        // that can drift between crawls (price, rooms, ...) but keep
        // `status` and `firstSeenAt` — this is not a new listing.
        await ctx.db.patch(existing._id, {
          title: listing.title,
          priceChf: listing.priceChf,
          rooms: listing.rooms,
          surfaceM2: listing.surfaceM2,
          address: listing.address,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("listings", {
        agencyId: args.agencyId,
        marketId: args.marketId,
        url: listing.url,
        title: listing.title,
        priceChf: listing.priceChf,
        rooms: listing.rooms,
        surfaceM2: listing.surfaceM2,
        address: listing.address,
        sourceHash: listing.sourceHash,
        status: "new",
        firstSeenAt: Date.now(),
      });
      inserted++;
    }

    await ctx.db.patch(args.agencyId, { lastCrawledAt: Date.now() });

    return { inserted, updated };
  },
});
