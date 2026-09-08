import { v } from "convex/values";
import { internalMutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { isMatch } from "./lib/matching";

// Core matching logic, factored out as a plain function (not itself a
// Convex function) so convex/listings.ts:upsertBatch can call it directly
// inside the same mutation transaction. Mutations can't ctx.runMutation()
// each other — only actions can — so composing mutation logic across files
// means calling a plain function that takes `ctx`, not the Convex function.
export async function matchListing(ctx: MutationCtx, listingId: Id<"listings">) {
  const listing = await ctx.db.get("listings", listingId);
  if (!listing) return;

  // Once a listing has moved past the matching stage (an inquiry was sent,
  // or the agency replied), matching must never touch its status again.
  if (listing.status === "contacted" || listing.status === "replied") return;

  const profiles = await ctx.db.query("profiles").collect();
  const hasMatch = profiles.some(
    (profile) => profile.marketId === listing.marketId && isMatch(profile, listing),
  );

  if (hasMatch && listing.status !== "matched") {
    await ctx.db.patch("listings", listingId, { status: "matched" });
  } else if (!hasMatch && listing.status === "matched") {
    // No active profile matches anymore (e.g. the price rose on a
    // re-crawl) — fall back to "new" instead of leaving a stale match.
    await ctx.db.patch("listings", listingId, { status: "new" });
  }
}

// Convex-function entry point into the same logic, for manual testing:
// `npx convex run matching:matchNewListing '{"listingId":"..."}'`.
export const matchNewListing = internalMutation({
  args: { listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await matchListing(ctx, args.listingId);
    return null;
  },
});
