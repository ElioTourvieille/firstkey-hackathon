"use client";

import { ReactNode } from "react";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

// Keeps @clerk/clerk-react confined to a Client Component. Importing it
// directly from a Server Component (e.g. app/server/page.tsx) pulls its
// runtime into the RSC module graph, where it breaks (swr's react-server
// export shape doesn't match what @clerk/shared expects there).
export default function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </>
  );
}
