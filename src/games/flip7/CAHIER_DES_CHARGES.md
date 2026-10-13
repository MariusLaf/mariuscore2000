# Cahier des charges — Compteur Flip 7

## Objectif
Compter les points du jeu de cartes **Flip 7** (3 à 18 joueurs) manche après manche, sans calcul mental, avec détection automatique de la fin de partie.

## Rappel des règles utiles au comptage
- Chaque manche, un joueur marque la **somme de ses cartes Nombre** (modificateurs +2…+10 et ×2 inclus, calculés par le joueur à la table).
- **Raté (bust)** : doublon de carte Nombre → 0 point pour la manche.
- **Flip 7** : 7 cartes Nombre différentes → **+15 points** de bonus (la manche s'arrête).
- La partie se termine à la fin de la manche où au moins un joueur atteint **200 points** ; le plus haut score gagne.

## Fonctionnalités
1. **Joueurs** : ajout, suppression, renommage, glisser-déposer (brique partagée `createPlayerBoard`). Le chip "actif" indique le **donneur**, qui tourne à chaque manche.
2. **Saisie d'une manche** : une ligne par joueur avec
   - les points de ses cartes (champ numérique + boutons −/+ ),
   - un bouton **Raté** (force 0 pt),
   - un bouton **Flip 7** (+15 pts, affiché sur la ligne).
   - total de la manche affiché par joueur.
3. **Valider la manche** : ajoute les totaux, incrémente le n° de manche, fait tourner le donneur.
4. **Fin de partie** : si ≥ 200 pts après validation → bandeau de victoire (meilleur score) + enregistrement dans l'historique des parties (une seule fois).
5. **Annuler** la dernière manche (pile d'instantanés).
6. **Nouvelle partie** / **Tout réinitialiser** (avec confirmation, enregistrement de la partie inachevée s'il y a eu de l'activité, via `pickLeader`).
7. **Historique des coups** (replié par défaut) : détail par manche. **Historique des parties** (🕓) et **règles** (ℹ️) en modale.
8. **Persistance** `localStorage` (`flip7-state-v1`, `flip7-games-history-v1`), hors-ligne via la PWA existante.

## Hors périmètre
Gestion des cartes elles-mêmes (pioche, actions Gel / Seconde chance / Trois cartes) : on ne compte que les points.

## Contraintes techniques
Respect de `CONTRIBUTING_GAMES.md` : dossier `src/games/flip7/` (manifest + js + css), thème scopé sous `.game-flip7`, briques `src/shared/*`, aucune modification du shell.
