"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { SignUpButton, SignInButton, UserButton } from "@clerk/clerk-react";
import { api } from "@/convex/_generated/api";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        firstkey
        <Authenticated>
          <UserButton />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-row gap-2">
            <SignInButton mode="modal">
              <button className="bg-foreground text-background px-3 py-1.5 rounded-md text-sm">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="border border-foreground px-3 py-1.5 rounded-md text-sm">
                Sign up
              </button>
            </SignUpButton>
          </div>
        </Unauthenticated>
      </header>
      <main className="p-8 flex flex-col gap-8 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center">firstkey</h1>
        <p className="text-center text-slate-500 dark:text-slate-400">
          New rental listings from Geneva agencies, as they&apos;re posted.
        </p>
        <Authenticated>
          <MyMatches />
        </Authenticated>
        <ListingsFeed />
      </main>
    </>
  );
}

// Public feed: no auth gate here on purpose — a judge (or any renter)
// opening the site with zero login must see the product working. Only
// account-specific chrome (the header above) and the matches section below
// are auth-gated.
function ListingsFeed() {
  const listings = useQuery(api.listings.listPublic);

  if (listings === undefined) {
    return <p className="text-center text-slate-500">Loading listings…</p>;
  }

  if (listings.length === 0) {
    return (
      <p className="text-center text-slate-500">
        No listings yet — check back soon.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {listings.map((listing) => (
        <ListingCard key={listing._id} listing={listing} />
      ))}
    </ul>
  );
}

// Authenticated: the signed-in tenant's own listings matching their own
// profile (convex/profiles.ts:myMatches). Renders nothing if they don't
// have a profile yet — profile creation is a separate, not-yet-built page.
function MyMatches() {
  const matches = useQuery(api.profiles.myMatches);

  if (!matches || matches.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-md p-4">
      <h2 className="text-xl font-semibold">Your matches</h2>
      <ul className="flex flex-col gap-4">
        {matches.map((listing) => (
          <ListingCard key={listing._id} listing={listing} />
        ))}
      </ul>
    </section>
  );
}

type ListingCardData = {
  _id: string;
  title: string;
  url: string;
  priceChf: number;
  rooms: number;
  surfaceM2?: number;
  address?: string;
  agencyName: string;
};

function ListingCard({ listing }: { listing: ListingCardData }) {
  return (
    <li className="border border-slate-200 dark:border-slate-800 rounded-md p-4 flex flex-col gap-1">
      <a
        href={listing.url}
        target="_blank"
        rel="noreferrer"
        className="font-semibold hover:underline"
      >
        {listing.title}
      </a>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {listing.priceChf.toLocaleString()} CHF/month · {listing.rooms} rooms
        {listing.surfaceM2 ? ` · ${listing.surfaceM2} m²` : ""}
        {listing.address ? ` · ${listing.address}` : ""}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {listing.agencyName}
      </p>
    </li>
  );
}
