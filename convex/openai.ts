import { v } from "convex/values";
import { internalAction, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

// Drafts the applicant's message to send to an agency for one
// listing/profile pair — direct `fetch` to OpenAI's API (gpt-4o-mini), not
// the Convex AI Gateway (a paid-plan feature). See the
// matching-outreach-firstkey skill, flow step 3.
//
// internalAction, not a public action: it reads `profiles.pitch` (the
// tenant's own free text) for an arbitrary `profileId` with no ownership
// check yet. Once this is wired into a UI (alongside convex/agentmail.ts —
// draft and send belong in one review step, not two), that UI-facing
// wrapper must verify the caller owns the profile before calling this.
export const draftInquiry = internalAction({
  args: { profileId: v.id("profiles"), listingId: v.id("listings") },
  returns: v.string(),
  // Explicit param/return types below (Doc<...>, Promise<string>) aren't
  // just style: without them tsc chokes on a genuine circular inference —
  // this file's own export type feeds into `internal`'s type (via
  // _generated/api.d.ts's `typeof openai`), which this handler then reads
  // from to resolve `internal.profiles.get` etc. Pinning the types down
  // breaks the cycle instead of leaving it to inference.
  handler: async (ctx, args): Promise<string> => {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Run `npx convex env set OPENAI_API_KEY <key>`.",
      );
    }

    const profile: Doc<"profiles"> | null = await ctx.runQuery(internal.profiles.get, {
      profileId: args.profileId,
    });
    if (!profile) {
      throw new Error(`Profile ${args.profileId} not found`);
    }

    const listing: Doc<"listings"> | null = await ctx.runQuery(internal.listings.get, {
      listingId: args.listingId,
    });
    if (!listing) {
      throw new Error(`Listing ${args.listingId} not found`);
    }

    const agency: Doc<"agencies"> | null = await ctx.runQuery(internal.agencies.get, {
      agencyId: listing.agencyId,
    });
    if (!agency) {
      throw new Error(`Agency ${listing.agencyId} not found`);
    }

    const listingDetails = [
      `Title: ${listing.title}`,
      `Address: ${listing.address ?? "not specified"}`,
      `Monthly rent: ${listing.priceChf} CHF`,
      `Rooms: ${listing.rooms}`,
      listing.surfaceM2 ? `Surface: ${listing.surfaceM2} m2` : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You write short rental-application emails on behalf of a " +
              "prospective tenant, addressed to a Swiss real-estate agency. " +
              "Write in the same language as the tenant's own pitch text " +
              "below (French or English). Professional, warm, concrete — " +
              "reference the specific listing by address, state the " +
              "tenant's budget/room fit naturally, and weave in their pitch " +
              "rather than quoting it verbatim. No subject line, no " +
              "placeholders like [Name] — sign off simply. Keep it under " +
              "150 words.",
          },
          {
            role: "user",
            content:
              `Agency: ${agency.name}\n\n` +
              `Listing:\n${listingDetails}\n\n` +
              `Tenant's budget: up to ${profile.budgetMax} CHF/month, ` +
              `${profile.roomsMin}+ rooms` +
              (profile.moveInDate ? `, move-in from ${profile.moveInDate}` : "") +
              `\n\nTenant's pitch (their own words, use as background, ` +
              `don't quote verbatim):\n${profile.pitch}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI request failed (${res.status}): ${await res.text()}`);
    }

    const payload = await res.json();
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`OpenAI returned no usable text: ${JSON.stringify(payload)}`);
    }

    return text.trim();
  },
});
