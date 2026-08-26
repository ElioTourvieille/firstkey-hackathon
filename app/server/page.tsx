import Home from "./inner";
import AuthGate from "@/components/AuthGate";

// Static export: there is no server to render this page per-request, so all
// data loading is client-side (see inner.tsx). Route protection is enforced
// client-side via <AuthGate> instead of proxy.ts (middleware doesn't run
// under static export either). The real authorization boundary is whatever
// the Convex functions themselves check (ctx.auth) - this only gates the UI.
export default function ServerPage() {
  return (
    <AuthGate>
      <main className="p-8 flex flex-col gap-4 mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold text-center">Convex + Next.js</h1>
        <Home />
      </main>
    </AuthGate>
  );
}
