# Charte d'un compteur MariuScore2000

Ce document décrit le socle commun que tout jeu (dossier sous `src/games/<id>/`) doit respecter, pour que l'app reste cohérente à mesure que de nouveaux compteurs s'ajoutent. Le thème visuel (couleurs, polices) reste propre à chaque jeu ; c'est la **structure** et les **fonctionnalités** qui sont communes.

Depuis la refonte en brique partagée, ce socle n'est plus qu'une convention à suivre de mémoire : il est **implémenté une seule fois** dans `src/shared/` et utilisé par chaque jeu. Corriger un bug ou améliorer l'UX du scoreboard se fait à un seul endroit, pour tous les jeux à la fois.

- `src/shared/player-board.js` — gestion des joueurs (ajout, suppression, renommage, réordonnancement par glissé-déposé) et rendu des tuiles du scoreboard. Voir `createPlayerBoard()` et `attachLogToggle()`.
- `src/shared/games-history.js` — modale "Historique des parties" (parties terminées, distinct de l'historique des coups d'un jeu) : stockage, liste, suppression d'une entrée, et `pickLeader()` pour désigner un gagnant informel (meilleur score) quand le jeu n'a pas de condition de victoire fixe. Voir `createGamesHistory()`.
- `src/shared/game-ui.css` — styles structurels du header, du scoreboard, de l'historique des coups et de l'historique des parties, pilotés par les variables `--ui-*` que chaque jeu définit sous son propre `.game-<id>` (couleurs/polices uniquement — jamais de mise en page ici).
- `.game-root` — classe posée par le shell (`src/shell/app.js`) sur le conteneur de chaque jeu monté ; c'est elle que `game-ui.css` cible, pas `.game-<id>`. Un jeu n'a rien à faire pour l'obtenir.

Mölkky, Le 5000 et Compteur libre (`src/games/*/`) sont les trois implémentations de référence : en cas de doute, regarder comment elles branchent `createPlayerBoard` et `createGamesHistory`.

## Disposition de l'écran de jeu

Dans cet ordre, du haut vers le bas :

1. **Header** (`.brand`) — titre du jeu à gauche, rangée d'icônes d'action à droite (`.header-actions` + `.icon-btn-sm`), défilable horizontalement si besoin. Toute action secondaire (annuler, nouvelle partie, réinitialiser, thème, aide/règles) est une icône ici, jamais un bouton pleine largeur dans le corps de la page.
2. **Scoreboard** (`.scoreboard`, fourni par `createPlayerBoard`) — une rangée horizontale de tuiles "chip", une par joueur : nom (éditable au clic), score, et un indicateur secondaire propre au jeu si pertinent (ratés, quequettes, etc.) via l'option `renderStat`. Le chip du joueur actif est mis en évidence (`.chip.active`). La dernière tuile de la rangée est toujours "+ Joueur" — pas de formulaire séparé.
3. **Zone d'action du jeu** — les contrôles spécifiques au jeu pour enregistrer un coup/tour. Le motif par défaut est une grille de tuiles carrées (`.quille-grid`/`.tile-grid` selon le jeu) ; on l'adapte au vocabulaire du jeu mais on garde le langage visuel "tuile carrée, gros chiffre, retour tactile au clic".
4. **Historique des coups** — une liste des actions passées, repliée par défaut, ouverte par un bouton texte `▸ Historique …` / `▾ Historique …` (via `attachLogToggle`, pas un `<details>` natif). Les entrées les plus récentes en premier.

Le header porte aussi une icône 🕓 "Historique des parties" (`createGamesHistory`) — une modale listant les parties terminées (gagnant + scores finaux), distincte de l'historique des coups. Chaque jeu décide *quand* une partie est considérée terminée et appelle `.record(winnerName, players)` à ce moment-là.

Toute information annexe (règles du jeu, schéma de placement, aide) est une **modale** ouverte depuis une icône du header — jamais un bloc de texte permanent dans le corps de la page.

## Fonctionnalités attendues sur chaque compteur

Toutes fournies par `createPlayerBoard` — un jeu qui l'utilise les a automatiquement :

- **Renommage** : cliquer sur le nom d'un joueur dans le scoreboard le transforme en champ texte ; `Enter` ou perte de focus valide, `Échap` annule.
- **Réordonnancement par glissé-déposé** : chaque chip a une poignée de glissé (souris et tactile, via Pointer Events — jamais l'API HTML5 Drag and Drop, mal supportée au toucher). Le joueur actif reste le même après réordonnancement : il est retrouvé par son `id`, jamais par sa position dans le tableau. Attention en cas de modification : la capture du pointeur (`setPointerCapture`) doit être posée sur le même élément que les écouteurs `pointermove`/`pointerup` (la poignée), jamais sur la tuile — sinon les événements réels sont redirigés vers la tuile et n'atteignent plus les écouteurs après le premier contact (bug déjà rencontré une fois, corrigé une fois pour toutes ici).
- **Ajout / suppression de joueur** : la tuile "+ Joueur" crée un joueur nommé "Joueur N" et ouvre aussitôt son renommage ; chaque tuile a une suppression explicite (✕).
- **Annulation du dernier coup** (`undo`) via une pile d'instantanés de l'état, accessible depuis le header — reste à la charge de chaque jeu (dépend de ce qu'il faut annuler).

## Historique des parties (quand appeler `.record()`)

Tout jeu utilise `createGamesHistory` et enregistre une partie terminée à *chaque* occasion pertinente, pas seulement à la victoire formelle — sinon une partie interrompue en cours de route disparaît sans laisser de trace :

- **Le jeu a une condition de victoire nette** (Mölkky : 50 points pile ; Le 5000 : 5000 points) → enregistrer dès que la condition est atteinte, avec une garde (`state.gameRecorded` ou équivalent) pour ne pas ré-enregistrer à chaque coup suivant tant que personne n'a remis les scores à zéro.
- **Réinitialisation manuelle avant qu'une victoire soit atteinte** (boutons "Nouvelle partie" / "Tout réinitialiser") → enregistrer quand même s'il y a eu de l'activité (au moins un score non nul), en désignant le meneur via `pickLeader()`. Sauter cet enregistrement si la partie vient déjà d'être enregistrée par une victoire formelle.
- **Le jeu n'a aucune condition de victoire** (Compteur libre) → enregistrer à chaque remise à zéro (scores ou totale) s'il y a eu de l'activité, toujours via `pickLeader()`.

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

Voir le [README](README.md#ajouter-un-nouveau-jeu) pour la forme exacte du `manifest.js`. En résumé : `mount(container)` injecte son propre CSS/police puis délègue à son module de logique ; `unmount()` retire ce qu'il a injecté. Rien d'autre ne doit fuiter hors du conteneur du jeu (pas de style sur `body`/`:root`, tout est scopé sous `.game-<id>` pour le thème et `.game-root` pour la disposition partagée).
