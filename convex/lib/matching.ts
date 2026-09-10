// Pure predicate shared between convex/matching.ts (writes listings.status)
// and convex/profiles.ts (reads a profile's own matches) — keeps the two in
// sync by construction instead of duplicating the formula.
//
// Formula confirmed for the hackathon MVP: price, room count, surface and
// quartier, same market. No moveInDate filter (would need a
// listing-availability field that doesn't exist yet — deliberately out of
// scope for now).
//
// surfaceMin and quartiers are permissive on missing listing data: a
// listing Firecrawl couldn't extract a surface or address for is never
// excluded just because we can't verify it — see prompts/profile.md for why
// this differs from the public feed's own surface/quartier filters (those
// are explicit, instantly-resettable UI choices; this predicate silently
// drives listings.status for every renter, so a false negative there is
// much more costly than in a UI filter).
export function isMatch(
  profile: {
    budgetMax: number;
    roomsMin: number;
    surfaceMin?: number;
    quartiers?: string[];
  },
  listing: { priceChf: number; rooms: number; surfaceM2?: number; address?: string },
): boolean {
  if (listing.priceChf > profile.budgetMax) return false;
  if (listing.rooms < profile.roomsMin) return false;

  if (
    profile.surfaceMin !== undefined &&
    listing.surfaceM2 !== undefined &&
    listing.surfaceM2 < profile.surfaceMin
  ) {
    return false;
  }

  if (profile.quartiers && profile.quartiers.length > 0) {
    const match = listing.address?.match(/\b(12\d{2})\b/);
    if (match && !profile.quartiers.includes(match[1])) return false;
  }

  return true;
}
