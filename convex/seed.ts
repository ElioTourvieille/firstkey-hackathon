import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Admin-only helper for local testing, not part of the app's public API:
// creates one market + one agency so convex/firecrawl.ts has something to
// crawl. Run with:
//   npx convex run seed:seedAgency '{"marketName":"Geneva","country":"CH","currency":"CHF","agencyName":"...","listingsUrl":"...","contactEmail":"..."}'
export const seedAgency = internalMutation({
  args: {
    marketName: v.string(),
    country: v.string(),
    currency: v.string(),
    agencyName: v.string(),
    listingsUrl: v.string(),
    contactEmail: v.string(),
  },
  returns: v.object({ marketId: v.id("markets"), agencyId: v.id("agencies") }),
  handler: async (ctx, args) => {
    const marketId = await ctx.db.insert("markets", {
      name: args.marketName,
      country: args.country,
      currency: args.currency,
    });

    const agencyId = await ctx.db.insert("agencies", {
      marketId,
      name: args.agencyName,
      listingsUrl: args.listingsUrl,
      contactEmail: args.contactEmail,
    });

    return { marketId, agencyId };
  },
});

// Dev-only cleanup: wipe every listing for one agency (e.g. after a bad
// crawl) so the next `crawlAgency` run starts from a clean slate.
export const clearListings = internalMutation({
  args: { agencyId: v.id("agencies") },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    let deleted = 0;
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_agency", (q) => q.eq("agencyId", args.agencyId))
      .take(500);
    for (const listing of listings) {
      await ctx.db.delete(listing._id);
      deleted++;
    }
    return { deleted };
  },
});
