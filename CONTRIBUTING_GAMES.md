# Charte d'un compteur MariuScore2000

Ce document décrit le socle commun que tout jeu (dossier sous `src/games/<id>/`) doit respecter, pour que l'app reste cohérente à mesure que de nouveaux compteurs s'ajoutent. Le thème visuel (couleurs, polices) reste propre à chaque jeu ; c'est la **structure** et les **fonctionnalités** qui sont communes.

Mölkky (`src/games/molkky/`) est l'implémentation de référence : en cas de doute, regarder comment elle fait les choses.

## Disposition de l'écran de jeu

Dans cet ordre, du haut vers le bas :

1. **Header** (`.brand`) — titre du jeu à gauche, rangée d'icônes d'action à droite (`.header-actions` + `.icon-btn-sm`), défilable horizontalement si besoin. Toute action secondaire (annuler, nouvelle partie, réinitialiser, thème, aide/règles) est une icône ici, jamais un bouton pleine largeur dans le corps de la page.
2. **Scoreboard** (`.scoreboard`) — une rangée horizontale de tuiles "chip", une par joueur : nom (éditable au clic), score, et un indicateur secondaire propre au jeu si pertinent (ratés, quequettes, etc.) affiché en 3 points comme les dés de vie. Le chip du joueur actif est mis en évidence (`.chip.active`).
3. **Zone d'action du jeu** — les contrôles spécifiques au jeu pour enregistrer un coup/tour. Le motif par défaut est une grille de tuiles carrées (`.quille-grid`/`.tile-grid` selon le jeu) ; on l'adapte au vocabulaire du jeu mais on garde le langage visuel "tuile carrée, gros chiffre, retour tactile au clic".
4. **Historique** — une liste des actions passées, repliée par défaut, ouverte par un bouton texte `▸ Historique …` / `▾ Historique …` (pas un `<details>` natif, pour un style uniforme). Les entrées les plus récentes en premier.

Toute information annexe (règles du jeu, schéma de placement, aide) est une **modale** ouverte depuis une icône du header — jamais un bloc de texte permanent dans le corps de la page.

## Fonctionnalités attendues sur chaque compteur

- **Renommage** : cliquer sur le nom d'un joueur dans le scoreboard le transforme en champ texte ; `Enter` ou perte de focus valide, `Échap` annule.
- **Réordonnancement par glissé-déposé** : chaque chip a une poignée de glissé ; on peut réordonner les joueurs pendant la partie (souris et tactile, via Pointer Events — jamais l'API HTML5 Drag and Drop, mal supportée au toucher). Le joueur actif reste le même après réordonnancement : on le retrouve par son `id`, jamais par sa position dans le tableau.
- **Ajout / suppression de joueur** : possible soit avant la partie (écran de mise en place, comme Mölkky), soit en cours de partie si le jeu le permet (comme Le 5000) — mais dans tous les cas via un formulaire simple (champ + bouton "Ajouter"), et une suppression explicite (✕) plutôt qu'un geste caché.
- **Annulation du dernier coup** (`undo`) via une pile d'instantanés de l'état, accessible depuis le header.
- **Historique des parties terminées** si le jeu a une condition de victoire nette (comme Mölkky) — sinon un historique des coups suffit (comme Le 5000).

## Persistance

- Chaque jeu utilise sa propre clé `localStorage`, préfixée par son `id` (ex. `<id>-state-v1`).
- Forme minimale commune à respecter dans l'état sauvegardé, pour qu'un futur historique inter-jeux reste possible sans migration lourde :
  ```js
  {
    players: [{ name, score /* + champs propres au jeu */ }],
    log: [{ playerName, label, points /* ou delta */ }]
  }
  ```

## Contrat technique (manifest)

Voir le [README](README.md#ajouter-un-nouveau-jeu) pour la forme exacte du `manifest.js`. En résumé : `mount(container)` injecte son propre CSS/police puis délègue à son module de logique ; `unmount()` retire ce qu'il a injecté. Rien d'autre ne doit fuiter hors du conteneur du jeu (pas de style sur `body`/`:root`, tout est scopé sous `.game-<id>`).
