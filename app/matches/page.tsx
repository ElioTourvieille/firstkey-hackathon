"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import AuthGate from "@/components/AuthGate";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ListingCard from "@/components/ListingCard";
import Outreach from "@/components/Outreach";
import { formatRelativeTime } from "@/lib/format";

type PendingListing = {
  _id: string;
  title: string;
  url: string;
  priceChf: number;
  rooms: number;
  surfaceM2?: number;
  address?: string;
  firstSeenAt: number;
  agencyName: string;
};

type SentInquiry = {
  _id: string;
  status: "sent" | "replied" | "closed";
  sentAt: number;
  listing: PendingListing;
};

type Item =
  | { kind: "pending"; key: string; ts: number; listing: PendingListing }
  | { kind: "sent"; key: string; ts: number; inquiry: SentInquiry };

const INQUIRY_STATUS_LABEL: Record<SentInquiry["status"], { label: string; className: string }> = {
  sent: { label: "Candidature envoyée", className: "text-status-pending" },
  replied: { label: "Réponse reçue", className: "text-accent" },
  closed: { label: "Fermée", className: "text-foreground/40" },
};

export default function MatchesPage() {
  return (
    <AuthGate>
      <MatchesView />
    </AuthGate>
  );
}

function MatchesView() {
  const profile = useQuery(api.profiles.myProfile);
  const matches = useQuery(api.profiles.myMatches);
  const inquiries = useQuery(api.agentmail.myInquiries);
  const agencies = useQuery(api.agencies.listPublic);

  const [selected, setSelected] = useState<string | null>(null);

  const items: Item[] = useMemo(() => {
    if (!matches || !inquiries) return [];
    const pending: Item[] = matches.map((listing) => ({
      kind: "pending",
      key: `pending:${listing._id}`,
      ts: listing.firstSeenAt,
      listing,
    }));
    const sent: Item[] = inquiries.map((inquiry) => ({
      kind: "sent",
      key: `sent:${inquiry._id}`,
      ts: inquiry.sentAt,
      inquiry,
    }));
    return [...pending, ...sent].sort((a, b) => b.ts - a.ts);
  }, [matches, inquiries]);

  // No effect needed to "select the first item": derived directly from the
  // current list at render time, and naturally follows along if the list
  // changes (e.g. right after a send moves an item from pending to sent).
  const activeKey = selected ?? items[0]?.key ?? null;
  const activeItem = items.find((item) => item.key === activeKey) ?? null;

  const loading = matches === undefined || inquiries === undefined;
  const pendingCount = matches?.length ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header active="Mes correspondances" />
      <main className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
        <div>
          <p className="text-xs tracking-wide text-foreground/50 uppercase font-mono">
            Genève · {profile ? "Profil enregistré" : "Profil non créé"}
          </p>
          <h1 className="text-3xl font-semibold mt-1">Mes correspondances</h1>
          <p className="text-foreground/60 mt-1 max-w-2xl">
            {pendingCount > 0
              ? `${pendingCount} correspondance${pendingCount === 1 ? "" : "s"} en attente d'envoi.`
              : "Aucune correspondance en attente pour l'instant."}
          </p>
        </div>

        {!profile && !loading && (
          <p className="text-sm text-foreground/60 border border-border rounded-sm p-4">
            Aucun profil enregistré —{" "}
            <Link href="/profile" className="text-accent hover:underline">
              créez votre profil de recherche
            </Link>{" "}
            pour commencer à recevoir des correspondances.
          </p>
        )}

        {loading ? (
          <p className="text-foreground/50">Chargement…</p>
        ) : items.length === 0 ? (
          profile && (
            <p className="text-foreground/50">
              Aucune correspondance pour l&apos;instant — revenez après le prochain crawl.
            </p>
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <MatchListRow
                  key={item.key}
                  item={item}
                  active={item.key === activeKey}
                  onSelect={() => setSelected(item.key)}
                  profile={profile ?? null}
                />
              ))}
            </ul>

            <div className="border border-border rounded-sm p-4">
              {activeItem?.kind === "pending" && (
                <div className="flex flex-col gap-3">
                  <ListingCard listing={activeItem.listing} firstSeenAt={activeItem.listing.firstSeenAt} />
                  <Outreach listingId={activeItem.listing._id} />
                </div>
              )}
              {activeItem?.kind === "sent" && (
                <div className="flex flex-col gap-3">
                  <ListingCard
                    listing={activeItem.inquiry.listing}
                    firstSeenAt={activeItem.inquiry.listing.firstSeenAt}
                  />
                  <p
                    className={`text-sm font-mono ${INQUIRY_STATUS_LABEL[activeItem.inquiry.status].className}`}
                  >
                    {INQUIRY_STATUS_LABEL[activeItem.inquiry.status].label} ·{" "}
                    {formatRelativeTime(activeItem.inquiry.sentAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer agencies={agencies} />
    </div>
  );
}

function MatchListRow({
  item,
  active,
  onSelect,
  profile,
}: {
  item: Item;
  active: boolean;
  onSelect: () => void;
  profile: Doc<"profiles"> | null;
}) {
  const listing = item.kind === "pending" ? item.listing : item.inquiry.listing;
  const statusLabel =
    item.kind === "pending"
      ? { label: "Nouveau match", className: "text-status-new" }
      : INQUIRY_STATUS_LABEL[item.inquiry.status];

  const budgetTag = profile && profile.budgetMax > 0 && listing.priceChf <= profile.budgetMax
    ? Math.round((1 - listing.priceChf / profile.budgetMax) * 100)
    : null;

  const quartierMatch = listing.address?.match(/\b(12\d{2})\b/);
  const hasQuartierTag =
    !!quartierMatch && !!profile?.quartiers?.includes(quartierMatch[1]);

  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full text-left border rounded-sm p-3 flex flex-col gap-1.5 transition-colors ${
          active ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/40"
        }`}
      >
        <div className="flex flex-row items-center justify-between gap-2 text-xs">
          <span className={`font-mono uppercase tracking-wide ${statusLabel.className}`}>
            ● {statusLabel.label}
          </span>
          <span className="text-foreground/40 font-mono">
            {formatRelativeTime(item.ts)}
          </span>
        </div>
        <p className="font-semibold text-sm truncate">{listing.title}</p>
        <p className="text-xs text-foreground/60 font-mono">
          {listing.priceChf.toLocaleString()} CHF/mois · {listing.rooms} pièces · {listing.agencyName}
        </p>
        {(budgetTag !== null && budgetTag > 0) || hasQuartierTag ? (
          <div className="flex flex-row flex-wrap gap-1">
            {budgetTag !== null && budgetTag > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-status-new text-status-new">
                Budget -{budgetTag}% vs max
              </span>
            )}
            {hasQuartierTag && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-border text-foreground/60">
                Quartier prioritaire
              </span>
            )}
          </div>
        ) : null}
      </button>
    </li>
  );
}
