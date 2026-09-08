import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { matchListing } from "./matching";

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

// Dev-only helper for testing convex/matching.ts and profiles:myMatches.
// `userId` must be the real Clerk subject of the account you'll sign in
// with (ctx.auth.getUserIdentity().subject) — otherwise myMatches has
// nothing to key off. Run with:
//   npx convex run seed:seedProfile '{"userId":"user_...","marketId":"...","budgetMax":4800,"roomsMin":3,"pitch":"..."}'
export const seedProfile = internalMutation({
  args: {
    userId: v.string(),
    marketId: v.id("markets"),
    budgetMax: v.number(),
    roomsMin: v.number(),
    moveInDate: v.optional(v.string()),
    pitch: v.string(),
  },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("profiles", args);
  },
});

// Dev-only helper for testing convex/agentmail.ts without ever emailing a
// real agency: creates one listing under an existing agency, so you can
// point that agency's `contactEmail` at an address you control and run
// agentmail:sendInquiry end-to-end against it. Run with:
//   npx convex run seed:seedListing '{"agencyId":"...","marketId":"...","title":"...","url":"https://example.com/test-listing","priceChf":4500,"rooms":3}'
export const seedListing = internalMutation({
  args: {
    agencyId: v.id("agencies"),
    marketId: v.id("markets"),
    title: v.string(),
    url: v.string(),
    priceChf: v.number(),
    rooms: v.number(),
    surfaceM2: v.optional(v.number()),
    address: v.optional(v.string()),
  },
  returns: v.id("listings"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("listings", {
      agencyId: args.agencyId,
      marketId: args.marketId,
      title: args.title,
      url: args.url,
      priceChf: args.priceChf,
      rooms: args.rooms,
      surfaceM2: args.surfaceM2,
      address: args.address,
      sourceHash: `seed-${args.url}`,
      status: "new",
      firstSeenAt: Date.now(),
    });
  },
});

// Dev-only: re-run matching against every listing in a market. Matching
// only triggers from listings:upsertBatch, so a listing crawled before a
// profile existed needs this to pick up the new profile — run it right
// after seedProfile if you're testing against already-crawled listings.
export const rematchMarket = internalMutation({
  args: { marketId: v.id("markets") },
  returns: v.object({ checked: v.number() }),
  handler: async (ctx, args) => {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_market_status", (q) => q.eq("marketId", args.marketId))
      .take(500);
    for (const listing of listings) {
      await matchListing(ctx, listing._id);
    }
    return { checked: listings.length };
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
      await ctx.db.delete("listings", listing._id);
      deleted++;
    }
    return { deleted };
  },
});
