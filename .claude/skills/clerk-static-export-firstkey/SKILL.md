---
name: clerk-static-export-firstkey
description: Contraintes Clerk + export statique Next.js spécifiques à firstkey — pourquoi @clerk/clerk-react et pas @clerk/nextjs, pourquoi AuthGate existe, ce qu'il ne faut jamais réintroduire (middleware, Server Actions, preloadQuery). Charger avant toute modification touchant l'authentification, l'ajout d'une page/route, ou tout composant qui importe du Clerk. Consulter aussi le skill officiel convex-setup-auth pour la configuration Convex↔Clerk générique — cette skill-ci documente uniquement ce qui est propre aux contraintes d'export statique de ce projet.
---

# Clerk + export statique — décisions spécifiques firstkey

## Pourquoi `@clerk/clerk-react` et pas `@clerk/nextjs`

`@clerk/nextjs` embarque des Server Actions. Le frontend firstkey est un export statique pur (`output: "export"` dans `next.config.ts`, servi par `@convex-dev/static-hosting` depuis convex.site) — il n'y a pas de serveur Next.js pour exécuter une Server Action. Le swap vers `@clerk/clerk-react` a été fait précisément pour ça. **Ne jamais réintroduire `@clerk/nextjs`** sans repenser toute la stratégie de hosting.

## Pourquoi `AuthGate.tsx` existe

Importer `@clerk/clerk-react` directement depuis un composant serveur (RSC) casse le build : le format d'export `react-server` de `swr` (dépendance de Clerk) ne correspond pas à ce qu'attend `@clerk/shared` dans cet arbre de modules. `AuthGate` isole `SignedIn`/`SignedOut`/`RedirectToSignIn` dans un Client Component (`"use client"`) pour que Clerk ne remonte jamais dans l'arbre RSC.

**Toute nouvelle page qui a besoin de vérifier l'auth doit passer par ce même confinement** — soit réutiliser `AuthGate`, soit reproduire le même pattern `"use client"` — jamais importer Clerk directement dans un composant serveur.

## Ce qui ne peut plus exister dans ce projet

- Pas de middleware Next.js (`proxy.ts` a été supprimé — un middleware ne tourne pas en export statique).
- Pas de Server Actions.
- Pas de `preloadQuery` côté serveur — le pattern React `useQuery` de `convex/react` est la seule façon de lire des données Convex depuis une page.
- Toute nouvelle route doit rester compatible export statique : pas de rendu à la requête, pas de logique server-only côté Next (la logique server-only vit dans Convex, jamais dans Next ici).

## Variables d'environnement Clerk côté client

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` et `NEXT_PUBLIC_CONVEX_URL` sont lues côté client dans `ConvexClientProvider.tsx` — cohérent avec l'export statique : pas de secret serveur Next, tout ce qui est sensible côté Clerk/Convex reste server-only dans Convex, jamais dans une variable `NEXT_PUBLIC_*`.

## Contrainte de jugement violée actuellement — priorité de correction

Le hackathon exige explicitement que le feed d'annonces soit visible **sans connexion** — un juge qui ouvre l'URL doit voir le produit vivre immédiatement, Clerk ne doit protéger que `/profile` et l'inbox. `app/page.tsx` fait aujourd'hui l'inverse : `<Unauthenticated>` n'affiche que les boutons sign-in/sign-up, rien du produit. La correction attendue : sortir le feed du gating, ne garder `<SignedIn>`/`<Authenticated>` que pour les sections qui en ont vraiment besoin (créer un profil, voir l'inbox). Voir `AGENTS.md` → "Écarts stratégie ↔ code actuel", point 1.

## Avant de construire une nouvelle page authentifiée

1. Vérifier que le contenu peut être rendu entièrement côté client (pas de dépendance à une donnée disponible seulement au moment du build ou d'une requête serveur).
2. Envelopper le contenu protégé avec `AuthGate` (ou `<Authenticated>`/`<Unauthenticated>` de `convex/react` si le pattern de `app/page.tsx` suffit).
3. Lire les données via `useQuery`, jamais via un fetch serveur.
