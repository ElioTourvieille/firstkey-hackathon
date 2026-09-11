import { v } from "convex/values";
import { internalAction, internalMutation, action, query, env } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { matchedListingValidator } from "./profiles";

// No `new AgentMail(components.agentmail)` client instance here — every
// operation in this file goes through agentmailFetch (direct REST) or the
// raw `components.agentmail.lib.*` reference, not the client wrapper. See
// the comment on agentmailFetch below for why.
//
// @agentmail/convex@0.1.0's createInbox/listInboxes/getInboxRemote/
// deleteInbox/listThreads/getThread/getMessage are declared as
// `internalAction` *inside the component's own source*. Confirmed by
// testing (a public component query resolved fine, this internal action
// didn't) that this makes them unreachable from a consuming app entirely —
// a component only exposes what it marks `public` across that boundary,
// full stop. Not a version-skew fluke, an upstream visibility bug.
//
// Separately, and more importantly: sendMessage/enqueueSend/performSend
// (the component's actual send path) is broken too — performSend runs
// *inside* the component and needs AGENTMAIL_API_KEY, but the component's
// own convex.config.ts never declares that env var (Convex isolates a
// component's process.env from the parent app's unless the component
// explicitly opts in — confirmed against Convex's own docs), so
// performSend can never read the key no matter what's set on this
// deployment. Verified against the real API: enqueueSend succeeds,
// performSend then fails every retry with "AGENTMAIL_API_KEY is not set",
// even right after a fresh deploy.
//
// Worked around by calling AgentMail's REST API directly for both
// operations — same pattern as convex/firecrawl.ts and convex/openai.ts —
// using the same AGENTMAIL_API_KEY the component itself would read if it
// could. The component is still used for what isn't broken: receiving
// (convex/http.ts's webhook, whose signature verification happens in our
// own code, not the component's) and the reactive `listInboundMessages`
// query.
async function agentmailFetch(path: string, init: RequestInit): Promise<unknown> {
  const apiKey = env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AGENTMAIL_API_KEY is not set. Run `npx convex env set AGENTMAIL_API_KEY <key>`.",
    );
  }
  const res = await fetch(`https://api.agentmail.to/v0${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`AgentMail API error (${res.status}): ${await res.text()}`);
  }
  if (res.status === 204) return null;
  return await res.json();
}

// Admin-only, one-off: creates the single AgentMail inbox this app sends
// from — one shared "firstkey" outreach identity, not one inbox per user.
// Run manually once (`npx convex run agentmail:createInbox
// '{"username":"firstkey"}'`), then store the returned inbox_id:
//   npx convex env set AGENTMAIL_INBOX_ID <inbox_id>
export const createInbox = internalAction({
  args: {
    username: v.optional(v.string()),
    domain: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    return await agentmailFetch("/inboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: args.username,
        domain: args.domain,
        display_name: args.displayName,
      }),
    });
  },
});

// Records a successful send: creates the inquiries row (status "sent",
// both AgentMail ids already known — see the comment on
// inquiries.outboundId in convex/schema.ts) and flips listings.status to
// "contacted". Split out of sendInquiry below because that's an `action`
// (it does a real fetch) and actions can't touch ctx.db directly.
export const recordSentInquiry = internalMutation({
  args: {
    listingId: v.id("listings"),
    profileId: v.id("profiles"),
    agentmailMessageId: v.string(),
    agentmailThreadId: v.string(),
  },
  returns: v.id("inquiries"),
  handler: async (ctx, args) => {
    const inquiryId = await ctx.db.insert("inquiries", {
      listingId: args.listingId,
      profileId: args.profileId,
      outboundId: args.agentmailMessageId,
      agentmailThreadId: args.agentmailThreadId,
      status: "sent",
      sentAt: Date.now(),
    });
    await ctx.db.patch("listings", args.listingId, { status: "contacted" });
    return inquiryId;
  },
});

