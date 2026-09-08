import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Public: powers the homepage feed, which must render without a login (see
// AGENTS.md — the feed is the one thing a judge must see with zero auth).
// Only ever returns listing fields plus the agency's display name — never
// `agencies.contactEmail`, which stays server-side.
export const listPublic = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("listings"),
      title: v.string(),
      url: v.string(),
      priceChf: v.number(),
      rooms: v.number(),
      surfaceM2: v.optional(v.number()),
      address: v.optional(v.string()),
      status: v.union(
        v.literal("new"),
        v.literal("matched"),
        v.literal("contacted"),
        v.literal("replied"),
      ),
      firstSeenAt: v.number(),
      agencyName: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").order("desc").take(100);

    return await Promise.all(
      listings.map(async (listing) => {
        const agency = await ctx.db.get("agencies", listing.agencyId);
        return {
          _id: listing._id,
          title: listing.title,
          url: listing.url,
          priceChf: listing.priceChf,
          rooms: listing.rooms,
          surfaceM2: listing.surfaceM2,
          address: listing.address,
          status: listing.status,
          firstSeenAt: listing.firstSeenAt,
          agencyName: agency?.name ?? "Unknown agency",
        };
      }),
    );
  },
});

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
        await ctx.db.patch("listings", existing._id, {
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

    await ctx.db.patch("agencies", args.agencyId, { lastCrawledAt: Date.now() });

    return { inserted, updated };
  },
});
