import './shell.css';
import { renderHome } from './home.js';

const manifestModules = import.meta.glob('../games/*/manifest.js', { eager: true });
const games = Object.values(manifestModules)
  .map((mod) => mod.default)
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

const root = document.getElementById('app');
let activeGame = null;
let activeGameContainer = null;

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('game/')) {
    return { name: 'game', gameId: hash.slice('game/'.length) };
  }
  return { name: 'home' };
}

function goHome() {
  window.location.hash = '#/';
}

async function render() {
  if (activeGame && typeof activeGame.unmount === 'function' && activeGameContainer) {
    activeGame.unmount(activeGameContainer);
  }
  activeGame = null;
  activeGameContainer = null;
  root.innerHTML = '';

  const route = parseRoute();

  if (route.name === 'home') {
    document.title = 'MariuScore2000';
    renderHome(root, games, (gameId) => {
      window.location.hash = `#/game/${gameId}`;
    });
    return;
  }

  const manifest = games.find((g) => g.id === route.gameId);
  if (!manifest) {
    goHome();
    return;
  }

  document.title = `${manifest.name} — MariuScore2000`;

  const backBar = document.createElement('div');
  backBar.className = 'game-back-bar';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'back-btn';
  backBtn.textContent = '← Accueil';
  backBtn.addEventListener('click', goHome);
  backBar.appendChild(backBtn);

  const gameContainer = document.createElement('div');
  gameContainer.className = `game-screen game-${manifest.id}`;

  root.appendChild(backBar);
  root.appendChild(gameContainer);

  activeGame = manifest;
  activeGameContainer = gameContainer;

  await manifest.mount(gameContainer);
}

window.addEventListener('hashchange', render);
render();
