# Design system — firstkey

> Référence visuelle obligatoire pour toute feature UI. Basé sur les 4 (bientôt 5) maquettes validées dans `design/` — voir chaque écran pour le détail, ce fichier résume les décisions transversales pour ne pas avoir à les redéduire à chaque nouvel écran.

## Direction

Swiss Style / grille typographique internationale — précision, calme, confiance. Pas de décoration gratuite : chaque badge, bordure ou chiffre affiché doit correspondre à une donnée réelle (voir "Règle non négociable" plus bas).

## Palette

- Fond : `#F7F7F4` (blanc cassé froid, pas de crème `#F4F1EA`)
- Encre : `#17171A` (jamais de noir pur, jamais de `#0B0B0B`)
- Accent fonctionnel : rouge `#D6362B` — réservé aux signaux live/urgents, jamais décoratif
- Statut "nouveau match" : vert sauge `#2F9E44`
- Statut "en attente de réponse" : ambre `#C88A1A`
- Neutres/bordures : `#E4E4E0`

## Typographie

- Une seule famille grotesque sans (Inter ou équivalent) pour tout le texte d'interface.
- Monospace réservé **uniquement** aux données numériques qui bénéficient d'un alignement tabulaire — prix, nombre de pièces, timestamps. Jamais pour des labels ou du texte de navigation.

## Layout

- Grille stricte, whitespace généreux, colonne principale large + rail latéral étroit pour filtres/statut.
- Coins nets sur photos et cartes principales (précision, pas de mollesse) ; pastilles arrondies réservées aux badges de statut uniquement.
- Alignement à gauche, pas de centrage de blocs de texte.

## Signaux "live"

Un point plein + heure relative ("à l'instant", "il y a 2 min") à côté des éléments récents — jamais de cloche de notification générique. Chaque indicateur "live" doit refléter une vraie fraîcheur de donnée Convex (`_creationTime` ou équivalent), pas une animation décorative.

## Règle non négociable : aucun chiffre ou badge inventé

C'est la correction la plus importante appliquée aux maquettes initiales — à ne jamais réintroduire en codant :

- Pas de badge de certification invoquant une entité réelle (USPI, ASLOCA, LDTR, SEDEX, Swiss Re...) sans intégration réelle correspondante.
- Pas de score de solvabilité, de rang algorithmique, ou de statut "vérifié/authentifié" sur un document — un document déposé par l'utilisateur s'affiche comme "Ajouté", jamais comme validé par un tiers.
- Pas de pourcentage de match, délai de réponse moyen, ou position dans une file d'attente sans calcul réel derrière. Si la donnée n'existe pas encore côté Convex, l'écran ne l'affiche pas — pas de placeholder qui ressemble à une vraie statistique.
- Le nombre de régies affiché doit toujours correspondre au volume réel seedé (actuellement 6), jamais un chiffre aspirationnel.

## Écrans de référence

| Fichier | Écran | Statut de correction |
|---|---|---|
| `design/publicFeed.png` | Flux public (feed sans connexion) | À reconfirmer après le dernier prompt de correction |
| `design/profile.png` | Mon profil de candidat | ✅ Confirmé sur capture fraîche |
| `design/myCorrespondence.png` | Mes correspondances (matching) | À reconfirmer après le dernier prompt de correction |
| `design/messenger.png` | Messagerie régies (inbox) | ✅ Confirmé sur capture fraîche |
| _(mobile feed)_ | Vue mobile du flux public | Non exporté — priorité basse, à faire seulement si le temps le permet |
