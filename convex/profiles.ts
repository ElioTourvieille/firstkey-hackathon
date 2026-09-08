import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { isMatch } from "./lib/matching";
import schema from "./schema";

// Internal-only: fetched by convex/openai.ts to draft an inquiry. Returns
// the full doc (including `pitch`, free text the tenant wrote themselves —
// not third-party PII like agencies.contactEmail), so this must stay
// internal, never a public query.
export const get = internalQuery({
  args: { profileId: v.id("profiles") },
  returns: v.union(schema.doc("profiles"), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("profiles", args.profileId);
  },
});

// Same safe subset as listings:listPublic — never agencies.contactEmail.
const matchedListingValidator = v.object({
  _id: v.id("listings"),
  title: v.string(),
  url: v.string(),
  priceChf: v.number(),
  rooms: v.number(),
  surfaceM2: v.optional(v.number()),
  address: v.optional(v.string()),
  agencyName: v.string(),
});

// Authenticated: the signed-in tenant's own listings that match their own
// profile. Recomputes `isMatch` rather than trusting
// `listings.status === "matched"` — that field is a coarse "at least one
// profile in the market matches" flag (see convex/matching.ts), not scoped
// to this caller, so it can't be reused directly here.
export const myMatches = query({
  args: {},
  returns: v.array(matchedListingValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const [profile] = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(1);
    if (!profile) return [];

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_market_status", (q) => q.eq("marketId", profile.marketId))
      .collect();

    const matches = listings.filter(
      (listing) =>
        listing.status !== "contacted" &&
        listing.status !== "replied" &&
        isMatch(profile, listing),
    );

    return await Promise.all(
      matches.map(async (listing) => {
        const agency = await ctx.db.get("agencies", listing.agencyId);
        return {
          _id: listing._id,
          title: listing.title,
          url: listing.url,
          priceChf: listing.priceChf,
          rooms: listing.rooms,
          surfaceM2: listing.surfaceM2,
          address: listing.address,
          agencyName: agency?.name ?? "Unknown agency",
        };
      }),
    );
  },
});
