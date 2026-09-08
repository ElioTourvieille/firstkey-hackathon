---
name: origin-studio-hackathon-workflow
description: Version allégée et adaptée hackathon de la méthode agentique Origin Studio — discipline de session, plan avant écriture, branches/PR, sans la lourdeur de revue complète d'un projet client. Charger en toile de fond sur tout projet de hackathon Origin Studio, quel que soit l'outil métier concerné (Convex, Next.js, Python...). Ne pas confondre avec la version complète destinée aux projets clients réels — plus stricte sur la revue de code, la sécurité et l'analytics.
---

# Méthode Origin Studio — édition hackathon

> Version compressée de la méthode complète (cadrage produit → skills/agents.md → boucle feature par feature → analytics → sécurité → scale), pensée pour un time-box de 24-72h où la cérémonie complète (revue automatisée sur chaque PR, deep scan de sécurité, dashboards analytics) coûterait plus de temps qu'elle n'en fait gagner.

## Ce qu'on garde absolument

- **AGENTS.md à jour** — c'est la partie la moins chère à maintenir et celle qui évite le plus de retravail (éviter qu'un agent reconstruise le matching en supposant un critère jamais validé, par exemple).
- **Plan avant code pour toute feature non triviale** — un prompt d'implémentation court dans `/prompts/`, même sans validation formelle longue : au minimum une confirmation explicite avant d'exécuter, jamais un enchaînement silencieux.
- **Validation humaine avant toute écriture réelle en base ou tout envoi externe** (premier seed volumineux, premier email à une vraie régie) — c'est le seul type d'erreur qu'on ne peut pas défaire pendant une démo.
- **Une feature = une session de chat** pour éviter le "context rot" — même en hackathon, une session qui traîne sur 3 features produit un code plus incohérent qu'un redémarrage propre.
- **Branche + commit lisible par feature** — même en solo, ça permet de revenir en arrière vite si une feature casse le build juste avant la deadline, et ça donne un historique défendable devant le jury.

## Ce qu'on allège volontairement

- Pas de revue de code automatisée obligatoire sur chaque PR (CodeRabbit ou équivalent) — un `npm run build` + relecture rapide suffit pour un prototype de démo.
- Pas de deep scan de sécurité — seulement les garde-fous d'architecture qui coûtent cher s'ils sautent : pas d'API tierce payante appelée sans limite, pas de donnée sensible qui fuite par une query publique mal scopée.
- Pas de plan de tracking analytics formel — un hackathon se juge à la démo, pas au funnel produit. Si du temps reste après la feature démontrable, un outil léger peut s'ajouter, jamais avant.
- Pas de maquette visuelle obligatoire pour chaque écran — un croquis verbal du layout attendu suffit tant que l'UI reste simple ; réintroduire la maquette dès qu'un écran a plus de 2-3 états.

## Boucle par feature (condensée)

1. Prompt humain court.
2. L'agent inspecte `AGENTS.md` + skills concernés + code existant.
3. Questions ciblées si le scope touche un point ouvert non tranché.
4. Prompt d'implémentation court dans `/prompts/[feature].md`.
5. Validation explicite avant exécution.
6. Implémentation + `typecheck`/`lint`/`build`.
7. Commit sur une branche dédiée, PR, merge après relecture rapide.

## Priorisation en fin de hackathon

Quand le temps presse, l'ordre qui protège le mieux la démo :

1. Un chemin de bout en bout qui marche (même minimal) plutôt que plusieurs features à moitié faites.
2. Le déploiement testé tôt — découvrir un problème d'hébergement statique la veille du rendu est le pire scénario, pas une régie mal crawlée.
3. Un jeu de données de démo réaliste et volumineux (voir le skill Convex officiel `convex-seed`) — un match convaincant a besoin de plusieurs profils et plusieurs listings, pas d'un seul de chaque.
4. Les features "impressionnantes" mais risquées (intégration outreach externe type AgentMail) en dernier, avec un plan de repli (simulation/mock affiché en UI) si le temps manque pour l'intégration réelle.