// Sends the (human-reviewed) inquiry text to the listing's agency.
// PUBLIC, but manual-trigger only: nothing in this codebase calls this
// automatically — not matching.ts, not a cron. `text` must be the exact,
// human-approved text (typically edited from openai:draftInquiry's
// output), never regenerated here. See AGENTS.md — no real send without
// explicit human validation, and the first-ever send must go to an address
// the tester controls, never straight to a real agency.
//
// No `profileId` arg on purpose: the caller's own profile is resolved from
// their identity, not taken from the client, so there's no ownership check
// to get wrong — a signed-in user can only ever send from their own
// profile.
export const sendInquiry = action({
  args: {
    listingId: v.id("listings"),
    text: v.string(),
  },
  returns: v.object({
    inquiryId: v.id("inquiries"),
    agentmailMessageId: v.string(),
    agentmailThreadId: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const inboxId = env.AGENTMAIL_INBOX_ID;
    if (!inboxId) {
      throw new Error(
        "AGENTMAIL_INBOX_ID is not set. Create an inbox first via " +
          "agentmail:createInbox, then `npx convex env set AGENTMAIL_INBOX_ID <id>`.",
      );
    }

    const profile: Doc<"profiles"> | null = await ctx.runQuery(internal.profiles.getByUserId, {
      userId: identity.subject,
    });
    if (!profile) throw new Error("No profile for the signed-in user");

    const listing: Doc<"listings"> | null = await ctx.runQuery(internal.listings.get, {
      listingId: args.listingId,
    });
    if (!listing) throw new Error(`Listing ${args.listingId} not found`);

    const agency: Doc<"agencies"> | null = await ctx.runQuery(internal.agencies.get, {
      agencyId: listing.agencyId,
    });
    if (!agency) throw new Error(`Agency ${listing.agencyId} not found`);

    const response = (await agentmailFetch(`/inboxes/${inboxId}/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: agency.contactEmail,
        subject: `Candidature — ${listing.title}`,
        text: args.text,
        labels: ["rental-inquiry"],
      }),
    })) as { message_id?: string; thread_id?: string } | null;

    if (!response?.message_id || !response.thread_id) {
      throw new Error(
        `AgentMail returned a 2xx without a usable send response: ${JSON.stringify(response)}`,
      );
    }

    const inquiryId: Id<"inquiries"> = await ctx.runMutation(internal.agentmail.recordSentInquiry, {
      listingId: args.listingId,
      profileId: profile._id,
      agentmailMessageId: response.message_id,
      agentmailThreadId: response.thread_id,
    });

    return {
      inquiryId,
      agentmailMessageId: response.message_id,
      agentmailThreadId: response.thread_id,
    };
  },
});

// Public, identity-scoped: the signed-in tenant's own sent inquiries, with
// enough listing/agency context to render a card — never `contactEmail`.
// The real reason this exists: `listings:status` flips to "contacted" the
// moment an inquiry is sent (see recordSentInquiry above), which is exactly
// what makes profiles:myMatches stop returning that listing — so without
// this query, a sent inquiry simply vanishes from the app with no record a
// user can see. Doesn't return the email text itself: `inquiries` only ever
// stored the AgentMail ids + status/sentAt, never the body (see
// convex/schema.ts's comment on `outboundId`) — out of scope to add here.
export const myInquiries = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("inquiries"),
      status: v.union(v.literal("sent"), v.literal("replied"), v.literal("closed")),
      sentAt: v.number(),
      listing: matchedListingValidator,
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const [profile] = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(1);
    if (!profile) return [];

    const inquiries = await ctx.db
      .query("inquiries")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .collect();

    const withListings = await Promise.all(
      inquiries.map(async (inquiry) => {
        const listing = await ctx.db.get("listings", inquiry.listingId);
        if (!listing) return null;
        const agency = await ctx.db.get("agencies", listing.agencyId);
        return {
          _id: inquiry._id,
          status: inquiry.status,
          sentAt: inquiry.sentAt,
          listing: {
            _id: listing._id,
            title: listing.title,
            url: listing.url,
            priceChf: listing.priceChf,
            rooms: listing.rooms,
            surfaceM2: listing.surfaceM2,
            address: listing.address,
            firstSeenAt: listing.firstSeenAt,
            agencyName: agency?.name ?? "Unknown agency",
          },
        };
      }),
    );

    return withListings
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .sort((a, b) => b.sentAt - a.sentAt);
  },
});

// Reactive thread messages for one of the caller's own inquiries — the
// component's local mirror of inbound mail, kept live by convex/http.ts's
// webhook. Not affected by the send-path bug above: this is a plain query
// against the component's own table.
export const myThread = query({
  args: { inquiryId: v.id("inquiries") },
  // Passed through as-is from the component's own (already-validated)
  // inboundMessages table — not worth re-declaring that whole shape here.
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const inquiry = await ctx.db.get("inquiries", args.inquiryId);
    if (!inquiry?.agentmailThreadId) return [];

    const profile: Doc<"profiles"> | null = await ctx.db.get("profiles", inquiry.profileId);
    if (!profile || profile.userId !== identity.subject) return [];

    return await ctx.runQuery(components.agentmail.lib.listInboundMessages, {
      threadId: inquiry.agentmailThreadId,
    });
  },
});

// Admin-only: list AgentMail's live view of every thread for our inbox —
// only used for manual verification during testing (e.g. confirming a
// controlled test send actually landed), never called from the UI. Direct
// REST call, same reasoning as createInbox above (listThreads is also an
// unreachable internalAction inside the component).
export const listMyInboxThreads = internalAction({
  args: {},
  returns: v.any(),
  handler: async () => {
    const inboxId = env.AGENTMAIL_INBOX_ID;
    if (!inboxId) throw new Error("AGENTMAIL_INBOX_ID is not set.");
    return await agentmailFetch(`/inboxes/${inboxId}/threads`, { method: "GET" });
  },
});

// Admin-only: fetch one thread's full message content straight from
// AgentMail's API — used to manually verify a test send actually
// delivered and read what landed, without waiting on the webhook.
export const getThread = internalAction({
  args: { threadId: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const inboxId = env.AGENTMAIL_INBOX_ID;
    if (!inboxId) throw new Error("AGENTMAIL_INBOX_ID is not set.");
    return await agentmailFetch(`/inboxes/${inboxId}/threads/${args.threadId}`, { method: "GET" });
  },
});
