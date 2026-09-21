# MariuScore2000

Application web installable (PWA) qui centralise plusieurs compteurs de points pour jeux de société. Un shell neutre affiche la liste des jeux disponibles ; chaque jeu est un module autonome avec son propre thème visuel et sa propre sauvegarde locale.

Jeux inclus : **Mölkky** et **Le 5000**.

Voir le [cahier des charges](https://claude.ai/artifact/Hsh9BR1EjSaJCyV3TA8fkt) pour le détail de l'architecture et des décisions de conception.

## Développement

```bash
npm install
npm run dev
```

## Build de production

```bash
npm run build
npm run preview
```

## Ajouter un nouveau jeu

1. Créer un dossier sous `src/games/<id>/`.
2. Y ajouter un `manifest.js` exportant `{ id, name, icon, description, themeColor, mount(container), unmount() }`.
3. Le jeu apparaît automatiquement sur l'écran d'accueil — rien d'autre à modifier.

Convention de stockage : chaque jeu utilise sa propre clé `localStorage` préfixée par son `id` (ex. `<id>-state-v1`), et garde si possible une forme minimale commune (`players: [{ name, score }]`, `log: [...]`) pour faciliter une éventuelle vue d'ensemble multi-jeux plus tard.

## Déploiement

Le déploiement sur GitHub Pages est automatisé via `.github/workflows/deploy.yml` à chaque push sur `main`.
