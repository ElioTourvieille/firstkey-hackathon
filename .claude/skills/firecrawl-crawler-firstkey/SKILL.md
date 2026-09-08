---
name: firecrawl-crawler-firstkey
description: Décisions et pièges spécifiques au crawler Firecrawl du projet firstkey — dédup par hash d'URL canonique, extraction JSON structurée, absence de SDK, coût par appel. Charger cette skill avant de modifier convex/firecrawl.ts, convex/listings.ts, convex/lib/hash.ts, ou d'ajouter une nouvelle régie/marché à crawler. Aucun skill officiel Firecrawl n'étant installé pour Convex, cette skill comble ce vide — la consulter systématiquement pour toute tâche de crawling, dédup, ou extraction de données sur ce projet.
---

# Firecrawl — décisions spécifiques firstkey

> Pas de SDK Firecrawl installé (`package.json` ne liste aucune dépendance `firecrawl` ni `@mendable/firecrawl-js`). L'appel se fait en `fetch` REST direct sur `POST https://api.firecrawl.dev/v2/scrape` avec `Authorization: Bearer <FIRECRAWL_API_KEY>`. Rester sur ce pattern sauf besoin explicite d'une fonctionnalité qui exige le SDK (crawl multi-pages, webhooks) — ajouter une dépendance non demandée n'est jamais un choix par défaut.

## Extraction structurée

Le format `formats: [{ type: "json", prompt, schema }]` est utilisé avec un JSON Schema explicite (`LISTINGS_SCHEMA` dans `convex/firecrawl.ts`) plutôt qu'un prompt libre seul — plus fiable pour un champ numérique comme `priceChf`. Toute nouvelle régie doit passer par ce même schéma d'extraction ; ne pas créer un schéma différent par régie sans raison forte (ça complique la normalisation en aval dans `listings.ts`).

## Le piège de la dédup — ne pas le reproduire

Le hash de dédup (`sourceHash`, voir `convex/lib/hash.ts`) porte **uniquement sur l'URL canonique** (query string et hash retirés). Il a été testé avec `price`/`rooms` inclus dans la clé — ça créait des doublons, parce que l'extraction LLM de Firecrawl ne renvoie pas exactement la même valeur de `rooms` à deux crawls consécutifs de la même page inchangée (constaté en testant contre une vraie page de régie, corrigé avant commit). Si un futur champ extrait par LLM (`surfaceM2`, `address`, etc.) est envisagé comme critère de dédup, tester d'abord sur une vraie page avant de l'ajouter à la clé.

## Normalisation de l'URL

`new URL(listing.url, agency.listingsUrl)` résout les URLs relatives par rapport à la page listée — indispensable, certaines régies renvoient des chemins relatifs plutôt qu'absolus. `search` et `hash` sont systématiquement vidés avant hashage.

## Coût et fréquence

Chaque appel `crawlAgency` consomme un crédit Firecrawl payant. Le déclenchement est manuel et volontaire (`npx convex run firecrawl:crawlAgency '{"agencyId":"..."}'`) — voir `AGENTS.md` pour la règle sur les crons. Avant tout script qui bouclerait automatiquement sur plusieurs régies, vérifier le nombre de régies concerné et le budget Firecrawl disponible.

## Divergence avec la stratégie — point à trancher, pas à deviner

La conversation de stratégie du hackathon recommandait explicitement le composant Convex officiel `@firecrawl/firecrawl-convex` (`FirecrawlClient`, méthode `scrape()`) plutôt qu'un appel REST manuel — l'argument étant la profondeur Convex : crawls durables, progression réactive écrite directement en base, mieux noté sur le critère de jugement "components réels" que *"a thin frontend on a hosted page does not count"* sanctionne. Le code actuel a divergé vers un `fetch` direct, ce qui **reste un vrai usage de Firecrawl** (le sponsor n'est pas absent) mais probablement moins bien noté sur la profondeur Convex.

**Ne pas migrer vers le composant officiel sans validation explicite** : l'implémentation actuelle est testée et fonctionne (bug de dédup déjà trouvé et corrigé) ; une réécriture à quelques jours de la deadline est un risque réel pour un gain de notation incertain. Si le temps le permet et que d'autres features prioritaires (matching, OpenAI, AgentMail — voir skill `matching-outreach-firstkey`, actuellement à zéro) sont déjà construites, remonter cette migration comme candidate.

## Variables d'environnement

`FIRECRAWL_API_KEY` est déclarée optionnelle dans `convex/convex.config.ts` (`env: { FIRECRAWL_API_KEY: v.optional(v.string()) }`) et lue via `env.FIRECRAWL_API_KEY` dans l'action (pas `process.env`). Voir le skill officiel `convex-env` pour la syntaxe générale des variables d'environnement Convex ; cette note documente uniquement pourquoi elle est optionnelle ici — l'action doit pouvoir être déployée avant que la clé soit configurée, et échoue proprement avec un message clair sinon (`"FIRECRAWL_API_KEY is not set..."`).

## Pour ajouter une nouvelle régie

1. Seed via `convex/seed.ts:seedAgency` (voir skill officiel `convex-seed` pour la syntaxe générale de seed Convex).
2. Vérifier manuellement que `listingsUrl` renvoie bien une page listant plusieurs annonces (pas une page de détail unique).
3. Lancer `crawlAgency` une première fois et inspecter `found`/`inserted`/`updated` avant de considérer la régie comme opérationnelle.
