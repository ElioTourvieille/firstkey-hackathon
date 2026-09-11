// Shared by every screen that shows a "live" timestamp (feed activity
// strip, listing cards, agency sync panel, matches list) — one relative-
// time formatter instead of one per file.
export function formatRelativeTime(ms: number): string {
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
