import { defineApp } from "convex/server";
import { v } from "convex/values";
import staticHosting from "@convex-dev/static-hosting/convex.config";

// Your own HTTP endpoints (convex/http.ts) are served under /api so the
// static site can own the root.
const app = defineApp({
  httpPrefix: "/api",
  env: { FIRECRAWL_API_KEY: v.optional(v.string()) },
});
app.use(staticHosting, { httpPrefix: "/" });

export default app;
