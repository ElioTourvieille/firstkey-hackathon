// Shared by app/matches/page.tsx and app/messenger/page.tsx — the real
// inquiries.status enum ("sent" | "replied" | "closed"), never an
// invented status like the design mockups' "en attente décision bailleur"
// or "dossier complet (100%)".
export type InquiryStatus = "sent" | "replied" | "closed";

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, { label: string; className: string }> = {
  sent: { label: "Candidature envoyée", className: "text-status-pending" },
  replied: { label: "Réponse reçue", className: "text-accent" },
  closed: { label: "Fermée", className: "text-foreground/40" },
};
