import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, action, query, env } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { matchedListingValidator } from "./profiles";
import schema from "./schema";

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
// inquiries.outboundId in convex/schema.ts), records the text in
// outboundMessages (see convex/schema.ts — the only place the text of an
// outbound message is ever persisted), and flips listings.status to
// "contacted". Split out of sendInquiry below because that's an `action`
// (it does a real fetch) and actions can't touch ctx.db directly.
export const recordSentInquiry = internalMutation({
  args: {
    listingId: v.id("listings"),
    profileId: v.id("profiles"),
    text: v.string(),
    agentmailMessageId: v.string(),
    agentmailThreadId: v.string(),
  },
  returns: v.id("inquiries"),
  handler: async (ctx, args) => {
    const sentAt = Date.now();
    const inquiryId = await ctx.db.insert("inquiries", {
      listingId: args.listingId,
      profileId: args.profileId,
      outboundId: args.agentmailMessageId,
      agentmailThreadId: args.agentmailThreadId,
      status: "sent",
      sentAt,
    });
    await ctx.db.insert("outboundMessages", {
      inquiryId,
      text: args.text,
      agentmailMessageId: args.agentmailMessageId,
      sentAt,
    });
    await ctx.db.patch("listings", args.listingId, { status: "contacted" });
    return inquiryId;
  },
});

// Same shape as recordSentInquiry above, for a reply instead of the
// initial contact: no new inquiries row (the thread already exists),
// just a new outboundMessages entry, and inquiries.status goes back to
// "sent" — replying puts the ball back in the agency's court — unless the
// thread is already "closed".
export const recordSentReply = internalMutation({
  args: {
    inquiryId: v.id("inquiries"),
    text: v.string(),
    agentmailMessageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("outboundMessages", {
      inquiryId: args.inquiryId,
      text: args.text,
      agentmailMessageId: args.agentmailMessageId,
      sentAt: Date.now(),
    });
    const inquiry = await ctx.db.get("inquiries", args.inquiryId);
    if (inquiry && inquiry.status !== "closed") {
      await ctx.db.patch("inquiries", args.inquiryId, { status: "sent" });
    }
    return null;
  },
});

// Internal-only ownership check shared by replyToInquiry (action, can't
// touch ctx.db) and — indirectly — anything else that needs "is this
// inquiry really this user's". Returns null rather than throwing so the
// caller decides how to react (a 403-shaped error, an empty result, ...).
export const getOwnedInquiry = internalQuery({
  args: { inquiryId: v.id("inquiries"), userId: v.string() },
  returns: v.union(schema.doc("inquiries"), v.null()),
  handler: async (ctx, args) => {
    const inquiry = await ctx.db.get("inquiries", args.inquiryId);
    if (!inquiry) return null;
    const profile = await ctx.db.get("profiles", inquiry.profileId);
    if (!profile || profile.userId !== args.userId) return null;
    return inquiry;
  },
});

// Fired for every real inbound message.received event, once AgentMail's
// webhook (registered manually via their dashboard — see
// prompts/agentmail-inbound.md; nothing in this repo registers it via the
// API) delivers it to convex/http.ts. Closes the loop `recordSentInquiry`
// opens above: flips the matching inquiry from "sent" to "replied" (found
// by `agentmailThreadId`, the same id captured synchronously at send time —
// no lookup ambiguity), and the underlying listing's status to match. This
// is the one piece of the schema's "replied" state (see convex/schema.ts)
// that nothing set before this function existed.
//
// `message`/`thread` are typed `unknown` by the component itself (see
// AgentMailOptions in @agentmail/convex) — only `thread_id` is read here,
// confirmed snake_case against AgentMail's real webhook event docs.
export const onMessageReceived = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const threadId = (args.message as { thread_id?: string } | null)?.thread_id;
    if (!threadId) return null;

    const [inquiry] = await ctx.db
      .query("inquiries")
      .withIndex("by_agentmail_thread", (q) => q.eq("agentmailThreadId", threadId))
      .take(1);
    if (!inquiry) return null; // Not a thread we're tracking.

    if (inquiry.status === "sent") {
      await ctx.db.patch("inquiries", inquiry._id, { status: "replied" });
      await ctx.db.patch("listings", inquiry.listingId, { status: "replied" });
    }

    return null;
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
      text: args.text,
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

