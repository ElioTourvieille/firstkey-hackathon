# Prompt d'implémentation — page "Mes correspondances"

## Objectif

Créer une page dédiée `/matches` (2ᵉ onglet de nav, désactivé aujourd'hui)
appliquant `design/myCorrespondence.png` : layout à deux colonnes — liste des
correspondances à gauche, panneau détaillé de rédaction/envoi à droite pour
l'annonce sélectionnée. Décidé avec le porteur du projet le 2026-09-11 :
deux colonnes comme la maquette (pas la liste empilée actuelle), en
réutilisant `myMatches`/`draftMyInquiry`/`sendInquiry` tels quels — rien de
nouveau côté IA/envoi, juste une réorganisation + deux ajouts de lecture.

## ⚠️ Violation de règle repérée dans la maquette — non négociable

Le panneau droit de la maquette affiche en clair
`locations@brolliet.ch` (l'email de contact de la régie) dans un bloc
"DESTINATAIRE RÉGIE". C'est une violation directe de CLAUDE.md :
*"Strictement server-side : ... anything related to `agencies.contactEmail`"*
et *"What the agent must never do: Make `contactEmail` accessible via a
public query."* `agentmail.sendInquiry` résout déjà `agency.contactEmail`
côté serveur sans jamais le renvoyer au client — ce comportement ne change
pas. **Ce bloc est supprimé de l'écran, pas juste caché côté style.** Le nom
de la régie (déjà public) suffit pour dire à qui on écrit.

## Vrai manque découvert en creusant

`profiles.myMatches` exclut déjà les annonces dont `listings.status` vaut
`"contacted"`/`"replied"` (c'est le comportement voulu). Mais **rien
n'expose les candidatures déjà envoyées** — pas de query publique sur
`inquiries`. Résultat concret : dès qu'une candidature part, l'annonce
correspondante disparaît purement et simplement de tout, y compris de cet
écran. Impossible de reproduire la 3ᵉ carte de la maquette ("Candidature
envoyée il y a 2h") sans une nouvelle lecture. D'où l'ajout de
`agentmail.myInquiries` ci-dessous — le vrai cœur de ce prompt, comme
`profiles.upsertMine` l'était pour l'écran profil.

**Limite acceptée pour cette passe** : `inquiries` ne stocke jamais le texte
réellement envoyé (seulement `outboundId`, `agentmailThreadId`, `status`,
`sentAt` — voir `convex/schema.ts`). Le panneau détaillé d'une candidature
déjà envoyée affiche donc régie/annonce/date/statut, **pas** le texte du
courriel. Ajouter un champ `text` à `inquiries` pour permettre ça plus tard
est possible mais hors périmètre ici (encore un changement de schéma à
décider séparément) — pas nécessaire pour un écran fonctionnel.

## Mapping maquette → donnée réelle

| Élément de la maquette | Source réelle | Traitement |
|---|---|---|
| "N correspondances actives" | `myMatches.length` | Repris, **sans** le qualificatif "aujourd'hui" (impliquerait un filtre par date qu'on n'a pas) |
| "Surveillance directe : N régies genevoises" / "Dernier crawl : il y a Xs" | `agencies.listPublic` (count + `max(lastCrawledAt)`) | Repris, réutilise la query déjà publique |
| "Critères de recherche vérifiés" | `profiles.myProfile` existe | Repris, reformulé "Profil enregistré" (même logique que l'écran profil) |
| "INDEX DES OPPORTUNITÉS QUALIFIÉES (3/4)" | — | **Supprimé** — signification ambiguë, pas de donnée claire derrière |
| "Filtres actifs" (bouton) | — | **Supprimé pour cette passe** — la liste est déjà scopée aux vrais matches du profil, peu d'intérêt à la refiltrer |
| Carte "Nouveau match · il y a 3 min" | `myMatches` + `listing.firstSeenAt` (**à ajouter** au validator de retour, absent aujourd'hui) | Repris |
| Photo | — | **Supprimée**, même raison que sur le flux public |
| "RÉGIE BROLLIET · RÉF. BR-88421" | `agencyName` réel, ref fake | Nom repris, **référence supprimée** |
| Adresse + "(Jonction / Bâtie)" | `listing.address` + `GENEVA_DISTRICTS[code]` | Repris — nom de quartier dérivé du code postal réel dans l'adresse |
| "LOYER MENSUEL NET" | `listing.priceChf` | Repris **sans** "NET" — on ne sait pas si charges incluses |
| Tag "Budget -16% vs max" | `listing.priceChf` vs `profile.budgetMax` (les deux déjà dispo via `myMatches`+`myProfile`) | **Ajouté**, calculé côté client, aucun nouvel appel serveur |
| Tag "Quartier prioritaire 1205" | `listing.address` vs `profile.quartiers` | **Ajouté**, calculé côté client, même logique que le matching |
| "Étage 3/5 avec ascenseur" | — | **Supprimé**, aucun champ de ce type |
| Statut "En attente d'envoi" (2ᵉ carte) | — | **Simplifié** — pas de suivi persistant "brouillon généré" ; toutes les correspondances non envoyées s'affichent "Nouveau match", le panneau de droite gère brouillon→édition→envoi comme déjà construit (`Outreach`) |
| "Candidature envoyée il y a 2h" + statut | **nouveau** `agentmail.myInquiries` (`inquiries.sentAt`/`status`) | **Ajouté** — voir section ci-dessus |
| "Accusé reçu" | — | **Supprimé** — aucun système d'accusé de réception |
| "Visite groupée prévue jeudi 16:30" | — | **Supprimé** — aucune feature de planification de visite |
| Panneau détail : titre, annonce | `myMatches`/`myInquiries` | Repris |
| "ID Dispatch: GVA-2025-BR88421" | — | **Supprimé** |
| "DESTINATAIRE RÉGIE" + email | — | **Supprimé, voir avertissement ci-dessus** |
| "RATIO D'EFFORT 25.5%" + CDI + "Extrait OP joint" | — | **Supprimé** — même décision que l'écran profil (bloc solvabilité) |
| "Dossier ... .pdf · Joint au dossier" | — | **Supprimé** — même décision que l'écran profil (upload de documents) |
| Textarea "TEXTE DU COURRIEL GÉNÉRÉ (ÉDITABLE)" | `openai.draftMyInquiry` | Repris tel quel (déjà construit dans `Outreach`) |
| "Optimisé pour régie Brolliet" | — | **Supprimé** — aucune personnalisation par régie n'existe, le prompt OpenAI ne varie pas par destinataire |
| "M'avertir par SMS..." | — | **Supprimé** — aucune intégration SMS dans le projet |
| "Envoyer la candidature à la régie" | `agentmail.sendInquiry` | Repris tel quel |
| "Auditer le dossier" | — | **Supprimé** — capacité floue, pas de fonction réelle derrière |
| "Connexion chiffrée" | — | **Supprimé** — habillage, HTTPS n'est pas une donnée produit à afficher comme un badge |
| Comparatif loyers du secteur (graphique) | — | **Supprimé** — aucune source de données de marché intégrée (pas d'API OFS/statistique), c'est un bloc entier fabriqué |
| Footer "LATENCE: 1.2s" | — | **Supprimé**, même raison que les autres écrans |
| Footer régies auditées | `agencies.listPublic` | Repris, réutilise `Footer` existant |

## Fichiers à créer/modifier

- `convex/profiles.ts` — `matchedListingValidator` gagne `firstSeenAt:
  v.number()` ; `myMatches` le renvoie (le champ existe déjà sur `listings`,
  juste jamais exposé ici).
- `convex/agentmail.ts` — nouvelle `query` publique `myInquiries` (identity-
  scoped, même pattern que `myThread`) : lit `inquiries` par `by_profile`
  (index déjà existant), joint `listings`+`agencies` pour le nom de régie
  (jamais `contactEmail`), retourne `{_id, status, sentAt, listing: {...}}`.
- `app/matches/page.tsx` — nouvelle route, `"use client"`, `AuthGate`.
  Colonne gauche : `myMatches` (non envoyées) + `myInquiries` (déjà
  envoyées), triées par fraîcheur. Colonne droite : détail de l'élément
  sélectionné — `Outreach` existant si un match est sélectionné, vue
  lecture seule (régie/annonce/date/statut) si une inquiry envoyée est
  sélectionnée. État de sélection en `useState` local, pas besoin de route
  dynamique.
- `components/Header.tsx` — activer l'onglet "Mes correspondances"
  (`href: null` → `href: "/matches"`), même pattern que "Mon profil".
- `app/page.tsx` — la section `MyMatches` inline dans le flux public
  **reste** (elle sert de résumé sur la home), mais gagne un lien "Voir
  toutes mes correspondances →" vers `/matches` si `myMatches.length > 0`.

## Critères d'acceptation

- Non connecté, `/matches` redirige vers le sign-in.
- Connecté sans correspondance : état vide clair, pas d'erreur.
- Une candidature déjà envoyée n'affiche jamais `contactEmail` ni le texte
  du courriel (pas stocké — voir limite acceptée ci-dessus).
- Sélectionner un match différent dans la liste de gauche change le
  panneau de droite sans recharger la page.
- `npm run typecheck && npm run lint && npm run build` passent.

## Comment tester

- Créer un profil avec un match existant, vérifier "Nouveau match" +
  temps relatif corrects.
- Envoyer une candidature de test (jamais vers une vraie régie — voir
  CLAUDE.md), vérifier qu'elle disparaît de la liste "non envoyées" et
  apparaît dans "envoyées" avec la bonne date.
- Vérifier dans l'onglet réseau qu'aucune réponse ne contient
  `contactEmail`.

---
*Ne pas exécuter avant validation explicite de ce plan par l'utilisateur.*
