# Prompt d'implémentation — page "Messagerie régies"

## Objectif

Créer `/messenger` (4ᵉ et dernier onglet de nav, désactivé aujourd'hui),
appliquant `design/messenger.png` : liste des fils de discussion à gauche,
fil complet + réponse à droite. Dernier écran de la maquette.

## Décisions validées le 2026-09-14

- **Stocker le texte qu'on envoie** (`Ajouter inquiries.text` — recommandé,
  validé). Réalisé différemment de ce qui était proposé : un simple champ
  unique sur `inquiries` ne suffit pas dès qu'on ajoute la réponse (un fil
  peut contenir plusieurs messages sortants dans le temps). Remplacé par
  une petite table `outboundMessages` — voir schéma ci-dessous.
- **Ajouter l'envoi de réponse maintenant** (validé, pas juste lecture
  seule). C'est la **première vraie capacité d'envoi de réponse** jamais
  construite dans ce projet — mêmes garde-fous que `sendInquiry` à
  l'origine : jamais automatique, premier vrai test sur une boîte que
  l'utilisateur contrôle, jamais directement vers une vraie régie sans
  validation explicite au moment T.

## Recherche effectuée (API réelle, pas de supposition)

`POST https://api.agentmail.to/v0/inboxes/{inbox_id}/messages/{message_id}/reply`
— `message_id` = l'ID du message auquel on répond (le dernier message
entrant du fil), body `{text, ...}`, réponse `{message_id, thread_id}` —
même forme que l'endpoint d'envoi initial déjà utilisé dans
`convex/agentmail.ts`.

## Mapping maquette → donnée réelle

| Élément de la maquette | Source réelle | Traitement |
|---|---|---|
| "Latence messagerie: 420ms" | — | **Supprimé** |
| "Chiffrement bout-en-bout RSA-4096" | — | **Supprimé** — affirmation de sécurité fausse/trompeuse (les emails ne sont pas chiffrés E2E), pas juste "pas de donnée" |
| "Veille active • N régies genevoises connectées" | `agencies.listPublic` | Repris, réutilise le pattern déjà en place |
| Liste des discussions (agence, dernier message, heure) | `agentmail.myInquiries` + fil fusionné | Repris, réel |
| "Confirmation sous 24h" / "Délai réponse régie: 24h" | — | **Supprimé** — aucune SLA de ce type n'existe |
| "En attente décision bailleur" / "Dossier complet (100%)" | — | **Supprimé** — statuts inventés hors du modèle réel (`sent`/`replied`/`closed`) |
| "SURVEILLANCE DES ACCUSÉS... traitent prioritairement..." | — | **Supprimé** — statistique comportementale inventée |
| Photo de l'annonce, "Réf. RO-4912-C" | — | **Supprimé**, même raison que les autres écrans |
| "Surface pondérée", "Loyer net + charges CHF X + Y", "Disponibilité" | — | **Supprimé** — champs qui n'existent pas (`surfaceM2` brut repris tel quel, pas de ventilation charges, pas de champ disponibilité) |
| Message sortant affiché en entier + PJ "Dossier_solvabilite...pdf" | **nouveau** `outboundMessages` (texte réel) | Repris pour le texte ; **pièce jointe supprimée** (pas de stockage de fichiers, même décision que l'écran profil) |
| "✓✓" (accusé de lecture) | — | **Supprimé** — aucun système d'accusé de lecture |
| Réponse entrante (expéditeur, date, texte) | `components.agentmail.lib.listInboundMessages` (déjà branché) | Repris, réel |
| Badge "OFFICIEL" | — | **Supprimé** — aucune notion de message "officiel" vs autre |
| "DÉTAILS D'ACCÈS SÉCURISÉ" (digicode, contact) | — | **Supprimé** — bloc entier fabriqué, ce n'est que du texte de réponse normal |
| "ACTIONS DE RÉPONSE RAPIDE" (boutons intelligents) | — | **Supprimé pour cette passe** — nécessiterait une extraction de créneau par IA sur le texte reçu, hors périmètre |
| Zone de réponse libre + "Envoyer" | **nouveau** `agentmail.replyToInquiry` | **Ajouté**, réel (voir garde-fous ci-dessus) |
| "Synchroniser avec mon calendrier" | — | **Supprimé** — aucune intégration calendrier |
| Footer latence | — | **Supprimé**, même raison que les autres écrans |

## Schéma — changement validé

```ts
outboundMessages: defineTable({
  inquiryId: v.id("inquiries"),
  text: v.string(),
  agentmailMessageId: v.string(),
  sentAt: v.number(),
}).index("by_inquiry", ["inquiryId"]),
```

Nouvelle table, additive — n'affecte aucune donnée existante. Les 4
`inquiries` de test déjà en base n'auront pas de ligne `outboundMessages`
rétroactive (texte jamais capturé à l'époque) : leur fil affichera les
réponses entrantes réelles sans le message sortant d'origine — limite
acceptée, pas un bug.

## Fichiers à créer/modifier

- `convex/schema.ts` — table `outboundMessages` ci-dessus.
- `convex/agentmail.ts` :
  - `recordSentInquiry` — insère aussi une ligne `outboundMessages` pour le
    premier envoi (texte déjà disponible dans `sendInquiry`, juste jamais
    persisté jusqu'ici).
  - `replyToInquiry` (nouvelle `action`, publique, identity-scoped) :
    vérifie que l'`inquiry` appartient bien à l'appelant (via son
    `profileId`), appelle `POST /messages/{message_id}/reply`, enregistre
    la réponse dans `outboundMessages` via une nouvelle `internalMutation`
    (`recordSentReply`) qui remet aussi `inquiries.status` à `"sent"` (sauf
    si `"closed"`) — on relance la balle côté régie.
  - `myThread` — réécrite pour fusionner `outboundMessages` (les nôtres) et
    `listInboundMessages` (les leurs, déjà réactif) en une seule liste
    chronologique normalisée `{kind: "outbound"|"inbound", text, timestamp,
    from?, messageId?}` — `messageId` sur les entrées entrantes seulement,
    nécessaire pour savoir à quoi répondre.
- `app/messenger/page.tsx` — nouvelle route, `AuthGate`, deux colonnes
  (liste des fils via `myInquiries` à gauche, fil + réponse à droite,
  répond au dernier `messageId` entrant du fil sélectionné).
- `components/Header.tsx` — active le 4ᵉ onglet (`href: null` →
  `href: "/messenger"`).

## Critères d'acceptation

- Aucune pièce jointe, digicode, accusé de lecture, ou statistique
  comportementale nulle part dans le code livré.
- `replyToInquiry` refuse une réponse sur une `inquiry` qui n'appartient
  pas à l'appelant.
- Répondre à un fil remet bien `inquiries.status` à `"sent"` (sauf
  `"closed"`).
- Aucun appel à `replyToInquiry` nulle part dans le code sauf le clic
  explicite du bouton "Envoyer" de cet écran.
- `npm run typecheck && npm run lint && npm run build` passent.

## Comment tester

- Vérifier que le fil affiche bien les vraies réponses entrantes (celles
  du test d'hier) une fois le fil sélectionné.
- **Premier test de réponse réelle** : comme pour le tout premier envoi,
  je ne déclenche rien moi-même — validation explicite nécessaire avant
  le premier clic sur "Envoyer" dans cette UI, et uniquement sur un fil
  de test que vous contrôlez, jamais vers une vraie régie sans accord
  explicite supplémentaire.

---
*Ne pas exécuter avant validation explicite de ce plan par l'utilisateur.*
