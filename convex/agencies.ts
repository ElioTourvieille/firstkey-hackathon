import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
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