// Replies inside an existing thread — the first real reply-send capability
// in this codebase (sendInquiry above only ever does the initial cold
// contact). Same rules as sendInquiry: PUBLIC, but manual-trigger only,
// `text` must be human-reviewed, and the first-ever real reply must go to
// a thread the tester controls, never straight to a real agency, without
// explicit validation at the time. `inReplyToMessageId` is the AgentMail
// message_id of the inbound message being answered — the UI reads it off
// the latest inbound entry from myThread below, it's never guessed here.
export const replyToInquiry = action({
  args: {
    inquiryId: v.id("inquiries"),
    inReplyToMessageId: v.string(),
    text: v.string(),
  },
  returns: v.object({
    agentmailMessageId: v.string(),
    agentmailThreadId: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const inquiry: Doc<"inquiries"> | null = await ctx.runQuery(internal.agentmail.getOwnedInquiry, {
      inquiryId: args.inquiryId,
      userId: identity.subject,
    });
    if (!inquiry) throw new Error("No such inquiry for the signed-in user");

    const inboxId = env.AGENTMAIL_INBOX_ID;
    if (!inboxId) {
      throw new Error(
        "AGENTMAIL_INBOX_ID is not set. Create an inbox first via " +
          "agentmail:createInbox, then `npx convex env set AGENTMAIL_INBOX_ID <id>`.",
      );
    }

    const response = (await agentmailFetch(
      `/inboxes/${inboxId}/messages/${args.inReplyToMessageId}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: args.text }),
      },
    )) as { message_id?: string; thread_id?: string } | null;

    if (!response?.message_id || !response.thread_id) {
      throw new Error(
        `AgentMail returned a 2xx without a usable reply response: ${JSON.stringify(response)}`,
      );
    }

    await ctx.runMutation(internal.agentmail.recordSentReply, {
      inquiryId: args.inquiryId,
      text: args.text,
      agentmailMessageId: response.message_id,
    });

    return {
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
// user can see. Doesn't return message text — that's myThread below
// (outboundMessages + the agency's real replies), this is just the list of
// threads to pick from.
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

// Reactive, full thread for one of the caller's own inquiries — merges
// what WE sent (outboundMessages, this app's own table) with what the
// agency sent back (the component's own inboundMessages table, kept live
// by convex/http.ts's webhook) into one chronological, normalized list.
// Each entry: `{kind, text, timestamp, from?, messageId?}` — `messageId`
// only set on inbound entries, since that's what replyToInquiry needs to
// know what it's replying to. The component's inbound message shape isn't
// validated by this app (`v.any()` passthrough, same reasoning as before:
// it's already validated inside the component), so its fields are read
// defensively here rather than assumed.
export const myThread = query({
  args: { inquiryId: v.id("inquiries") },
  returns: v.array(
    v.object({
      kind: v.union(v.literal("outbound"), v.literal("inbound")),
      text: v.string(),
      timestamp: v.number(),
      from: v.optional(v.string()),
      messageId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const inquiry = await ctx.db.get("inquiries", args.inquiryId);
    if (!inquiry) return [];

    const profile: Doc<"profiles"> | null = await ctx.db.get("profiles", inquiry.profileId);
    if (!profile || profile.userId !== identity.subject) return [];

    const outbound = await ctx.db
      .query("outboundMessages")
      .withIndex("by_inquiry", (q) => q.eq("inquiryId", inquiry._id))
      .collect();

    const inboundRaw: unknown[] = inquiry.agentmailThreadId
      ? await ctx.runQuery(components.agentmail.lib.listInboundMessages, {
          threadId: inquiry.agentmailThreadId,
        })
      : [];

    const merged = [
      ...outbound.map((m) => ({
        kind: "outbound" as const,
        text: m.text,
        timestamp: m.sentAt,
      })),
      ...inboundRaw.map((raw) => {
        const m = raw as {
          message_id?: string;
          text?: string;
          preview?: string;
          from?: string;
          timestamp?: string | number;
          created_at?: string | number;
        };
        const ts = m.timestamp ?? m.created_at;
        return {
          kind: "inbound" as const,
          text: m.text ?? m.preview ?? "",
          timestamp: typeof ts === "string" ? Date.parse(ts) : (ts ?? 0),
          from: m.from,
          messageId: m.message_id,
        };
      }),
    ];

    return merged.sort((a, b) => a.timestamp - b.timestamp);
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
