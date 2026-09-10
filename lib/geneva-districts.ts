// Public postal-code → district name lookup for Geneva canton (1200-1299).
// Real, public geography — not product data. Used in two places:
// - app/page.tsx: labels for quartiers that actually appear in loaded
//   listing addresses (the filter only ever offers codes present in real
//   data — see that file's `quartierCodes`).
// - app/profile/page.tsx: the fixed set of choices for a renter's
//   "secteurs prioritaires" preference (a preference isn't derived from
//   already-loaded listings the way a filter is, so the full list applies).
export const GENEVA_DISTRICTS: Record<string, string> = {
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
