# Prompt d'implémentation — agentmail.ts (envoi validé manuellement)

## Objectif

Construire `convex/agentmail.ts` : envoyer le texte généré par `openai.ts` à
`agencies.contactEmail` via le composant Convex officiel `@agentmail/convex`,
et faire remonter les réponses en réactif. Dernier des trois sponsors, le
plus risqué (composant externe jamais testé dans ce repo, un email cassé
part vraiment chez une régie).

## Contraintes non négociables (du user + AGENTS.md)

- Aucun envoi automatique déclenché par le matching ou par quoi que ce soit
  d'autre — uniquement un déclenchement manuel explicite (clic utilisateur).
- Premier envoi de test vers une adresse que **je contrôle** (le user),
  jamais directement vers une vraie régie.
- Le gabarit doit être éprouvé avant tout envoi réel à une régie.

## Recherche effectuée (package réel, pas de supposition)

`@agentmail/convex@0.1.0` installé et inspecté directement (README +
`.d.ts` sources, pas de résumé web) :

- `new AgentMail(components.agentmail, options?)` — client.
- `createInbox(ctx: ActionCtx, {username?, domain?, displayName?, clientId?})`
  → crée une vraie boîte AgentMail (nécessite un `action`).
- `sendMessage(ctx: MutationCtx, inboxId, {to, subject, text, labels})` →
  enqueue via workpool interne (retries gérés par le composant), appelable
  depuis une **mutation**, pas besoin d'action pour l'envoi lui-même.
  Retourne un `OutboundId`.
- `status(ctx: QueryCtx, outboundId)` — reactive, `{status, agentmailMessageId,
  threadId, errorMessage}`. **`threadId` n'est connu qu'après coup**, pas au
  moment de l'enqueue.
- `handleWebhook(ctx, req)` à monter dans `convex/http.ts` — Svix-vérifié,
  dédupliqué par `event_id`.
- `listInboundMessages({threadId})` — query réactive locale (table du
  composant), c'est elle qui alimente l'inbox UI, pas un appel API distant.
- Env vars nécessaires : `AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET`
  (obtenu après avoir enregistré l'URL du webhook côté AgentMail).

## Écart découvert avec le schéma actuel — à trancher avant de coder

`inquiries.agentmailThreadId` est `v.string()` **requis** dans
`convex/schema.ts`. Or `sendMessage` ne renvoie qu'un `OutboundId` — le
`threadId` réel n'est connu qu'une fois AgentMail a effectivement accepté
l'envoi (asynchrone, pas dans le même appel). Impossible de remplir ce champ
de façon synchrone au moment de l'enqueue.

**Proposition** (à valider — c'est un changement de schéma, règle AGENTS.md
point 5) :
- `agentmailThreadId: v.optional(v.string())` (rempli plus tard, dès qu'on
  l'observe côté client via `status(outboundId)` puis un petit
  `patchInquiryThreadId`).
- Ajout de `outboundId: v.string()` sur `inquiries`, qui lui **est** connu
  immédiatement — c'est la vraie clé de suivi tant que `threadId` n'existe
  pas encore.

Table `inquiries` actuellement vide (0 doc, vérifié) — aucun risque de perte
de données, mais le changement reste soumis à validation explicite.

## Stratégie inbox

Une seule boîte AgentMail pour toute l'app (identité d'outreach "firstkey"),
pas une par utilisateur — créée une fois via un appel manuel
(`npx convex run agentmail:createInbox`), son `inbox_id` stocké comme env var
`AGENTMAIL_INBOX_ID` (même pattern que `FIRECRAWL_API_KEY`/`OPENAI_API_KEY`).

## Webhook et `httpPrefix`

`convex.config.ts` a déjà `httpPrefix: "/api"` (réservé pour ça). Le README
du composant montre `/agentmail/webhook` comme exemple générique, mais dans
ce projet toute route de `convex/http.ts` sera servie sous `/api/...` — donc
l'URL réelle à enregistrer côté AgentMail sera
`https://<deployment>.convex.site/api/agentmail/webhook`. À vérifier après
déploiement, pas supposé.

## Fichiers à créer/modifier

- `convex/schema.ts` — `inquiries.agentmailThreadId` optionnel +
  `inquiries.outboundId` (validation requise, voir ci-dessus).
- `convex/convex.config.ts` — `app.use(agentmail)`.
- `convex/agentmail.ts` — `createInbox` (action, admin-only/manuel),
  `sendInquiry` (mutation : lit `agencies.contactEmail` en interne, appelle
  `sendMessage`, crée `inquiries` avec `status: "sent"`, passe
  `listings.status` à `"contacted"`), `sendStatus` (query, wrap de
  `status`), `patchThreadId` (internalMutation, backfill), `myThread` (query
  authentifiée, wrap de `listInboundMessages` scopée à un thread que
  l'utilisateur possède via `inquiries`).
- `convex/http.ts` (nouveau) — monte `agentmail.handleWebhook`.
- `convex/openai.ts` — `draftInquiry` reste `internalAction` ; ajout d'un
  wrapper public authentifié (`profiles.draftMyInquiry` ou équivalent) qui
  vérifie que l'appelant possède bien le `profileId` avant d'appeler
  `internal.openai.draftInquiry` — comblait le trou de sécurité noté dans le
  commit précédent.
- `app/page.tsx` (ou nouvelle section) — bouton "Générer un brouillon" →
  texte affiché dans un textarea éditable → bouton "Envoyer" (explicite,
  jamais automatique) → statut d'envoi réactif.
- `app/inbox/` ou section dédiée — thread reactif via `myThread`.

## Comment tester

1. Créer l'inbox une fois (`npx convex run agentmail:createInbox`).
2. Premier `sendInquiry` de test avec `to` = adresse que le user contrôle
   (jamais `agencies.contactEmail` réel) — validation explicite avant ce
   premier envoi, comme pour le premier crawl réel.
3. Vérifier réception réelle + relire le texte reçu.
4. Une fois le gabarit éprouvé sur adresse contrôlée seulement : la target
   `agencies.contactEmail` réelle reste un déclenchement manuel, jamais testé
   par moi sans confirmation explicite supplémentaire au moment T.

## Critères d'acceptation

- `npm run build` passe.
- Aucun chemin de code n'appelle `sendInquiry` automatiquement.
- Un envoi de test vers une adresse contrôlée par le user réussit et le
  texte reçu est relu avant de considérer la feature terminée.

---
*Ne pas exécuter avant validation du changement de schéma ci-dessus et
sans `AGENTMAIL_API_KEY` posée par le user lui-même.*
