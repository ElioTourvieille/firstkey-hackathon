"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { SignUpButton, SignInButton } from "@clerk/clerk-react";
import { api } from "@/convex/_generated/api";
import { GENEVA_DISTRICTS } from "@/lib/geneva-districts";
import { formatRelativeTime } from "@/lib/format";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToggleChip from "@/components/ToggleChip";
import ListingCard, { FeedListing } from "@/components/ListingCard";
import Outreach from "@/components/Outreach";

const ROOM_FILTERS = [1.5, 2.5, 3.5, 4.5];

export default function Home() {
  const listings = useQuery(api.listings.listPublic);
  const agencies = useQuery(api.agencies.listPublic);

  const [roomsMin, setRoomsMin] = useState<number | null>(null);
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [surfaceMin, setSurfaceMin] = useState<number | null>(null);
  const [quartiers, setQuartiers] = useState<Set<string>>(new Set());

  const maxPrice = useMemo(() => {
    if (!listings || listings.length === 0) return null;
    return Math.max(...listings.map((l) => l.priceChf));
  }, [listings]);

  // Only listings with a known surfaceM2 count toward the slider's range —
  // most listings have one, but Firecrawl doesn't always extract it.
  const maxSurface = useMemo(() => {
    if (!listings) return null;
    const known = listings.map((l) => l.surfaceM2).filter((s): s is number => s !== undefined);
    return known.length > 0 ? Math.max(...known) : null;
  }, [listings]);

  const quartierCodes = useMemo(() => {
    if (!listings) return [];
    const codes = new Set<string>();
    for (const listing of listings) {
      const match = listing.address?.match(/\b(12\d{2})\b/);
      if (match) codes.add(match[1]);
    }
    return Array.from(codes).sort();
  }, [listings]);

  const filteredListings = useMemo(() => {
    if (!listings) return undefined;
    return listings.filter((listing) => {
      if (roomsMin !== null && listing.rooms < roomsMin) return false;
      if (budgetMax !== null && listing.priceChf > budgetMax) return false;
      // Unlike the (permissive) matching predicate in convex/lib/matching.ts,
      // this is a filter the visitor explicitly set and can reset instantly —
      // an unverifiable listing (no surfaceM2 from Firecrawl) is hidden
      // rather than shown as if it satisfied a minimum we can't confirm.
      if (surfaceMin !== null && (listing.surfaceM2 === undefined || listing.surfaceM2 < surfaceMin)) {
        return false;
      }
      if (quartiers.size > 0) {
        const match = listing.address?.match(/\b(12\d{2})\b/);
        if (!match || !quartiers.has(match[1])) return false;
      }
      return true;
    });
  }, [listings, roomsMin, budgetMax, surfaceMin, quartiers]);

  function toggleQuartier(code: string) {
    setQuartiers((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function resetFilters() {
    setRoomsMin(null);
    setBudgetMax(null);
    setSurfaceMin(null);
    setQuartiers(new Set());
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header active="Flux public" />
      <ActivityTicker listings={listings} agencyCount={agencies?.length} />
      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs tracking-wide text-foreground/50 uppercase font-mono">
              Console de détection automatisée
            </p>
            <h1 className="text-3xl font-semibold mt-1">Index public des baux à loyer</h1>
            <p className="text-foreground/60 mt-1 max-w-2xl">
              Annonces publiées directement par les régies genevoises, avant qu&apos;elles
              n&apos;arrivent sur les grands portails. Mis à jour en direct.
            </p>
          </div>

          <FiltersBar
            roomsMin={roomsMin}
            setRoomsMin={setRoomsMin}
            maxPrice={maxPrice}
            budgetMax={budgetMax}
            setBudgetMax={setBudgetMax}
            maxSurface={maxSurface}
            surfaceMin={surfaceMin}
            setSurfaceMin={setSurfaceMin}
            quartierCodes={quartierCodes}
            quartiers={quartiers}
            toggleQuartier={toggleQuartier}
            onReset={resetFilters}
            resultCount={filteredListings?.length}
          />

          <ListingsFeed listings={filteredListings} />
        </div>

        <aside className="flex flex-col gap-6">
          <Unauthenticated>
            <ProfileCta />
          </Unauthenticated>
          <Authenticated>
            <MyMatches />
          </Authenticated>
          <AgenciesPanel agencies={agencies} />
        </aside>
      </main>

      <Footer agencies={agencies} />
    </div>
  );
}

// The one real "live" signal on this screen: the most recently detected
// listing, with a relative time computed from `firstSeenAt`. Re-renders
// every 30s so the relative time doesn't go stale while the tab stays open.
function ActivityTicker({
  listings,
  agencyCount,
}: {
  listings: (FeedListing & { firstSeenAt: number })[] | undefined;
  agencyCount: number | undefined;
}) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!listings || listings.length === 0) return null;
  const latest = listings[0];

  return (
    <div className="border-b border-border bg-foreground text-background text-xs font-mono">
      <div className="max-w-6xl mx-auto px-6 py-1.5 flex flex-row items-center gap-2 overflow-hidden">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
        <span className="truncate">
          Nouvelle annonce indexée {formatRelativeTime(latest.firstSeenAt)} — {latest.agencyName}
          {latest.address ? `, ${latest.address}` : ""}
        </span>
        {agencyCount !== undefined && (
          <span className="ml-auto shrink-0 text-background/60">
            {agencyCount} régie{agencyCount === 1 ? "" : "s"} suivie{agencyCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function FiltersBar({
  roomsMin,
  setRoomsMin,
  maxPrice,
  budgetMax,
  setBudgetMax,
  maxSurface,
  surfaceMin,
  setSurfaceMin,
  quartierCodes,
  quartiers,
  toggleQuartier,
  onReset,
  resultCount,
}: {
  roomsMin: number | null;
  setRoomsMin: (v: number | null) => void;
  maxPrice: number | null;
  budgetMax: number | null;
  setBudgetMax: (v: number | null) => void;
  maxSurface: number | null;
  surfaceMin: number | null;
  setSurfaceMin: (v: number | null) => void;
  quartierCodes: string[];
  quartiers: Set<string>;
  toggleQuartier: (code: string) => void;
  onReset: () => void;
  resultCount: number | undefined;
}) {
  const hasActiveFilters =
    roomsMin !== null || budgetMax !== null || surfaceMin !== null || quartiers.size > 0;

  return (
    <div className="border border-border rounded-sm p-4 flex flex-col gap-4">
      <div className="flex flex-row items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">
          Filtres {resultCount !== undefined && `· ${resultCount} annonce${resultCount === 1 ? "" : "s"}`}
        </p>
        {hasActiveFilters && (
          <button onClick={onReset} className="text-xs text-accent hover:underline">
            Réinitialiser
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-foreground/60">Pièces minimum</p>
        <div className="flex flex-row flex-wrap gap-1.5">
          <ToggleChip active={roomsMin === null} onClick={() => setRoomsMin(null)}>
            Toutes
          </ToggleChip>
          {ROOM_FILTERS.map((n) => (
            <ToggleChip key={n} active={roomsMin === n} onClick={() => setRoomsMin(n)}>
              {n}+
            </ToggleChip>
          ))}
        </div>
      </div>

      {maxPrice !== null && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-foreground/60 flex justify-between">
            <span>Loyer mensuel maximal</span>
            <span className="font-mono">
              {(budgetMax ?? maxPrice).toLocaleString()} CHF
            </span>
          </p>
          <input
            type="range"
            min={0}
            max={maxPrice}
            step={50}
            value={budgetMax ?? maxPrice}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBudgetMax(v >= maxPrice ? null : v);
            }}
            className="w-full accent-foreground"
          />
        </div>
      )}

      {maxSurface !== null && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-foreground/60 flex justify-between">
            <span>Surface minimale</span>
            <span className="font-mono">{surfaceMin ?? 0} m²</span>
          </p>
          <input
            type="range"
            min={0}
            max={maxSurface}
            step={5}
            value={surfaceMin ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSurfaceMin(v <= 0 ? null : v);
            }}
            className="w-full accent-foreground"
          />
        </div>
      )}

      {quartierCodes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-foreground/60">Quartiers (Genève)</p>
          <div className="flex flex-row flex-wrap gap-1.5">
            {quartierCodes.map((code) => (
              <ToggleChip
                key={code}
                active={quartiers.has(code)}
                onClick={() => toggleQuartier(code)}
              >
                {GENEVA_DISTRICTS[code] ?? code} <span className="opacity-50">({code})</span>
              </ToggleChip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Public feed: no auth gate here on purpose — a judge (or any renter)
// opening the site with zero login must see the product working. Only
// account-specific chrome (the header above) and the matches section below
// are auth-gated.
function ListingsFeed({
  listings,
}: {
  listings: (FeedListing & { firstSeenAt: number })[] | undefined;
}) {
  if (listings === undefined) {
    return <p className="text-foreground/50 py-8">Chargement des annonces…</p>;
  }

  if (listings.length === 0) {
    return (
      <p className="text-foreground/50 py-8">
        Aucune annonce ne correspond à ces filtres pour le moment.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {listings.map((listing) => (
        <ListingCard key={listing._id} listing={listing} firstSeenAt={listing.firstSeenAt} />
      ))}
    </ul>
  );
}

// Authenticated: the signed-in tenant's own listings matching their own
// profile (convex/profiles.ts:myMatches). Renders nothing if they don't
// have a profile yet — profile creation is a separate page (/profile).
// This inline summary stays (quick glance from the home feed); the full
// two-pane view with sent inquiries lives at /matches.
function MyMatches() {
  const matches = useQuery(api.profiles.myMatches);

  if (!matches || matches.length === 0) return null;

  return (
    <section className="border border-border rounded-sm p-4 flex flex-col gap-3">
      <div className="flex flex-row items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">
          Vos correspondances
        </p>
        <Link href="/matches" className="text-xs text-accent hover:underline">
          Tout voir →
        </Link>
      </div>
      <ul className="flex flex-col gap-4">
        {matches.slice(0, 3).map((listing) => (
          <li key={listing._id} className="flex flex-col gap-2">
            <ListingCard listing={listing} firstSeenAt={listing.firstSeenAt} />
            <Outreach listingId={listing._id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProfileCta() {
  return (
    <div className="bg-foreground text-background rounded-sm p-5 flex flex-col gap-3">
      <p className="text-xs uppercase tracking-wide text-background/60 font-mono">
        Priorité dossier Genève
      </p>
      <p className="text-sm text-background/80">
        Créez votre profil pour être notifié dès qu&apos;une annonce correspond à votre
        budget et votre recherche — et laissez firstkey préparer votre candidature.
      </p>
      <SignUpButton mode="modal">
        <button className="bg-background text-foreground px-3 py-2 rounded-sm text-sm text-left">
          Créer mon profil de recherche
        </button>
      </SignUpButton>
      <SignInButton mode="modal">
        <button className="border border-background/30 px-3 py-2 rounded-sm text-sm text-left text-background/80">
          Déjà un dossier ? Se connecter
        </button>
      </SignInButton>
    </div>
  );
}

function AgenciesPanel({
  agencies,
}: {
  agencies: { _id: string; name: string; lastCrawledAt?: number }[] | undefined;
}) {
  if (!agencies || agencies.length === 0) return null;

  return (
    <div className="border border-border rounded-sm p-4 flex flex-col gap-3">
      <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">
        Régies suivies · {agencies.length}
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {agencies.map((agency) => (
          <li key={agency._id} className="flex flex-row justify-between gap-2">
            <span>{agency.name}</span>
            <span className="text-foreground/40 font-mono text-xs shrink-0">
              {agency.lastCrawledAt
                ? `synchro ${formatRelativeTime(agency.lastCrawledAt)}`
                : "pas encore synchronisée"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
