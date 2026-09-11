import { formatRelativeTime } from "@/lib/format";

export type PublicListing = {
  _id: string;
  title: string;
  url: string;
  priceChf: number;
  rooms: number;
  surfaceM2?: number;
  address?: string;
  agencyName: string;
};

// listings:listPublic returns status too; profiles:myMatches and
// agentmail:myInquiries (both narrower, identity-scoped validators) don't —
// a match's status is implied by which list it's in at all. ListingCard
// renders the status row only when it's present.
export type FeedListing = PublicListing & {
  status: "new" | "matched" | "contacted" | "replied";
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  new: { label: "Nouveau", className: "text-status-new" },
  matched: { label: "Correspond à un profil", className: "text-status-new" },
  contacted: { label: "En attente de réponse", className: "text-status-pending" },
  replied: { label: "Réponse reçue", className: "text-accent" },
};

export default function ListingCard({
  listing,
  firstSeenAt,
}: {
  listing: PublicListing | FeedListing;
  // Separate from `listing` because the two queries that carry a real
  // timestamp for a listing (listings:listPublic's firstSeenAt,
  // profiles:myMatches' firstSeenAt) mean different things — "first
  // crawled" either way, but callers pass it explicitly rather than the
  // component guessing which field name to look for.
  firstSeenAt?: number;
}) {
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
          {firstSeenAt !== undefined ? `${formatRelativeTime(firstSeenAt)} · ` : ""}
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
      {listing.address && <p className="text-xs text-foreground/40">{listing.address}</p>}
    </div>
  );
}
