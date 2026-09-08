# Prompt d'implémentation — matching listing ↔ profil

## Objectif

Construire `convex/matching.ts` : dès qu'un listing est inséré ou mis à jour, le comparer aux profils actifs du même marché et faire passer son `status` à `"matched"` s'il correspond. C'est le cœur de la proposition de valeur et il est actuellement absent du code.

## Fichiers inspectés / skills lus

- `matching-outreach-firstkey` (flux décidé dans la stratégie du hackathon)
- `convex/schema.ts`, `convex/listings.ts` (code actuel)

## Questions à trancher avant d'exécuter (voir `matching-outreach-firstkey`)

1. Confirmer la formule : `priceChf <= budgetMax` **et** `rooms >= roomsMin`, sur le même `marketId` — c'est l'interprétation la plus probable de l'architecture ("compare aux profils actifs du même marché"), jamais confirmée mot pour mot.
2. `moveInDate` doit-il filtrer aussi ? Si oui, il manque un champ de disponibilité sur `listings` — à ajouter au schéma avant de coder cette partie, pas après.

## Hypothèses prises (à valider avec les réponses ci-dessus)

- Le matching se déclenche depuis `listings:upsertBatch` (à chaque upsert, pas seulement à l'insertion) — un listing qui change de prix peut redevenir ou cesser d'être un match.
- Un listing peut matcher plusieurs profils ; `status: "matched"` reste un champ simple sur `listings` (pas une relation many-to-many pour l'instant) — recommandation : matcher/lier via `inquiries` plus tard porte la relation réelle, `listings.status` reste un indicateur global "au moins un profil matché".
- Pas d'envoi automatique déclenché par le matching — ça reste dans le scope de `openai.ts`/`agentmail.ts` (features séparées, voir skill `matching-outreach-firstkey`), le déclenchement doit se faire manuellement.

## Fichiers à créer/modifier

- `convex/matching.ts` — `internalMutation matchNewListing(listingId)`, appelée depuis `listings:upsertBatch` après chaque insert/update.
- `convex/listings.ts` — appeler `matching.matchNewListing` après upsert (via `ctx.runMutation` ou en important directement si même fichier de mutation le permet).
- Une query publique ou authentifiée (`profiles:matchesForCurrentProfile` ou équivalent) pour que le profil connecté voie ses matches — nécessaire pour démontrer la feature, pas seulement l'écrire en base.

## Critères d'acceptation

- Un listing dont le prix/pièces correspond à un profil seedé passe bien à `status: "matched"` après un crawl ou un seed manuel.
- Un profil connecté voit la liste de ses listings matchés.
- `npm run build` passe.

## Comment tester

- Seed au moins 2 profils avec des critères différents et 5+ listings couvrant les cas limites (budget pile à la limite, rooms insuffisant, mauvais market) via `convex/seed.ts`.
- Vérifier qu'un utilisateur sans `profile` ne casse pas la query (retour vide, pas d'erreur).

---
*Ne pas exécuter avant d'avoir les réponses aux deux questions ci-dessus et la validation explicite du plan.*
