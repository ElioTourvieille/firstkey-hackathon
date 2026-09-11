"use client";

import Link from "next/link";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";

// Shared by app/page.tsx and app/profile/page.tsx so both screens render
// the same 4-tab nav from design/design-system.md. Two tabs ("Mes
// correspondances", "Messagerie régies") have no route yet — `href: null`
// keeps them visible but non-interactive rather than linking to a 404.
type NavTab = { label: string; href: string | null };

const NAV_TABS: NavTab[] = [
  { label: "Flux public", href: "/" },
  { label: "Mes correspondances", href: "/matches" },
  { label: "Messagerie régies", href: null },
  { label: "Mon profil", href: "/profile" },
];

export default function Header({ active }: { active: string }) {
  return (
    <header className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-3 flex flex-row justify-between items-center gap-6">
        <div className="flex flex-row items-center gap-8">
          <Link href="/" className="font-semibold">
            firstkey
          </Link>
          <nav className="flex flex-row gap-5 text-sm">
            {NAV_TABS.map((tab) => {
              const isActive = tab.label === active;
              if (!tab.href) {
                return (
                  <span
                    key={tab.label}
                    className="text-foreground/30 cursor-not-allowed"
                    title="Bientôt disponible"
                  >
                    {tab.label}
                  </span>
                );
              }
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  className={
                    isActive
                      ? "font-medium border-b-2 border-foreground pb-0.5"
                      : "text-foreground/70 hover:text-foreground transition-colors"
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Authenticated>
          <UserButton />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-row gap-2">
            <SignInButton mode="modal">
              <button className="border border-border px-3 py-1.5 rounded-sm text-sm hover:border-foreground transition-colors">
                Se connecter
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="bg-foreground text-background px-3 py-1.5 rounded-sm text-sm">
                Créer mon profil
              </button>
            </SignUpButton>
          </div>
        </Unauthenticated>
      </div>
    </header>
  );
}
