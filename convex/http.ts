import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { AgentMail } from "@agentmail/convex";

// onMessageReceived: convex/agentmail.ts:onMessageReceived — the only place
// that flips inquiries.status/listings.status to "replied" when a real
// reply lands. See prompts/agentmail-inbound.md for how the webhook itself
// got registered (manually, via AgentMail's dashboard — not by any code in
// this repo).
const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.agentmail.onMessageReceived,
});
const http = httpRouter();

// AgentMail delivers inbound mail + delivery-status events here. Verified
// (Svix) and deduped by event_id inside the component.
//
// NOTE: convex/convex.config.ts sets httpPrefix: "/api" (so
// @convex-dev/static-hosting can own "/"), which means this route is
// actually served at .../api/agentmail/webhook, not .../agentmail/webhook —
// confirm the live URL after deploying before registering it with
// AgentMail.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  // The `as never` cast works around a type-only mismatch: @agentmail/convex
  // 0.1.0's RunMutationCtx (built against convex ^1.24.8) declares
  // `runMutation` with a `transactionLimits` option that this project's
  // convex@1.45.0 GenericActionCtx.runMutation doesn't have — an upstream
  // version-skew issue in the package's shipped types (@agentmail/convex
  // 0.1.0 peers on convex ^1.24.8), not expected to be a real runtime
  // incompatibility since transactionLimits is optional. Re-check this
  // cast if @agentmail/convex ships a version that peers on a newer convex.
  handler: httpAction(async (ctx, req) => agentmail.handleWebhook(ctx as never, req)),
});

export default http;
