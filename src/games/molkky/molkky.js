import { createPlayerBoard, attachLogToggle } from '../../shared/player-board.js';
import { createGamesHistory, pickLeader } from '../../shared/games-history.js';

const MARKUP = `
<div class="wrap">

  <div class="brand">
    <h1>Mölkky<span class="dot">.</span></h1>
    <div class="header-actions" id="headerActions">
      <button class="icon-btn-sm" id="gamesHistoryBtn" title="Historique des parties">🕓</button>
      <button class="icon-btn-sm hidden" id="placementBtn" title="Placement de départ des quilles">📐</button>
      <button class="icon-btn-sm hidden" id="undoBtn" title="Annuler le dernier lancer">↩︎</button>
      <button class="icon-btn-sm hidden" id="rematchBtn" title="Réinitialiser (mêmes joueurs)">🔁</button>
      <button class="icon-btn-sm hidden" id="newGameBtn" title="Nouvelle partie">🆕</button>
      <button class="theme-toggle" id="themeToggle" aria-label="Changer le thème">☾/☀</button>
    </div>
  </div>

  <!-- GAME -->
  <div id="gameScreen">
    <div class="scoreboard" id="scoreboard"></div>

    <div class="empty hidden" id="emptyState">Ajoute un joueur pour commencer la partie 👇</div>

    <div id="throwControls">
      <p class="section-label">Une seule quille touchée</p>
      <div class="quille-grid" id="quilleGrid"></div>

      <p class="section-label">Plusieurs quilles touchées</p>
      <div class="multi-grid" id="multiGrid"></div>

      <button class="log-toggle" id="logToggle">▸ Historique des lancers</button>
      <div class="log" id="log"></div>
    </div>
  </div>

  <!-- WINNER -->
  <div id="winnerScreen" class="card winner-card hidden">
    <div class="trophy">🏆</div>
    <h2 id="winnerName">—</h2>
    <p>termine la partie avec 50 points pile.</p>
    <button class="primary-btn" id="playAgainBtnSame">Rejouer (mêmes joueurs)</button>
    <button class="secondary-btn" id="playAgainBtn">Changer les joueurs</button>
  </div>

</div>

<div id="placementOverlay" class="modal-overlay hidden">
  <div class="modal-card placement-card">
    <h3 class="modal-title">Placement de départ</h3>
    <svg viewBox="0 0 300 260" class="placement-svg" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="248" x2="280" y2="248" stroke="var(--ink-soft)" stroke-width="2" stroke-dasharray="6 5"/>
      <text x="150" y="243" text-anchor="middle" font-size="11" fill="var(--ink-soft)" font-family="Inter, sans-serif">ligne de lancer · 3–4 m</text>
      <g font-family="Fraunces, serif" font-weight="600" font-size="15" text-anchor="middle">
        <circle cx="120" cy="220" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="120" y="225" fill="var(--ink)">1</text>
        <circle cx="180" cy="220" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="180" y="225" fill="var(--ink)">2</text>
        <circle cx="90" cy="165" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="90" y="170" fill="var(--ink)">3</text>
        <circle cx="150" cy="165" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="150" y="170" fill="var(--ink)">10</text>
        <circle cx="210" cy="165" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="210" y="170" fill="var(--ink)">4</text>
        <circle cx="60" cy="105" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="60" y="110" fill="var(--ink)">11</text>
        <circle cx="120" cy="105" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="120" y="110" fill="var(--ink)">12</text>
        <circle cx="180" cy="105" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="180" y="110" fill="var(--ink)">5</text>
        <circle cx="240" cy="105" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="240" y="110" fill="var(--ink)">6</text>
        <circle cx="90" cy="45" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="90" y="50" fill="var(--ink)">7</text>
        <circle cx="150" cy="45" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="150" y="50" fill="var(--ink)">9</text>
        <circle cx="210" cy="45" r="17" fill="var(--surface-2)" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="210" y="50" fill="var(--ink)">8</text>
      </g>
    </svg>
    <p class="modal-message">Les quilles sont placées serrées les unes contre les autres, à 3 à 4 mètres de la ligne de lancer.</p>
    <button class="modal-ok" id="placementClose">Fermer</button>
  </div>
</div>

<div id="modalOverlay" class="modal-overlay hidden">
  <div class="modal-card">
    <p class="modal-icon" id="modalIcon">⚠️</p>
    <h3 class="modal-title" id="modalTitle">—</h3>
    <p class="modal-message" id="modalMessage">—</p>
    <div class="modal-actions">
      <button class="modal-cancel" id="modalCancel">Annuler la pénalité</button>
      <button class="modal-ok" id="modalOk">Confirmer</button>
    </div>
  </div>
</div>
`;

