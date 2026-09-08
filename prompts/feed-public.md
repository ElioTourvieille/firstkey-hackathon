# Prompt d'implémentation — rendre le feed d'annonces public

## Objectif

Corriger `app/page.tsx` pour respecter la contrainte de jugement du hackathon : le feed d'annonces doit être visible sans connexion. Actuellement, un visiteur non connecté ne voit que des boutons sign-in/sign-up — rien du produit.

## Fichiers inspectés / skills lus

- `clerk-static-export-firstkey` (contrainte de jugement + pattern `AuthGate`)
- `app/page.tsx`, `components/AuthGate.tsx` (code actuel)

## Hypothèses prises

- Le feed peut se contenter d'une query publique simple sur `listings` (ex : les N plus récents, tous marchés confondus ou filtrés sur Genève) — pas besoin du matching pour cette correction, qui est un problème distinct (voir `matching-listing-profil.md`).
- La création de profil et l'inbox restent derrière `<SignedIn>`/`AuthGate` — seule la lecture du feed devient publique.
- Pas besoin de créer une nouvelle route : la page d'accueil suffit pour la démo.

## Fichiers à créer/modifier

- `convex/listings.ts` — ajouter une `query` **publique** (pas `internalQuery`) qui retourne une liste de listings sans aucune donnée sensible (elle ne touche pas `agencies.contactEmail`, donc pas de risque de fuite ici).
- `app/page.tsx` — sortir l'affichage du feed du bloc `<Authenticated>`/`<Unauthenticated>` ; ne garder ce bloc que pour un lien "Créer mon profil" / bouton de connexion, affiché en plus du feed, pas à sa place.

## Critères d'acceptation

- Ouvrir l'URL `convex.site` sans être connecté affiche une liste de listings réels (pas un écran de login).
- Un utilisateur connecté voit le même feed, plus l'accès à son profil.
- `npm run build` passe.

## Comment tester

- `pnpm dev`, ouvrir en navigation privée (pas de session Clerk), vérifier que le feed s'affiche.
- Vérifier dans la query publique qu'aucun champ `agencies.contactEmail` ne transite, même indirectement (pas de join qui l'exposerait).

---
*Ne pas exécuter avant validation explicite de ce plan par l'utilisateur.*
