// Pure predicate shared between convex/matching.ts (writes listings.status)
// and convex/profiles.ts (reads a profile's own matches) — keeps the two in
// sync by construction instead of duplicating the formula.
//
// Formula confirmed for the hackathon MVP: price and room count only, same
// market. No moveInDate filter (would need a listing-availability field
// that doesn't exist yet — deliberately out of scope for now).
export function isMatch(
  profile: { budgetMax: number; roomsMin: number },
  listing: { priceChf: number; rooms: number },
): boolean {
  return listing.priceChf <= profile.budgetMax && listing.rooms >= profile.roomsMin;
}