export default function initMolkky(container) {
  container.innerHTML = MARKUP;

  const STORAGE_KEY = 'molkky-state-v1';
  const THEME_KEY = 'molkky-theme';
  const GAMES_HISTORY_KEY = 'molkky-games-history-v1';
  const gamesHistory = createGamesHistory({
    container,
    button: container.querySelector('#gamesHistoryBtn'),
    storageKey: GAMES_HISTORY_KEY
  });

  let state = loadState() || freshState();
  let history = []; // stack of state snapshots for undo

  function freshState() {
    return {
      phase: 'playing', // playing | won
      players: [],   // {name, score, misses}
      currentIndex: 0,
      winnerIndex: null,
      log: [] // {playerName, label, points}
    };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function pushHistory() {
    history.push(JSON.parse(JSON.stringify(state)));
    if (history.length > 100) history.shift();
  }

  // ---------- THEME ----------
  const themeToggle = container.querySelector('#themeToggle');
  function applyTheme(t) {
    if (t) container.setAttribute('data-theme', t);
    else container.removeAttribute('data-theme');
  }
  (function initTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) applyTheme(saved);
    } catch (e) {}
  })();
  themeToggle.addEventListener('click', () => {
    const current = container.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : (current === 'light' ? null : 'dark');
    applyTheme(next);
    try {
      if (next) localStorage.setItem(THEME_KEY, next);
      else localStorage.removeItem(THEME_KEY);
    } catch (e) {}
  });

  // ---------- GAME SCREEN ----------
  const scoreboard = container.querySelector('#scoreboard');
  const emptyState = container.querySelector('#emptyState');
  const throwControls = container.querySelector('#throwControls');
  const quilleGrid = container.querySelector('#quilleGrid');
  const multiGrid = container.querySelector('#multiGrid');
  const undoBtn = container.querySelector('#undoBtn');
  const logToggle = container.querySelector('#logToggle');
  const logEl = container.querySelector('#log');
  const rematchBtn = container.querySelector('#rematchBtn');
  const newGameBtn = container.querySelector('#newGameBtn');
  const playAgainBtnSame = container.querySelector('#playAgainBtnSame');
  const playAgainBtn = container.querySelector('#playAgainBtn');
  const winnerName = container.querySelector('#winnerName');
  const modalOverlay = container.querySelector('#modalOverlay');
  const modalIcon = container.querySelector('#modalIcon');
  const modalTitle = container.querySelector('#modalTitle');
  const modalMessage = container.querySelector('#modalMessage');
  const modalOk = container.querySelector('#modalOk');
  const modalCancel = container.querySelector('#modalCancel');
  const placementBtn = container.querySelector('#placementBtn');
  const placementOverlay = container.querySelector('#placementOverlay');
  const placementClose = container.querySelector('#placementClose');

  let pendingResolve = null;
  function showPenaltyModal(icon, title, message, onResolve) {
    pendingResolve = onResolve;
    modalIcon.textContent = icon;
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalOverlay.classList.remove('hidden');
  }
  function resolveModal(confirmed) {
    modalOverlay.classList.add('hidden');
    const resolve = pendingResolve;
    pendingResolve = null;
    if (resolve) resolve(confirmed);
  }
  modalOk.addEventListener('click', () => resolveModal(true));
  modalCancel.addEventListener('click', () => resolveModal(false));

  placementBtn.addEventListener('click', () => placementOverlay.classList.remove('hidden'));
  placementClose.addEventListener('click', () => placementOverlay.classList.add('hidden'));

  // build 1..12 single-quille grid once
  for (let n = 1; n <= 12; n++) {
    const btn = document.createElement('button');
    btn.className = 'quille-btn';
    btn.textContent = n;
    btn.addEventListener('click', () => applyThrow('Quille ' + n, n));
    quilleGrid.appendChild(btn);
  }

  // build the multi-grid: "Raté" tile first, then 2..12
  const missTileBtn = document.createElement('button');
  missTileBtn.className = 'multi-btn miss-tile';
  missTileBtn.textContent = 'Raté';
  missTileBtn.addEventListener('click', () => applyThrow('Raté', 0));
  multiGrid.appendChild(missTileBtn);

  for (let n = 2; n <= 12; n++) {
    const btn = document.createElement('button');
    btn.className = 'multi-btn';
    btn.textContent = n;
    btn.addEventListener('click', () => applyThrow(n + ' quilles', n));
    multiGrid.appendChild(btn);
  }

  undoBtn.addEventListener('click', () => {
    if (history.length === 0) return;
    state = history.pop();
    saveState();
    render();
  });

  attachLogToggle(logToggle, logEl, 'Historique des lancers');

  newGameBtn.addEventListener('click', resetToSetup);
  playAgainBtn.addEventListener('click', resetToSetup);
  rematchBtn.addEventListener('click', rematchSamePlayers);
  playAgainBtnSame.addEventListener('click', rematchSamePlayers);

  function maybeRecordUnfinishedGame() {
    if (state.phase !== 'playing') return; // no active game, or already recorded via a win
    if (state.players.length === 0) return;
    const hasActivity = state.players.some(p => p.score > 0 || p.misses > 0) || state.log.length > 0;
    if (!hasActivity) return;
    gamesHistory.record(pickLeader(state.players).name, state.players);
  }

  function resetToSetup() {
    maybeRecordUnfinishedGame();
    state = freshState();
    history = [];
    saveState();
    render();
  }

  function rematchSamePlayers() {
    maybeRecordUnfinishedGame();
    state.players = state.players.map(p => ({ name: p.name, score: 0, misses: 0 }));
    state.currentIndex = 0;
    state.phase = 'playing';
    state.winnerIndex = null;
    state.log = [];
    history = [];
    saveState();
    render();
  }

  function nextIndex(fromIndex) {
    const n = state.players.length;
    if (n === 0) return 0;
    return (fromIndex + 1) % n;
  }

  const playerBoard = createPlayerBoard({
    container: scoreboard,
    getPlayers: () => state.players,
    getCurrentIndex: () => state.currentIndex,
    setCurrentIndex: (i) => { state.currentIndex = i; },
    newPlayer: () => ({ score: 0, misses: 0 }),
    renderStat: (p) => `<div class="chip-miss-dots">${[0, 1, 2].map((d) => `<span class="chip-miss-dot${d < p.misses ? ' filled' : ''}"></span>`).join('')}</div>`,
    beforeChange: () => pushHistory(),
    afterChange: () => { saveState(); render(); }
  });

  function applyThrow(label, points) {
    if (state.phase !== 'playing' || state.players.length === 0) return;
    pushHistory();

    const player = state.players[state.currentIndex];
    let penalty = null; // { type: 'tie'|'miss3', target, before, after }

    if (points === 0) {
      player.misses += 1;
      if (player.misses >= 3) {
        const before = player.score;
        const after = before < 25 ? 0 : 25;
        penalty = { type: 'miss3', target: player, before, after };
      }
      player.misses = player.misses >= 3 ? 0 : player.misses;
    } else {
      player.misses = 0;
      player.score += points;
      if (player.score > 50) {
        player.score = 25;
      }

      if (player.score !== 50) {
        const opponent = state.players.find((p, i) => i !== state.currentIndex && p.score === player.score);
        if (opponent) {
          const before = opponent.score;
          const after = before < 25 ? 0 : 25;
          penalty = { type: 'tie', target: opponent, before, after };
        }
      }
    }

    if (penalty) {
      penalty.target.score = penalty.after;
      const title = penalty.type === 'tie' ? 'Égalité de score' : 'Trois ratés';
      const icon = penalty.type === 'tie' ? '🎯' : '🚫';
      const message = penalty.type === 'tie'
        ? (player.name + ' rejoint ' + penalty.target.name + ' à ' + penalty.before + ' points. Pénalité pour ' + penalty.target.name + ' : retombe à ' + penalty.after + ' point' + (penalty.after === 1 ? '' : 's') + '.')
        : (player.name + ' a raté trois lancers d\'affilée. Pénalité : retombe à ' + penalty.after + ' point' + (penalty.after === 1 ? '' : 's') + '.');

      showPenaltyModal(icon, title, message, (confirmed) => {
        if (confirmed) {
          state.log.push({ playerName: penalty.target.name, label: penalty.type === 'tie' ? 'Pénalité (égalité)' : 'Pénalité (3 ratés)', points: 0, resultScore: penalty.after });
        } else {
          penalty.target.score = penalty.before;
        }
        finalizeThrow(player, label, points);
      });
      render();
    } else {
      finalizeThrow(player, label, points);
    }
  }

  function finalizeThrow(player, label, points) {
    state.log.push({ playerName: player.name, label, points, resultScore: player.score });

    if (player.score === 50) {
      state.phase = 'won';
      state.winnerIndex = state.currentIndex;
      gamesHistory.record(player.name, state.players);
      saveState();
      render();
      return;
    }

    state.currentIndex = nextIndex(state.currentIndex);
    saveState();
    render();
  }

  function render() {
    container.querySelector('#gameScreen').classList.toggle('hidden', state.phase !== 'playing');
    container.querySelector('#winnerScreen').classList.toggle('hidden', state.phase !== 'won');

    const showHeaderActions = state.phase === 'playing';
    placementBtn.classList.toggle('hidden', !showHeaderActions);
    undoBtn.classList.toggle('hidden', !showHeaderActions);
    rematchBtn.classList.toggle('hidden', !showHeaderActions);
    newGameBtn.classList.toggle('hidden', !showHeaderActions);

    if (state.phase === 'won') {
      const w = state.players[state.winnerIndex];
      winnerName.textContent = w ? w.name : '—';
      return;
    }

    // playing
    emptyState.classList.toggle('hidden', state.players.length > 0);
    throwControls.classList.toggle('hidden', state.players.length === 0);

    playerBoard.render();

    undoBtn.style.opacity = history.length === 0 ? '0.5' : '1';

    logEl.innerHTML = '';
    [...state.log].reverse().forEach(entry => {
      const item = document.createElement('div');
      item.className = 'log-item';
      const left = document.createElement('span');
      left.innerHTML = '<b>' + entry.playerName + '</b> · ' + entry.label;
      const right = document.createElement('span');
      right.textContent = entry.points === 0 ? '+0' : '+' + entry.points;
      item.appendChild(left);
      item.appendChild(right);
      logEl.appendChild(item);
    });
  }

  render();
}
