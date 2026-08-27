// Plain helper module (no Convex functions exported here, so it isn't
// registered as an endpoint) — shared by convex/firecrawl.ts and
// convex/listings.ts.

/**
 * Deterministic, non-cryptographic hash of a listing's canonical detail URL
 * (query string stripped), used to dedup across re-crawls: same listing =>
 * same hash => patch instead of insert.
 *
 * Only the URL goes into the hash — price/rooms come from Firecrawl's LLM
 * extraction and are NOT reliably reproduced between crawls of the exact
 * same page (observed the same listing come back with a different `rooms`
 * value across two consecutive runs), so they can't be part of an identity
 * key.
 */
export function sourceHash(canonicalUrl: string): string {
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < canonicalUrl.length; i++) {
    hash ^= canonicalUrl.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
