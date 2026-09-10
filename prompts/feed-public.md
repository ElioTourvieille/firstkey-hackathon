# Prompt d'implémentation — refonte visuelle du flux public

> Remplace la version précédente de ce prompt ("rendre le feed public"), qui est faite —
> voir `hackathon.md` (`e30fe46`, déployé en prod). Ce prompt-ci couvre l'étape suivante :
> appliquer le design system validé au flux public déjà en ligne.

## Objectif

Appliquer la direction visuelle Swiss-Style validée (`design/design-system.md`,
`design/publicFeed.png`) à `app/page.tsx`. Le feed est déjà public et fonctionnel
(query `listings.listPublic`) — il s'agit d'une refonte visuelle, pas d'un changement
de logique d'accès. Aucun nouveau champ de donnée sensible ne doit être exposé.

## Référence visuelle

`design/publicFeed.png` + `design/design-system.md` (palette, typo, layout, "Règle non
négociable : aucun chiffre ou badge inventé"). La maquette a été produite avant d'être
confrontée au schéma Convex réel et contient plusieurs éléments sans donnée réelle
derrière — la règle du design-system s'applique strictement : on les omet, on ne les
simule pas. Décisions validées avec le porteur du projet le 2026-09-10 :

- **Nav à 4 onglets, 3 désactivés** : Flux public / Mes correspondances / Messagerie
  régies / Mon profil sont tous visibles (fidèles à la maquette), mais seul "Flux
  public" est cliquable — les trois autres sont visuellement grisés/`disabled` en
  attendant leurs propres prompts (aucune route `/profile` ni `/inbox` n'existe encore).
- **Pas de photo sur les cartes d'annonce** : aucun champ image dans `listings`,
  Firecrawl n'en extrait pas. Cartes 100% texte, redessinées avec les tokens du design
  system — pas de bloc graphique de substitution non plus, pour rester au plus simple.
- **Light-only** : le `@media (prefers-color-scheme: dark)` générique actuel
  (`app/globals.css`) est retiré. Le design system ne définit qu'une palette claire ;
  pas de variante sombre tant qu'elle n'est pas explicitement maquettée.

## Fichiers inspectés / skills lus

- `design/design-system.md`, `design/publicFeed.png`
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css` (implémentation et thème actuels)
- `convex/schema.ts`, `convex/listings.ts`, `convex/agencies.ts` (donnée réellement
  disponible)
- `clerk-static-export-firstkey` (chrome auth existant, à ne pas casser)

## Mapping maquette → donnée réelle

| Élément de la maquette | Source réelle | Traitement |
|---|---|---|
| Titre, prix, pièces, surface, adresse, régie | `listings.listPublic` (déjà exposé) | Repris tel quel, restylé |
| Badge "NOUVEAU" / statut | `listing.status` (`new`/`matched`/`contacted`/`replied`) | Repris avec le vocabulaire réel du statut — pas "SCAN RÉGIE VALIDÉ" ni "FORTE DEMANDE", qui n'existent pas comme statuts |
| "à l'instant" / "il y a 2 min" | `listing.firstSeenAt` | Repris, calcul de temps relatif côté client |
| Bandeau "nouvelle annonce indexée il y a 48s (Naef, Champel)" | annonce la plus récente de `listPublic` | Repris (agence + adresse + temps relatif réels) |
| "FLUX RÉSEAU: 0.8s", latence ping, "100% opérationnel" | — | **Supprimé**, aucune métrique de ce type n'existe |
| Encart "Surveillance des régies" (compte à rebours par régie, ping) | — | **Supprimé** tel quel |
| … remplacé par : liste des régies + dernière synchro | `agencies.lastCrawledAt` (réel, mais pas exposé publiquement aujourd'hui) | **Nouvelle query publique** `agencies.listPublic` — noms + `lastCrawledAt`, jamais `contactEmail` (conforme à la règle de CLAUDE.md) |
| "6 Régies surveillées" | `count(agencies.listPublic)` | Repris, calculé, jamais codé en dur |
| "Réf: NA-8841-CH" | — | **Supprimé**, aucun code de référence stocké |
| Tags d'aménités ("Cuisine équipée", "Cave incluse", "Terrasse", étage, ascenseur…) | — | **Supprimés**, aucun champ de ce type dans `listings` |
| Photo par annonce | — | **Supprimée** (voir décision ci-dessus) |
| Filtres "Nombre de pièces minimal" / "Loyer mensuel maximal" | `listing.rooms` / `listing.priceChf` déjà chargés | Repris comme **filtre client pur** sur les listings déjà reçus — aucun nouvel appel serveur |
| Filtre "Surface minimale" | `listing.surfaceM2` déjà chargé | **Ajouté après coup** (pas dans la maquette initiale) — même filtre client pur. Contrairement au matching de `convex/lib/matching.ts` (permissif sur donnée manquante), ici une annonce sans `surfaceM2` connu est **masquée** dès que le filtre est actif : c'est un filtre explicite et instantanément réinitialisable, pas une règle de fond silencieuse |
| Filtre "Quartiers de Genève" (checkboxes par code postal) | `listing.address` (texte libre optionnel) | Repris en best-effort (correspondance de sous-chaîne sur l'adresse, ex. "1206"/"Champel") — approximatif mais réel, pas de liste de quartiers inventée en dur au-delà de ce qui apparaît réellement dans les adresses chargées |
| "Camille V." / "Dossier prêt (100%)" | — | **Supprimé** de ce prompt — hors périmètre (page profil pas encore construite) ; le chrome auth reste `UserButton`/`SignIn`/`SignUp` existant |
| Encart "Créer mon profil de recherche" / "Déjà un dossier ? Se connecter" | `Authenticated`/`Unauthenticated` (Clerk) | Repris, restylé, logique inchangée |
| "Aucun frais de dossier n'est demandé aux candidats" | — (texte éditorial, pas une donnée) | **À confirmer explicitement avant merge** : c'est un engagement produit public, pas juste un habillage visuel — le garder seulement si c'est vrai et assumé |

## Fichiers à créer/modifier

- `convex/agencies.ts` — ajouter `listPublic` (`query` publique) : retourne
  `{ _id, name, lastCrawledAt }[]`, jamais `contactEmail`, jamais `listingsUrl` (évite
  d'exposer la page source exacte à scraper par un tiers).
- `app/page.tsx` — restructuration complète du rendu (nav à 4 onglets, bandeau
  d'activité, grille annonces + rail latéral filtres/régies, encart profil), en gardant
  intacte la logique existante (`Authenticated`/`Unauthenticated`, `listPublic`,
  `myMatches`, `Outreach`) — c'est une passe de layout/style, pas une réécriture des
  hooks de données.
- `app/globals.css` — remplacer les tokens `--background`/`--foreground` par la palette
  `design/design-system.md` ; retirer le bloc `@media (prefers-color-scheme: dark)`.
- `app/layout.tsx` — pas de changement de police a priori (Geist Sans/Mono couvre déjà
  "grotesque sans + mono pour les données tabulaires" du design system) — à confirmer en
  posant la maquette et le rendu Geist côte à côte avant de basculer sur Inter.

## Critères d'acceptation

- `convex.site` sans connexion affiche le flux restylé, données 100% réelles, aucun
  chiffre/badge/photo qui n'existe pas en base.
- Les 3 onglets désactivés ne naviguent nulle part (pas de lien mort, pas de 404).
- Les filtres pièces/loyer/quartier ne déclenchent aucune requête réseau supplémentaire
  (filtrage client sur les listings déjà reçus).
- `agencies.listPublic` ne retourne jamais `contactEmail` ni `listingsUrl` — vérifié à
  l'œil dans la réponse réseau, pas seulement dans le validator de retour.
- Un utilisateur connecté voit toujours son bloc "Vos correspondances" (`myMatches`,
  inchangé) et son `UserButton`.
- `npm run typecheck && npm run lint && npm run build` passent.

## Comment tester

- `pnpm dev`, navigation privée (pas de session Clerk) : le flux doit ressembler à
  `design/publicFeed.png` moins les éléments listés "Supprimé" ci-dessus.
- Réduire la fenêtre : vérifier que le rail latéral (filtres + régies) ne casse pas en
  dessous d'une largeur desktop raisonnable — pas de maquette mobile fournie, donc pas
  d'exigence de responsive fin, juste "ne casse pas".
- Vérifier dans l'onglet réseau du navigateur la réponse de `agencies.listPublic` :
  aucun `contactEmail`/`listingsUrl`.
- Re-crawler une régie (`npx convex run firecrawl:...` en dev) pendant que la page est
  ouverte : le bandeau d'activité et la liste doivent se mettre à jour sans reload
  (query réactive Convex) — c'est le seul vrai signal "live" de cet écran.

---
*Ne pas exécuter avant validation explicite de ce plan par l'utilisateur.*
