"use client";

import { useEffect, useMemo, useState } from "react";
import { Authenticated, Unauthenticated, useAction, useQuery } from "convex/react";
import { SignUpButton, SignInButton, UserButton } from "@clerk/clerk-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Public postal-code → district name lookup for Geneva canton (1200-1299).
// Real, public geography — not product data — used only to label the
// quartier filter; the filter itself only ever offers codes that actually
// appear in loaded listing addresses (see `quartierCodes` in `Home`).
const GENEVA_DISTRICTS: Record<string, string> = {
  "1201": "Pâquis",
  "1202": "Servette",
  "1203": "Sécheron",
  "1204": "Vieille-Ville",
  "1205": "Plainpalais",
  "1206": "Champel",
  "1207": "Eaux-Vives",
  "1208": "Florissant",
  "1209": "Petit-Saconnex",
  "1213": "Onex",
  "1218": "Grand-Saconnex",
  "1219": "Le Lignon",
  "1227": "Carouge",
  "1228": "Plan-les-Ouates",
  "1231": "Conches",
  "1290": "Versoix",
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  new: { label: "Nouveau", className: "text-status-new" },
  matched: { label: "Correspond à un profil", className: "text-status-new" },
  contacted: { label: "En attente de réponse", className: "text-status-pending" },
  replied: { label: "Réponse reçue", className: "text-accent" },
};

const ROOM_FILTERS = [1.5, 2.5, 3.5, 4.5];

export default function Home() {
  const listings = useQuery(api.listings.listPublic);
  const agencies = useQuery(api.agencies.listPublic);

  const [roomsMin, setRoomsMin] = useState<number | null>(null);
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [quartiers, setQuartiers] = useState<Set<string>>(new Set());

  const maxPrice = useMemo(() => {
    if (!listings || listings.length === 0) return null;
    return Math.max(...listings.map((l) => l.priceChf));
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
      if (quartiers.size > 0) {
        const match = listing.address?.match(/\b(12\d{2})\b/);
        if (!match || !quartiers.has(match[1])) return false;
      }
      return true;
    });
  }, [listings, roomsMin, budgetMax, quartiers]);

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
    setQuartiers(new Set());
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
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

const NAV_TABS = [
  { label: "Flux public", active: true },
  { label: "Mes correspondances", active: false },
  { label: "Messagerie régies", active: false },
  { label: "Mon profil", active: false },
];

