"use client";

import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AuthGate from "@/components/AuthGate";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ListingCard from "@/components/ListingCard";
import { formatRelativeTime } from "@/lib/format";
import { INQUIRY_STATUS_LABEL } from "@/lib/inquiry-status";

// Shape of myInquiries' nested `listing` — always carries firstSeenAt,
// unlike ListingCard's looser PublicListing | FeedListing prop type.
type InquiryListing = {
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

export default function MessengerPage() {
  return (
    <AuthGate>
      <MessengerView />
    </AuthGate>
  );
}

function MessengerView() {
  const inquiries = useQuery(api.agentmail.myInquiries);
  const agencies = useQuery(api.agencies.listPublic);
  const [selected, setSelected] = useState<string | null>(null);

  const activeId = selected ?? inquiries?.[0]?._id ?? null;
  const active = inquiries?.find((i) => i._id === activeId) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header active="Messagerie régies" />
      <main className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
        <div>
          <p className="text-xs tracking-wide text-foreground/50 uppercase font-mono">
            Genève · Ligne directe régies
          </p>
          <h1 className="text-3xl font-semibold mt-1">Messagerie régies</h1>
          <p className="text-foreground/60 mt-1 max-w-2xl">
            Vos échanges réels avec les régies contactées — réponses reçues en direct.
          </p>
        </div>

        {inquiries === undefined ? (
          <p className="text-foreground/50">Chargement…</p>
        ) : inquiries.length === 0 ? (
          <p className="text-foreground/50">
            Aucune candidature envoyée pour l&apos;instant.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
            <ul className="flex flex-col gap-2">
              {inquiries.map((inquiry) => {
                const status = INQUIRY_STATUS_LABEL[inquiry.status];
                const isActive = inquiry._id === activeId;
                return (
                  <li key={inquiry._id}>
                    <button
                      onClick={() => setSelected(inquiry._id)}
                      className={`w-full text-left border rounded-sm p-3 flex flex-col gap-1.5 transition-colors ${
                        isActive
                          ? "border-foreground bg-foreground/5"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      <div className="flex flex-row items-center justify-between gap-2 text-xs">
                        <span className={`font-mono uppercase tracking-wide ${status.className}`}>
                          ● {status.label}
                        </span>
                        <span className="text-foreground/40 font-mono">
                          {formatRelativeTime(inquiry.sentAt)}
                        </span>
                      </div>
                      <p className="font-semibold text-sm truncate">
                        {inquiry.listing.agencyName}
                      </p>
                      <p className="text-xs text-foreground/60 truncate">{inquiry.listing.title}</p>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="border border-border rounded-sm p-4">
              {active && <ThreadPanel inquiryId={active._id} listing={active.listing} />}
            </div>
          </div>
        )}
      </main>
      <Footer agencies={agencies} />
    </div>
  );
}

function ThreadPanel({
  inquiryId,
  listing,
}: {
  inquiryId: string;
  listing: InquiryListing;
}) {
  const thread = useQuery(api.agentmail.myThread, { inquiryId: inquiryId as Id<"inquiries"> });
  const replyToInquiry = useAction(api.agentmail.replyToInquiry);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reply against the latest inbound message — AgentMail's reply endpoint
  // needs a real message_id to attach to, and there's no message from the
  // agency to reply to until they've actually written back.
  const lastInboundMessageId = useMemo(() => {
    if (!thread) return null;
    for (let i = thread.length - 1; i >= 0; i--) {
      const entry = thread[i];
      if (entry.kind === "inbound" && entry.messageId) return entry.messageId;
    }
    return null;
  }, [thread]);

  async function handleSend() {
    if (!lastInboundMessageId || draft.trim().length === 0) return;
    setError(null);
    setSending(true);
    try {
      await replyToInquiry({
        inquiryId: inquiryId as Id<"inquiries">,
        inReplyToMessageId: lastInboundMessageId,
        text: draft,
      });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ListingCard listing={listing} firstSeenAt={listing.firstSeenAt} />

      <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
        {thread === undefined ? (
          <p className="text-sm text-foreground/50">Chargement du fil…</p>
        ) : thread.length === 0 ? (
          <p className="text-sm text-foreground/50">Aucun message pour l&apos;instant.</p>
        ) : (
          thread.map((entry, i) => (
            <div
              key={i}
              className={`rounded-sm p-3 text-sm max-w-[85%] ${
                entry.kind === "outbound"
                  ? "self-end bg-foreground text-background"
                  : "self-start border border-border"
              }`}
            >
              <p className="text-xs opacity-60 font-mono mb-1">
                {entry.kind === "outbound" ? "Vous" : entry.from ?? listing.agencyName} ·{" "}
                {formatRelativeTime(entry.timestamp)}
              </p>
              <p className="whitespace-pre-wrap">{entry.text}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {lastInboundMessageId ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Répondre à la régie…"
              className="border border-border rounded-sm p-2 text-sm bg-background"
            />
            <button
              onClick={handleSend}
              disabled={sending || draft.trim().length === 0}
              className="self-start bg-foreground text-background px-4 py-2 rounded-sm text-sm disabled:opacity-50"
            >
              {sending ? "Envoi…" : "Envoyer"}
            </button>
            {error && <p className="text-sm text-accent">{error}</p>}
          </>
        ) : (
          <p className="text-sm text-foreground/50">
            En attente d&apos;une réponse de la régie avant de pouvoir répondre.
          </p>
        )}
      </div>
    </div>
  );
}
