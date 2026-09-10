you# Agents.md — firstkey (Convex All Gas Hackathon)

> Ce fichier est écrit **pour l'agent**, pas pour la doc publique. Il **complète** — et ne remplace jamais — le bloc auto-généré `<!-- convex-ai-start -->...<!-- convex-ai-end -->` déjà présent en tête de `AGENTS.md`/`CLAUDE.md` dans ce repo, géré par `npx convex ai-files install`. Ne pas le supprimer ni le dupliquer ici : colle le contenu ci-dessous **après** ce bloc.
>
> Dernière synchronisation : code réel du repo (commit `a157e9d`) + conversation de stratégie "Analyse et stratégie pour un projet gagnant" (analyse des règles du hackathon + décisions d'architecture). Si les deux divergent, ce fichier signale la divergence explicitement plutôt que de trancher silencieusement.

## Contexte hackathon — règles et critères de jugement

- **Event** : Convex All Gas Hackathon. Fenêtre : 25 août → 22 septembre 12h PT. Solo, mi-temps.
- **Obligatoire pour la soumission** : nouvelle app démarrée après le 25/08 ✅, backend Convex ✅, repo GitHub public ✅, déployée sur `convex.site` (pas de localhost), vidéo démo < 3 min, post X/LinkedIn taguant **@convex @OpenAI @firecrawl @agentmail**, soumission sur vibeapps.dev.
- **Critères de jugement, dans l'ordre où ils pèsent le plus** :
  1. **Usage réel** — "a real person would use this this week". Un produit grand public/PME dans un vrai secteur, pas un dev tool. *"Copycats and developer-only tools score low."*
  2. **Profondeur Convex réelle** (queries/mutations/live updates/auth/components) — *"a thin frontend on a hosted page does not count."*
  3. **Les sponsors doivent réellement travailler dans le produit** — Firecrawl, OpenAI et AgentMail doivent chacun faire un vrai travail **au runtime**, pas juste être mentionnés ou avoir servi à coder (Codex ne compte pas pour OpenAI).
  4. URL publique fonctionnelle, démo vidéo courte, traction sociale.
- **Contrainte de jugement non négociable et actuellement violée par le code** : *le feed d'annonces doit être visible publiquement, sans connexion.* Un juge qui ouvre l'URL `convex.site` doit voir le produit vivre immédiatement — Clerk ne doit protéger que le profil personnel et l'inbox, jamais le feed principal.

## Produit

**Rental Copilot** (nom provisoire) : un copilote de recherche de logement à Genève. Il détecte les nouvelles annonces publiées directement sur les sites des régies (Naef, de Rham, Fongérant, Gérofinance, SPG-Intercity, Livit, Régie du Rhône, etc.) — **volontairement pas les gros portails** (Homegate, ImmoScout24, Comparis).

**Pourquoi ce choix de source est une décision produit, pas un raccourci technique** : les régies publient souvent leurs biens sur leur propre site avant que ça remonte sur les portails agrégateurs. Cibler les sites de régies (a) évite les CGU strictes et l'anti-bot costaud des gros portails — risque juridique/technique bien plus faible pour un solo en mi-temps — et (b) donne un angle produit défendable devant le jury : *"on regarde une source que les chercheurs de logement ne consultent jamais un par un, donc on est plus rapide."* Ne jamais élargir le crawl vers un gros portail agrégateur sans revalider ce choix.

Le produit matche ensuite ces annonces contre un profil de recherche (budget, pièces, marché) et envoie une candidature personnalisée à la régie en son nom, avec un fil de conversation qui se met à jour en direct quand la régie répond.

- **Qui crée la donnée** : le crawler Firecrawl (déclenché manuellement pour l'instant).
- **Qui la consomme** : les locataires (via leur `profile`) qui reçoivent des matches, et les régies qui reçoivent une prise de contact automatisée.
- **Source de vérité** : Convex uniquement (`convex/schema.ts`).
- **Public vs authentifié** : le feed d'annonces doit rester public (voir contrainte de jugement ci-dessus) ; seuls `/profile` et l'inbox nécessitent Clerk.
- **Strictement serveur** : l'appel Firecrawl (clé API), l'appel OpenAI (clé API), tout ce qui touche `agencies.contactEmail`.

## Écarts stratégie ↔ code actuel — à corriger en priorité

Le schéma est fidèle à l'architecture décidée. Le reste a un retard réel sur le plan (Semaine 1 quasi terminée, Semaine 2 pas commencée, alors qu'on est à peu près à mi-parcours du calendrier des 3 semaines). Par ordre d'impact sur le score :

1. **🔴 Le feed n'est pas public.** `app/page.tsx` force la connexion (`Unauthenticated` → boutons sign-in/sign-up uniquement, rien à voir sans compte). C'est une violation directe de la règle de jugement la plus explicite qu'on ait identifiée. À corriger avant toute autre feature UI.
2. **🔴 OpenAI n'est pas intégré.** Aucune dépendance, aucun appel — `convex/openai.ts` (génération du texte de candidature via `gpt-4o-mini`, appel direct `fetch`, pas le Convex AI Gateway réservé aux plans payants) n'existe pas encore. Sans ça, un des 3 sponsors obligatoires est à zéro.
3. **🔴 AgentMail n'est pas intégré.** Le schéma anticipe `inquiries.agentmailThreadId` mais rien n'envoie ni ne reçoit d'email. Deuxième sponsor obligatoire à zéro.
4. **🟠 Le matching n'existe pas.** `listings.status` ne bouge jamais au-delà de `"new"`. C'est le cœur de la proposition de valeur ("on te trouve un logement qui correspond à ton profil") et il est actuellement absent de la démo.
5. **🟡 Le crawler Firecrawl utilise `fetch` REST direct, pas le composant officiel `@firecrawl/firecrawl-convex`** identifié dans la stratégie comme le choix à privilégier pour la profondeur Convex (crawls durables, progression réactive écrite directement en base). Ça reste un vrai usage de Firecrawl (le sponsor n'est pas à zéro), mais ça score probablement moins bien sur le critère "profondeur Convex/components" que prévu. **Point à trancher** : rester sur l'implémentation actuelle (déjà testée, fonctionne) ou migrer vers le composant officiel avant la deadline — ne pas décider ça seul, le risque d'une réécriture ratée à 2 semaines de la fin est réel.
6. **🟡 Statut de déploiement à reconfirmer.** Un déploiement prod (`outstanding-malamute-184.convex.site`) a réussi tôt dans le projet (juste le shell Clerk). Le `hackathon.md` du repo indique "not deployed" après l'ajout du crawler — soit ça n'a jamais été repoussé après ce commit, soit le log n'est juste pas à jour. À vérifier en premier avant de construire davantage dessus : un redéploiement cassé découvert à la deadline est le pire scénario de tout ce plan.

## Méthode de travail obligatoire (édition hackathon)

Voir le skill `origin-studio-hackathon-workflow`. Résumé :

1. Lire ce fichier + les skills pertinents avant de toucher au code.
2. Inspecter le code réellement présent, pas seulement `hackathon.md` (déjà pris en défaut une fois — voir écart n°6).
3. Si le périmètre touche un point encore ouvert (section ci-dessous), poser la question avant de construire.
4. Pour toute feature non triviale, prompt court dans `/prompts/[feature].md`, validé avant exécution.
5. Validation humaine non négociable avant : premier envoi réel d'email à une vraie régie, premier vrai crawl à grande échelle (coût Firecrawl), tout changement de schéma touchant des données existantes.
6. Après implémentation : `npm run typecheck`, `npm run lint`, `npm run build`.
7. Une branche par feature, PR avant merge — donne un historique défendable devant le jury et un point de retour si une feature casse le build en fin de course.

## Skills à charger

| Skill | Type | Charger quand... |
|---|---|---|
| `convex`, `convex-quickstart`, `convex-crons`, `convex-env`, `convex-auth`, `convex-setup-auth`, `convex-authz`, `convex-seed`, `convex-test`, `convex-optimize`, `convex-reviewer`, `convex-deploy-guard`, … (liste complète : `skills-lock.json`) | Officiel `get-convex/agent-skills` (déjà installés) | Toute syntaxe/API Convex |
| `firecrawl-crawler-firstkey` | Projet | Modifier le crawling, ajouter une régie, trancher le point 5 ci-dessus |
| `clerk-static-export-firstkey` | Projet | Auth, nouvelle page/route, rendre le feed public (point 1) |
| `matching-outreach-firstkey` | Projet | Construire matching (OpenAI) + outreach (AgentMail) — flux maintenant décidé, juste pas codé |
| `origin-studio-hackathon-workflow` | Perso, réutilisable | Toujours en toile de fond |

## Design

Les maquettes validées vivent dans `design/` à la racine du repo — référence visuelle **obligatoire** pour toute feature UI, à consulter avant de coder un écran. Voir `design/design-system.md` pour les tokens (couleurs, typo, layout) et la règle non négociable : **aucun chiffre ou badge affiché sans donnée réelle derrière** (pas de score de match inventé, pas de certification tierce fictive, pas de nombre de régies aspirationnel). Cette règle a été ajoutée après une première génération de maquette qui inventait des certifications USPI/ASLOCA/LDTR et des scores de solvabilité — ne jamais la réintroduire, même comme "juste un exemple visuel".

| Fichier | Écran |
|---|---|
| `design/publicFeed.png` | Flux public — priorité de construction n°1 |
| `design/profile.png` | Mon profil de candidat |
| `design/myCorrespondence.png` | Mes correspondances — nécessite `convex/matching.ts` avant de construire l'UI |
| `design/messenger.png` | Messagerie régies — nécessite AgentMail branché avant de construire l'UI |

Pas de maquette mobile exportée à ce jour — priorité basse, à générer seulement si le temps le permet une fois les 4 écrans desktop construits.

## Structure du projet

- `convex/schema.ts` — source de vérité du modèle de données, fidèle à l'architecture décidée.
- `convex/firecrawl.ts` — `action` en `fetch` REST direct (voir écart n°5).
- `convex/listings.ts`, `convex/agencies.ts` — uniquement `internalMutation`/`internalQuery`. **Toute nouvelle fonction publique sur `agencies` doit omettre `contactEmail`.**
- `convex/lib/hash.ts` — module utilitaire pur, pas d'endpoint.
- `convex/seed.ts` — dev-only.
- `components/AuthGate.tsx` / `components/ConvexClientProvider.tsx` — Clerk confiné en Client Component (export statique).
- `app/page.tsx` — **à corriger en priorité** : actuellement 100% gated, doit devenir feed public + zone authentifiée pour le profil/inbox.
- Manquants par rapport au plan : `convex/crons.ts`, `convex/matching.ts`, `convex/openai.ts`, `convex/agentmail.ts`, `convex/profiles.ts`, `app/profile/`, `app/inbox/`, `convex/http.ts` (réservé via `httpPrefix: "/api"` dans `convex.config.ts`, utile pour un futur webhook AgentMail).

## Stack technique

- Next.js 16 en **export statique** (`output: "export"`, `distDir: "dist"`) — servi par `@convex-dev/static-hosting`, aucun serveur Next.
- Convex 1.44.
- Clerk via `@clerk/clerk-react` (pas `@clerk/nextjs`).
- Firecrawl — `fetch` REST direct (voir écart n°5).
- **OpenAI — appel direct `fetch` à l'API (`gpt-4o-mini`), pas le Convex AI Gateway** (réservé aux plans payants). Décidé mais pas codé.
- **AgentMail — composant Convex officiel** prévu (threads/labels/messages synchronisés en réactif). Décidé mais pas codé.
- pnpm. Déploiement : `npm run deploy` → `npx @convex-dev/static-hosting deploy`.

## Modèle de données (état réel au commit `a157e9d`)

- `markets`, `agencies` (`contactEmail` sensible, jamais public), `listings` (`status: new|matched|contacted|replied`, seul `"new"` est atteint aujourd'hui, dédup par hash d'URL canonique — voir skill firecrawl), `profiles` (schéma prêt, rien ne le lit/l'écrit), `inquiries` (schéma prêt, `agentmailThreadId` anticipe AgentMail, rien d'implémenté).

## Points ouverts — vraiment non tranchés (à distinguer de "juste pas codé")

1. **Point 5 ci-dessus** : garder `fetch` direct pour Firecrawl ou migrer vers `@firecrawl/firecrawl-convex` ?
2. **Formule exacte du matching** : l'architecture dit "compare aux profils actifs du même marché" — le sens le plus probable est `priceChf <= budgetMax` et `rooms >= roomsMin`, mais ça n'a jamais été confirmé littéralement, et rien ne dit si `moveInDate` doit filtrer aussi. À confirmer avant de coder `convex/matching.ts`.
3. **Relecture humaine avant envoi** : un match déclenche-t-il l'envoi AgentMail automatiquement, ou une validation manuelle reste-t-elle nécessaire au moins pendant le hackathon ? Recommandation forte : validation manuelle tant qu'on n'a pas testé le gabarit d'email sur au moins une vraie régie.
4. **Volume de démo** : un seul market/agency seedé à ce jour ; le plan visait ~30 régies en semaine 3 — à quel volume s'arrêter compte tenu du temps restant ?

## Ce que l'agent ne doit jamais faire

- Rendre `contactEmail` accessible depuis une query publique.
- Construire une feature qui re-cache le feed derrière l'auth — c'est l'inverse du correctif prioritaire.
- Crawler un gros portail agrégateur (Homegate, ImmoScout24, Comparis) sans revalider explicitement ce choix — c'est une décision produit assumée, pas un oubli.
- Envoyer un email réel via AgentMail sans confirmation explicite, même en test.
- Réintroduire `@clerk/nextjs`, des Server Actions, ou du middleware Next.
- Utiliser Codex/un agent de code comme substitut à un vrai appel OpenAI runtime — ça ne compte pas pour le critère de jugement sponsor.
