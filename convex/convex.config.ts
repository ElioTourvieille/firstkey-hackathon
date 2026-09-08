import { defineApp } from "convex/server";
import { v } from "convex/values";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import agentmail from "@agentmail/convex/convex.config";

// Your own HTTP endpoints (convex/http.ts) are served under /api so the
// static site can own the root.
const app = defineApp({
  httpPrefix: "/api",
  env: {
    FIRECRAWL_API_KEY: v.optional(v.string()),
    OPENAI_API_KEY: v.optional(v.string()),
    // AGENTMAIL_API_KEY is read both by the @agentmail/convex component
    // itself (directly from process.env, not through this typed accessor)
    // AND by convex/agentmail.ts's own direct REST calls (a workaround for
    // an upstream bug — see the comment above agentmailFetch in that
    // file), hence declared here too. AGENTMAIL_WEBHOOK_SECRET stays
    // component-only, never read by our own code.
    AGENTMAIL_API_KEY: v.optional(v.string()),
    // The single AgentMail inbox this app sends from — see
    // convex/agentmail.ts:createInbox.
    AGENTMAIL_INBOX_ID: v.optional(v.string()),
  },
});
app.use(staticHosting, { httpPrefix: "/" });
app.use(agentmail);

export default app;
