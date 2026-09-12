# Prompt d'implémentation — brancher réellement le webhook AgentMail

## Objectif

Fermer l'Open Issue #3 de CLAUDE.md ("Inbound replies unhandled") : faire en
sorte qu'une réponse réelle d'une régie remonte effectivement dans l'app.
Prérequis explicite avant de construire `messenger.png` — pas question de
faire une belle UI branchée sur un pipeline qui n'a jamais tourné.

## Diagnostic (vérifié en direct, pas supposé)

- `convex/http.ts` monte déjà `agentmail.handleWebhook` sur
  `/agentmail/webhook`, servi en réalité sous `/api/agentmail/webhook`
  (`httpPrefix: "/api"` dans `convex.config.ts`).
- `AGENTMAIL_WEBHOOK_SECRET` **absent** de `npx convex env list` sur dev.
- `GET https://api.agentmail.to/v0/webhooks` (appelé en direct avec la vraie
  clé) → `{"count": 0, "webhooks": []}`. **Aucun webhook n'a jamais été
  enregistré côté AgentMail.** Le endpoint existe dans notre code, mais
  AgentMail n'a jamais été informé de son existence.
- Ni `convex/http.ts` ni `convex/agentmail.ts` ne passent d'option
  `onMessageReceived` au constructeur `AgentMail(...)` — même si un webhook
  arrivait, rien ne met à jour `inquiries.status`/`listings.status`.
- `inquiries` a déjà 4 lignes réelles de test (vérifications antérieures),
  dont 2 avec un vrai `agentmailThreadId` — utilisables pour le test
  bout-en-bout sans recréer de données.

## Plan

1. **Enregistrer le webhook côté AgentMail** — `POST /v0/webhooks` :
   ```json
   {
     "event_types": ["message.received"],
     "url": "https://clever-toucan-312.eu-west-1.convex.site/api/agentmail/webhook",
     "inbox_ids": ["<AGENTMAIL_INBOX_ID>"]
   }
   ```
   Réponse contient `secret` → stocké comme `AGENTMAIL_WEBHOOK_SECRET` sur
   dev (`npx convex env set`, jamais affiché en clair).
   **Action réelle sur un compte tiers en dur — je ne le fais pas sans
   votre feu vert explicite, même si c'est réversible (on peut supprimer le
   webhook après).**

2. **`convex/agentmail.ts`** — nouvelle `internalMutation` `onMessageReceived`
   (signature imposée par le composant : `{message, thread, eventId}`) :
   cherche une `inquiries` dont `agentmailThreadId === message.thread_id`
   (pas d'index dessus aujourd'hui — table petite, un `.collect()` +
   `.find()` suffit pour le volume du hackathon), et si trouvée et pas déjà
   `"replied"`/`"closed"` : passe `inquiries.status` à `"replied"` et
   `listings.status` (de `inquiry.listingId`) à `"replied"` aussi — comblant
   exactement ce que le schéma prévoyait sans jamais l'implémenter.

3. **`convex/http.ts`** — le constructeur `AgentMail` gagne l'option
   `{ onMessageReceived: internal.agentmail.onMessageReceived }`.

4. **Test bout-en-bout réel** — nécessite votre participation, je ne peux
   pas envoyer un email moi-même : répondez (ou faites répondre depuis une
   adresse que vous contrôlez) à l'un des deux threads réels existants dans
   `inquiries` (ceux avec un `agentmailThreadId` non vide), ou envoyez un
   nouvel email à `firstkey@agentmail.to`. Je vérifie ensuite côté Convex
   que l'event est bien arrivé et que le statut a changé.

## Fichiers à créer/modifier

- `convex/agentmail.ts` — `onMessageReceived` (nouvelle fonction).
- `convex/http.ts` — passer l'option au constructeur `AgentMail`.

## Critères d'acceptation

- Un vrai email entrant sur un thread suivi fait passer `inquiries.status`
  et `listings.status` à `"replied"`, vérifié en relisant les tables après
  coup — pas juste "le code compile".
- `npm run typecheck && npm run lint && npm run build` passent.
- Aucun envoi sortant automatique n'est ajouté nulle part — ce prompt ne
  touche que la réception.

## Hors périmètre (pour `messenger.png`, pas ce prompt-ci)

L'UI de la messagerie elle-même (thread réactif via `myThread`, déjà
existant côté query) — une fois ce pipeline prouvé bout-en-bout, c'est un
prompt séparé.

---
*Ne pas exécuter l'étape 1 (enregistrement webhook réel) avant validation
explicite.*
