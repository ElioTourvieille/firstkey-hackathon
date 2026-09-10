# Prompt d'implémentation — page "Mon profil"

## Objectif

Créer la page `/profile` (route Next.js dédiée, inexistante à ce jour — le flow
profil vit encore uniquement dans `seed.ts`, aucun utilisateur ne peut créer son
propre profil aujourd'hui) en appliquant `design/profile.png`. Active le 3ᵉ onglet
de nav ("Mon profil"), aujourd'hui désactivé sur le flux public.

Écart de départ important à noter : **aucune mutation publique de création/édition
de profil n'existe**. `convex/profiles.ts` n'a que `get`/`getByUserId` (internes) et
`myMatches`. C'est le vrai cœur de ce prompt, pas juste l'écran.

## Référence visuelle

`design/profile.png` + `design/design-system.md`. Décisions validées avec le
porteur du projet le 2026-09-10 :

- **Bloc "Solvabilité déclarée" (emploi, salaire, taux d'effort) : supprimé.**
  Donnée financière sensible, hors périmètre du matching actuel, aucune décision
  produit prise dessus. Pas de champ à ajouter.
- **Bloc "Documents du dossier" (upload pièces) : supprimé.** Nécessiterait Convex
  file storage + un nouveau modèle de données pour des documents d'identité — une
  feature à part entière, pas une case à cocher dans ce prompt.
- **"Secteurs prioritaires" + "Surface minimale" : ajoutés**, avec mise à jour du
  matching (`convex/lib/matching.ts`) — voir section schéma ci-dessous. C'est un
  changement de schéma et de logique de matching centrale, validé explicitement.

## Mapping maquette → donnée réelle

| Élément de la maquette | Source réelle | Traitement |
|---|---|---|
| "Camille V." + photo de profil | `useUser()` de Clerk (`user.fullName`, `user.imageUrl`) | **Repris** — donnée réelle Clerk, pas fabriquée |
| "6 régies genevoises" (pill nav) | `agencies.listPublic` (déjà ajouté) | Repris, calculé |
| "REF. GVA-88219" | — | **Supprimé**, aucun code de dossier stocké |
| "Critères enregistrés" | `profiles.myProfile` existe ou non | Repris — reformulé en "Profil enregistré" / "Profil non créé" |
| "Dossier prêt (100%)" | champs requis réellement remplis | Repris, **recalculé** : ratio réel de champs requis (budget, pièces min, pitch) renseignés — pas un score inventé |
| Loyer mensuel maximum (slider) | `profiles.budgetMax` | Repris tel quel |
| "Charges incl." / "CHF TTC" | — | **Supprimé** — on ne sait pas si le prix Firecrawl inclut les charges, ne pas l'affirmer |
| Nombre de pièces minimum (boutons) | `profiles.roomsMin` | Repris, mêmes valeurs que le sélecteur déjà utilisé sur le flux public |
| "Équivalent standard: séjour + 1-2 chambres..." | — | **Supprimé** — habillage, pas nécessaire |
| Surface minimale | **nouveau** `profiles.surfaceMin` (optionnel) | **Ajouté** (voir schéma + matching) |
| Entrée souhaitée | `profiles.moveInDate` (existe déjà, jamais utilisé côté UI) | Repris |
| Secteurs prioritaires (chips quartiers) | **nouveau** `profiles.quartiers` (optionnel, array de codes postaux) | **Ajouté** — liste fixe des codes postaux genevois réels (`GENEVA_DISTRICTS`, à extraire de `app/page.tsx` vers un module partagé), pas dérivée des listings comme sur le feed (ici c'est une préférence, pas un filtre sur des données déjà chargées) |
| Solvabilité déclarée (tout le bloc) | — | **Supprimé** (voir décision ci-dessus) |
| Pitch de présentation (textarea) | `profiles.pitch` (existe déjà) | Repris tel quel |
| "Formulation suisse standard" (baguette IA) | — | **Supprimé** — aucune action OpenAI de ce type n'existe, ne pas suggérer une capacité qui n'existe pas |
| "Variables détectées: [Poste]..." | — | **Supprimé** — aucun système de variables/template n'existe, `pitch` est un texte libre brut |
| Documents du dossier (tout le bloc) | — | **Supprimé** (voir décision ci-dessus) |
| "Tester la génération automatique" | — | **Supprimé pour cette passe** — `openai.draftMyInquiry` exige un `listingId` réel ; pas de mode démo sans annonce. Naturel à ajouter plus tard sur l'écran "Mes correspondances" |
| "Enregistrer et synchroniser la veille" | `profiles.upsertMine` (nouveau) | Repris, **renommé "Enregistrer mon profil"** — le mot "synchroniser" laisse croire à un recalcul déclenché ; en réalité `myMatches` recalcule déjà en direct à chaque lecture, il n'y a rien à "synchroniser" en plus (voir note plus bas) |
| Footer "LATENCE: 1.2s" | — | **Supprimé**, même raison que sur le flux public |
| Footer "6 régies auditées : ..." | `agencies.listPublic` | Repris, réutilise le `Footer` déjà construit sur `app/page.tsx` |

## Schéma — changement validé

```ts
profiles: defineTable({
  userId: v.string(),
  marketId: v.id("markets"),
  budgetMax: v.number(),
  roomsMin: v.number(),
  surfaceMin: v.optional(v.number()),      // nouveau
  quartiers: v.optional(v.array(v.string())), // nouveau — codes postaux genevois, ex. ["1205","1206"]
  moveInDate: v.optional(v.string()),
  pitch: v.string(),
}).index("by_user", ["userId"]),
```

Ajout de champs optionnels : compatible avec les documents `profiles` existants
(dev + prod), aucune migration nécessaire, aucune donnée existante affectée.

## Matching — changement validé (`convex/lib/matching.ts`)

`isMatch` doit intégrer les deux nouveaux critères **en restant permissif face à
une donnée manquante côté annonce** (ne jamais exclure une annonce simplement
parce que Firecrawl n'a pas extrait un champ) :

- `surfaceMin` : si le profil en a un ET que l'annonce a un `surfaceM2` connu →
  `surfaceM2 >= surfaceMin`. Si l'annonce n'a pas de `surfaceM2`, elle **reste
  éligible** (donnée manquante ≠ annonce refusée).
- `quartiers` : si le profil en a au moins un → l'adresse de l'annonce doit
  contenir un des codes postaux sélectionnés (même regex `\b(12\d{2})\b` que le
  filtre du flux public). Si l'annonce n'a pas d'adresse exploitable, elle
  **reste éligible** — même logique de permissivité.

**Limite connue, non traitée par ce prompt** : `listings.status` (le badge
"Nouveau"/"Correspond à un profil" vu sur le flux public) n'est recalculé que
quand une annonce est upsertée (crawl), pas quand un profil est créé/modifié.
Un nouveau profil peut donc "matcher" une annonce existante côté
`profiles.myMatches` (qui recalcule toujours en direct) sans que le badge public
de cette annonce change avant le prochain crawl. C'est déjà le comportement
actuel pour la mise à jour de profil ; pas une régression de ce prompt, mais à
garder en tête si la démo veut montrer un badge qui change à la création d'un
profil.

## Fichiers à créer/modifier

- `convex/schema.ts` — les deux champs optionnels ci-dessus.
- `convex/lib/matching.ts` — `isMatch` étendu comme ci-dessus.
- `convex/profiles.ts` :
  - `myProfile` (nouvelle `query` publique, identity-scoped) — retourne le
    profil du caller ou `null`. Pas de risque de fuite : chacun ne lit que son
    propre doc.
  - `upsertMine` (nouvelle `mutation` publique, identity-scoped) — crée ou met à
    jour le profil du caller (`by_user` index). `marketId` résolu côté serveur
    (`ctx.db.query("markets").first()` — un seul marché "Geneva" existe
    aujourd'hui, pas de sélecteur de marché dans l'UI).
- `app/profile/page.tsx` — nouvelle route, `"use client"`, enveloppée par
  `AuthGate` (voir `clerk-static-export-firstkey`). Formulaire pré-rempli via
  `myProfile`, sauvegarde via `upsertMine`.
- `components/Header.tsx` (extrait de `app/page.tsx`) — la nav à 4 onglets
  existe déjà en dur dans `app/page.tsx` ; l'extraire en composant partagé pour
  que `/profile` ait la même barre, avec "Mon profil" actif au lieu de
  désactivé. `app/page.tsx` importe ce composant au lieu de sa version inline.
- `components/Footer.tsx` (extrait de `app/page.tsx`), même raison.
- `lib/geneva-districts.ts` — extraction de `GENEVA_DISTRICTS` (déjà écrit dans
  `app/page.tsx`) vers un module partagé, importé par le feed **et** par le
  formulaire de profil.

## Critères d'acceptation

- Non connecté, `/profile` redirige vers le sign-in (`AuthGate`) — jamais un
  écran vide ou une erreur.
- Connecté sans profil : formulaire vide, bouton "Enregistrer mon profil" crée
  le premier profil.
- Connecté avec profil existant : formulaire pré-rempli, la sauvegarde modifie
  le même document (pas de doublon dans `profiles`).
- Aucun champ "solvabilité" ni "documents" nulle part dans le code livré.
- `myMatches` continue de fonctionner après le changement de `isMatch` (pas de
  régression sur le matching prix+pièces déjà en place).
- `npm run typecheck && npm run lint && npm run build` passent.

## Comment tester

- Créer un profil avec `surfaceMin` renseigné et vérifier qu'une annonce sans
  `surfaceM2` apparaît quand même dans `myMatches`.
- Créer un profil avec un quartier précis et vérifier qu'une annonce d'un autre
  quartier (adresse avec un autre code postal) disparaît de `myMatches`.
- Modifier un profil existant deux fois de suite, vérifier dans le dashboard
  Convex qu'il n'y a toujours qu'un seul document `profiles` pour cet
  utilisateur.

---
*Ne pas exécuter avant validation explicite de ce plan par l'utilisateur.*
