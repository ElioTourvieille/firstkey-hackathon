import { v } from "convex/values";
import { internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
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

// Internal-only, same PII reasoning as `get` above. Shared by every
// authenticated query/action that needs "the signed-in user's own
// profile" (myMatches, openai:draftMyInquiry, agentmail:sendInquiry) so
// there's exactly one place that resolves identity -> profile.
export const getByUserId = internalQuery({
  args: { userId: v.string() },
  returns: v.union(schema.doc("profiles"), v.null()),
  handler: async (ctx, args) => {
    const [profile] = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(1);
    return profile ?? null;
  },
});

// Same safe subset as listings:listPublic — never agencies.contactEmail.
export const matchedListingValidator = v.object({
  _id: v.id("listings"),
  title: v.string(),
  url: v.string(),
  priceChf: v.number(),
  rooms: v.number(),
  surfaceM2: v.optional(v.number()),
  address: v.optional(v.string()),
  firstSeenAt: v.number(),
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
          firstSeenAt: listing.firstSeenAt,
          agencyName: agency?.name ?? "Unknown agency",
        };
      }),
    );
  },
});

// Public, identity-scoped: the signed-in tenant's own profile, or null if
// they haven't created one yet. Safe to return the full doc — unlike
// agencies.contactEmail this is the caller's own data, nothing cross-user.
export const myProfile = query({
  args: {},
  returns: v.union(schema.doc("profiles"), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const [profile] = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(1);
    return profile ?? null;
  },
});

// Resolves "the" active market as whichever one actually backs agencies —
// not just `markets.take(1)`. Dev has accumulated a few near-duplicate rows
// all named "Geneva" from earlier ad-hoc testing (a manual seed, an
// AgentMail-verification seed, ...); grabbing an arbitrary first row can
// land on an empty one, silently orphaning a profile from every listing
// (confirmed the hard way: `js7cm7fj59wb5ws0q4eazn11jn8d8npg` has 0
// listings vs. the real market's 62). Counting agencies per market and
// taking the max is a self-correcting heuristic that doesn't depend on
// cleaning up that test debris, and still does the right thing once this
// product genuinely has more than one market.
async function resolveActiveMarketId(ctx: { db: QueryCtx["db"] }) {
  const counts = new Map<Id<"markets">, number>();
  for (const agency of await ctx.db.query("agencies").collect()) {
    counts.set(agency.marketId, (counts.get(agency.marketId) ?? 0) + 1);
  }
  const [marketId] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return marketId ?? null;
}

// Public, identity-scoped: create or update the signed-in tenant's own
// profile (by_user index — at most one per user). `marketId` is resolved
// server-side rather than picked in the UI (no market picker exists), and
// re-resolved on every save — including an update — so a profile created
// while `resolveActiveMarketId` above still had the old `.take(1)` bug
// self-heals the next time its owner hits "Enregistrer".
export const upsertMine = mutation({
  args: {
    budgetMax: v.number(),
    roomsMin: v.number(),
    surfaceMin: v.optional(v.number()),
    quartiers: v.optional(v.array(v.string())),
    moveInDate: v.optional(v.string()),
    pitch: v.string(),
  },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const marketId = await resolveActiveMarketId(ctx);
    if (!marketId) throw new Error("No market with any agency configured — run seed:seedAgency first");

    const [existing] = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(1);

    if (existing) {
      await ctx.db.patch("profiles", existing._id, { ...args, marketId });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId: identity.subject,
      marketId,
      ...args,
    });
  },
});