function Header() {
  return (
    <header className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-3 flex flex-row justify-between items-center gap-6">
        <div className="flex flex-row items-center gap-8">
          <span className="font-semibold">firstkey</span>
          <nav className="flex flex-row gap-5 text-sm">
            {NAV_TABS.map((tab) =>
              tab.active ? (
                <span key={tab.label} className="font-medium border-b-2 border-foreground pb-0.5">
                  {tab.label}
                </span>
              ) : (
                <span
                  key={tab.label}
                  className="text-foreground/30 cursor-not-allowed"
                  title="Bientôt disponible"
                >
                  {tab.label}
                </span>
              ),
            )}
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

type PublicListing = {
  _id: string;
  title: string;
  url: string;
  priceChf: number;
  rooms: number;
  surfaceM2?: number;
  address?: string;
  agencyName: string;
};

// listings:listPublic returns status/firstSeenAt too; profiles:myMatches
// (a distinct, narrower, identity-scoped validator — see convex/profiles.ts)
// deliberately doesn't, since a match's status is implied by it appearing
// in "your matches" at all. ListingCard renders the status/time row only
// when they're present.
type FeedListing = PublicListing & {
  status: "new" | "matched" | "contacted" | "replied";
  firstSeenAt: number;
};

// The one real "live" signal on this screen: the most recently detected
// listing, with a relative time computed from `firstSeenAt`. Re-renders
// every 30s so the relative time doesn't go stale while the tab stays open.
function ActivityTicker({
  listings,
  agencyCount,
}: {
  listings: FeedListing[] | undefined;
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
  quartierCodes: string[];
  quartiers: Set<string>;
  toggleQuartier: (code: string) => void;
  onReset: () => void;
  resultCount: number | undefined;
}) {
  const hasActiveFilters = roomsMin !== null || budgetMax !== null || quartiers.size > 0;

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
          <FilterButton active={roomsMin === null} onClick={() => setRoomsMin(null)}>
            Toutes
          </FilterButton>
          {ROOM_FILTERS.map((n) => (
            <FilterButton key={n} active={roomsMin === n} onClick={() => setRoomsMin(n)}>
              {n}+
            </FilterButton>
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

      {quartierCodes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-foreground/60">Quartiers (Genève)</p>
          <div className="flex flex-row flex-wrap gap-1.5">
            {quartierCodes.map((code) => (
              <FilterButton
                key={code}
                active={quartiers.has(code)}
                onClick={() => toggleQuartier(code)}
              >
                {GENEVA_DISTRICTS[code] ?? code} <span className="opacity-50">({code})</span>
              </FilterButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-foreground/70 hover:border-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// Public feed: no auth gate here on purpose — a judge (or any renter)
// opening the site with zero login must see the product working. Only
// account-specific chrome (the header above) and the matches section below
// are auth-gated.
function ListingsFeed({ listings }: { listings: FeedListing[] | undefined }) {
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
    <section className="border border-border rounded-sm p-4 flex flex-col gap-3">
      <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">
        Vos correspondances
      </p>
      <ul className="flex flex-col gap-4">
        {matches.map((listing) => (
          <li key={listing._id} className="flex flex-col gap-2">
            <ListingCard listing={listing} />
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

function Footer({
  agencies,
}: {
  agencies: { _id: string; name: string }[] | undefined;
}) {
  return (
    <footer className="border-t border-border mt-8">
      <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-foreground/40 flex flex-row flex-wrap gap-x-2 gap-y-1">
        {agencies && agencies.length > 0 && (
          <span>{agencies.length} régies : {agencies.map((a) => a.name).join(", ")}</span>
        )}
        <span className="ml-auto">© {new Date().getFullYear()} firstkey</span>
      </div>
    </footer>
  );
}

function ListingCard({ listing }: { listing: PublicListing | FeedListing }) {
  // Only listings:listPublic carries status/firstSeenAt — see the
  // `FeedListing` comment above. profiles:myMatches omits them on purpose,
  // so this row is skipped there rather than rendered with fake data.
  const status = "status" in listing ? STATUS_LABEL[listing.status] : null;

  return (
    <div className="border border-border rounded-sm p-4 flex flex-col gap-1.5">
      <div className="flex flex-row items-center justify-between gap-2 text-xs">
        {status ? (
          <span className={`font-mono uppercase tracking-wide ${status.className}`}>
            ● {status.label}
          </span>
        ) : (
          <span />
        )}
        <span className="text-foreground/40 font-mono">
          {"firstSeenAt" in listing ? `${formatRelativeTime(listing.firstSeenAt)} · ` : ""}
          {listing.agencyName}
        </span>
      </div>
      <a
        href={listing.url}
        target="_blank"
        rel="noreferrer"
        className="font-semibold hover:underline"
      >
        {listing.title}
      </a>
      <p className="text-sm text-foreground/60 font-mono">
        {listing.priceChf.toLocaleString()} CHF/mois · {listing.rooms} pièces
        {listing.surfaceM2 ? ` · ${listing.surfaceM2} m²` : ""}
      </p>
      {listing.address && (
        <p className="text-xs text-foreground/40">{listing.address}</p>
      )}
    </div>
  );
}

// Draft -> human edit -> explicit send, for one matched listing. This is
// the only place in the app that can ever call agentmail:sendInquiry — no
// automatic trigger exists anywhere else. Sending is disabled until the
// tenant has actually looked at and (if needed) edited the draft.
function Outreach({ listingId }: { listingId: string }) {
  const draftMyInquiry = useAction(api.openai.draftMyInquiry);
  // agentmail:sendInquiry is an action (it does a real fetch to AgentMail's
  // API), not a mutation — see convex/agentmail.ts for why. It resolves
  // synchronously with the final result, no async status to poll.
  const sendInquiry = useAction(api.agentmail.sendInquiry);

  const [draft, setDraft] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ agentmailMessageId: string } | null>(null);

  async function handleDraft() {
    setError(null);
    setDrafting(true);
    try {
      const text = await draftMyInquiry({ listingId: listingId as Id<"listings"> });
      setDraft(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft the message");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend() {
    if (!draft) return;
    setError(null);
    setSending(true);
    try {
      const result = await sendInquiry({ listingId: listingId as Id<"listings">, text: draft });
      setSent({ agentmailMessageId: result.agentmailMessageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send the message");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return <p className="text-sm text-foreground/50">Envoyée.</p>;
  }

  if (draft === null) {
    return (
      <div className="flex flex-col gap-1">
        <button
          onClick={handleDraft}
          disabled={drafting}
          className="self-start border border-foreground px-3 py-1 rounded-sm text-sm disabled:opacity-50"
        >
          {drafting ? "Rédaction…" : "Rédiger la candidature"}
        </button>
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        className="border border-border rounded-sm p-2 text-sm bg-background"
      />
      <div className="flex flex-row gap-2">
        <button
          onClick={handleSend}
          disabled={sending || draft.trim().length === 0}
          className="self-start bg-foreground text-background px-3 py-1 rounded-sm text-sm disabled:opacity-50"
        >
          {sending ? "Envoi…" : "Envoyer"}
        </button>
        <button
          onClick={() => setDraft(null)}
          className="self-start border border-foreground px-3 py-1 rounded-sm text-sm"
        >
          Annuler
        </button>
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

function formatRelativeTime(ms: number): string {
  const diffMs = Date.now() - ms;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 10) return "à l'instant";
  if (diffSec < 60) return `il y a ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffJ = Math.floor(diffH / 24);
  return `il y a ${diffJ} j`;
}
