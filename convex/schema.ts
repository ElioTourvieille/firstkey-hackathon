import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  markets: defineTable({
    name: v.string(),        // "Geneva"
    country: v.string(),     // "CH"
    currency: v.string(),    // "CHF"
  }),

  agencies: defineTable({
    marketId: v.id("markets"),
    name: v.string(),
    listingsUrl: v.string(), // page à crawler
    contactEmail: v.string(), // email générique de la régie — évite de scraper une page de détail par annonce
    lastCrawledAt: v.optional(v.number()),
  }).index("by_market", ["marketId"]),

  listings: defineTable({
    agencyId: v.id("agencies"),
    marketId: v.id("markets"),
    url: v.string(),
    title: v.string(),
    priceChf: v.number(),
    rooms: v.number(),
    surfaceM2: v.optional(v.number()),
    address: v.optional(v.string()),
    sourceHash: v.string(),  // hash(url canonique, sans querystring) pour dédup — voir convex/lib/hash.ts
    status: v.union(
      v.literal("new"),
      v.literal("matched"),
      v.literal("contacted"),
      v.literal("replied"),
    ),
    firstSeenAt: v.number(),
  })
    .index("by_market_status", ["marketId", "status"])
    .index("by_hash", ["sourceHash"])
    .index("by_agency", ["agencyId"]),

  profiles: defineTable({
    userId: v.string(), // Clerk subject
    marketId: v.id("markets"),
    budgetMax: v.number(),
    roomsMin: v.number(),
    moveInDate: v.optional(v.string()),
    pitch: v.string(), // texte libre utilisé pour personnaliser l'email
  }).index("by_user", ["userId"]),

  inquiries: defineTable({
    listingId: v.id("listings"),
    profileId: v.id("profiles"),
    // AgentMail's own message id for this send. convex/agentmail.ts sends
    // via a direct REST call (POST /inboxes/{id}/messages/send), not the
    // @agentmail/convex component's sendMessage/workpool path — that path
    // is broken (the component never declares AGENTMAIL_API_KEY in its own
    // convex.config.ts, so it can't read it from inside the component's
    // isolated env, confirmed against the real API). The REST call returns
    // {message_id, thread_id} synchronously, so both this and
    // agentmailThreadId below are known and set immediately at send time —
    // no async backfill needed.
    outboundId: v.string(),
    agentmailThreadId: v.optional(v.string()),
    status: v.union(
      v.literal("sent"),
      v.literal("replied"),
      v.literal("closed"),
    ),
    sentAt: v.number(),
  })
    .index("by_listing", ["listingId"])
    .index("by_profile", ["profileId"])
    .index("by_outboundId", ["outboundId"]),
});