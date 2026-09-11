"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Draft -> human edit -> explicit send, for one matched listing. This is
// the only place in the app that can ever call agentmail:sendInquiry — no
// automatic trigger exists anywhere else. Sending is disabled until the
// tenant has actually looked at and (if needed) edited the draft. Shared by
// the public feed's inline "Vos correspondances" summary and the dedicated
// /matches page — same component, same rules, wherever it's rendered.
export default function Outreach({ listingId }: { listingId: string }) {
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
