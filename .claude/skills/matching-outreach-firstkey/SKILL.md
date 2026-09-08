---
name: matching-outreach-firstkey
description: Domaine métier firstkey — matching entre profils locataires et listings (OpenAI pour la rédaction), et prise de contact automatisée des régies via AgentMail. Le flux est décidé dans la stratégie du hackathon mais rien n'est codé (schéma Convex prêt, zéro fonction). Charger avant de construire convex/matching.ts, convex/openai.ts, convex/agentmail.ts, convex/profiles.ts, ou toute UI de profil/résultats/inbox. Ces deux intégrations (OpenAI, AgentMail) sont des critères de jugement obligatoires du hackathon — les construire en priorité.
---

# Matching & outreach — domaine métier firstkey

> Flux décidé dans la conversation de stratégie du hackathon, jamais implémenté. Les deux points encore réellement ouverts sont marqués comme tels ci-dessous — ne pas les combler par une supposition, poser la question. Tout le reste peut être codé directement.

## Flux décidé (architecture confirmée, pas encore codé)

1. Un nouveau listing est inséré (`listings:upsertBatch`) → déclenche `matching:matchNewListing` (`internalMutation`), qui compare le listing aux `profiles` actifs du même `marketId`.
2. Un match passe `listings.status` à `"matched"`.
3. `openai:draftInquiry(profileId, listingId)` — `action`, appel `fetch` direct à l'API OpenAI (`gpt-4o-mini`, pas le Convex AI Gateway), génère le texte de candidature à partir de `profiles.pitch` + les détails du listing.
4. `agentmail:sendInquiry` — `action` utilisant le composant Convex officiel AgentMail, crée un thread et envoie le texte généré à `agencies.contactEmail`. `listings.status` passe à `"contacted"`, un `inquiries` est créé (`status: "sent"`).
5. Les réponses de la régie arrivent dans le thread AgentMail → synchronisées automatiquement en réactif dans la table du composant (pas de webhook custom à écrire pour ça — c'est tout l'intérêt du composant officiel). `inquiries.status` passe à `"replied"` quand une réponse arrive ; `listings.status` peut suivre.
6. L'inbox (`app/inbox`) affiche ce thread via `useQuery` sur la table du composant AgentMail — se met à jour en direct sans polling.

## Schéma déjà en place (rappel)

- `profiles` : `userId` (Clerk subject), `marketId`, `budgetMax`, `roomsMin`, `moveInDate?`, `pitch`. Indexée `by_user`.
- `listings.status` : `"new" | "matched" | "contacted" | "replied"`.
- `inquiries` : `listingId`, `profileId`, `agentmailThreadId`, `status: "sent" | "replied" | "closed"`, `sentAt`. Indexée `by_listing`.

## Ce qui reste réellement à trancher (poser la question, ne pas deviner)

1. **Formule exacte du matching** — `priceChf <= budgetMax` et `rooms >= roomsMin` est l'interprétation la plus probable de "compare aux profils actifs du même marché", mais jamais confirmée littéralement. `moveInDate` doit-il aussi filtrer (ex : n'afficher que les profils dont la date d'emménagement est compatible avec la disponibilité du bien) ? Il n'y a pas de champ de disponibilité sur `listings` aujourd'hui — si `moveInDate` doit compter, un champ manque au schéma.
2. **Automatisation vs validation humaine de l'envoi** — un match déclenche-t-il `sendInquiry` automatiquement, ou une validation manuelle reste-t-elle nécessaire ? **Recommandation forte pour la durée du hackathon : validation manuelle** tant que le gabarit d'email OpenAI n'a pas été testé sur au moins une vraie régie — un email cassé ou hors-sujet envoyé en pleine démo n'est jamais rattrapable, et c'est exactement le type d'erreur pour laquelle la méthode Origin Studio exige une validation humaine avant écriture/envoi réel.

## Priorité de construction

OpenAI et AgentMail sont chacun un critère de jugement obligatoire du hackathon (3 sponsors doivent réellement travailler dans le produit, pas juste être mentionnés) — actuellement les deux sont à zéro dans le code. Construire dans cet ordre :
1. `matching.ts` (pas d'appel externe, pure logique Convex, débloque une UI de démo tout de suite).
2. `openai.ts` (un seul appel `fetch`, risque faible, débloque le critère OpenAI).
3. `agentmail.ts` (composant officiel à intégrer, risque plus élevé de friction technique — prévoir plus de temps, et voir si le composant a un setup particulier comme celui de Firecrawl).

Ne pas commencer par AgentMail sous prétexte que c'est "la feature la plus impressionnante" — si le temps manque, un matching + une génération OpenAI qui marchent valent mieux qu'une intégration AgentMail à moitié cassée en démo.
