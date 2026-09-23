import { createPlayerBoard, attachLogToggle } from '../../shared/player-board.js';
import { createGamesHistory, pickLeader } from '../../shared/games-history.js';

const MARKUP = `
<div class="wrap">
  <div class="brand">
    <h1>Compteur libre<span class="dot">.</span></h1>
    <div class="header-actions">
      <button class="icon-btn-sm" id="gamesHistoryBtn" title="Historique des parties">🕓</button>
      <button class="icon-btn-sm" id="infoBtn" title="Comment ça marche">ℹ️</button>
      <button class="icon-btn-sm" id="undoBtn" title="Annuler la dernière action">↩︎</button>
      <button class="icon-btn-sm" id="resetScoresBtn" title="Remettre les scores à zéro">🔄</button>
      <button class="icon-btn-sm danger" id="resetAllBtn" title="Tout réinitialiser">🗑</button>
    </div>
  </div>

  <div class="scoreboard" id="scoreboard"></div>

  <div id="actionZone">
    <p class="section-label" id="activeLabel">Ajoute un joueur pour commencer</p>

    <div class="tile-grid">
      <button class="tile-btn" data-points="1">+1</button>
      <button class="tile-btn" data-points="5">+5</button>
      <button class="tile-btn" data-points="10">+10</button>
      <button class="tile-btn" data-points="50">+50</button>
    </div>
    <div class="tile-grid tile-grid-minor">
      <button class="tile-btn tile-btn-minor" data-points="-1">−1</button>
      <button class="tile-btn tile-btn-minor" data-points="-5">−5</button>
      <button class="tile-btn tile-btn-minor" data-points="-10">−10</button>
    </div>

    <div class="custom-row">
      <input type="number" inputmode="numeric" placeholder="Montant libre" id="customInput">
      <button id="customAddBtn">Ajouter</button>
    </div>

    <p class="section-label">Compteur secondaire (ratés, malus, tours…)</p>
    <div class="stepper">
      <button class="stepper-btn" id="extraMinusBtn">−</button>
      <span class="stepper-value" id="extraValue">0</span>
      <button class="stepper-btn" id="extraPlusBtn">+</button>
    </div>
  </div>

  <button class="log-toggle" id="logToggle">▸ Historique</button>
  <div class="log" id="log"></div>
</div>

<div id="infoOverlay" class="modal-overlay hidden">
  <div class="modal-card">
    <h3 class="modal-title">Comment ça marche</h3>
    <p class="modal-message">Ajoute les joueurs, touche la tuile d'un joueur pour l'activer (elle se surligne), puis utilise les tuiles de points pour ajouter ou retirer des points au joueur actif. Le compteur secondaire sert pour tout ce qui se compte à côté du score : ratés, malus, tours passés… Glisse une tuile de joueur par sa poignée (⠿) pour changer l'ordre de passage.</p>
    <button class="modal-ok" id="infoClose">Fermer</button>
  </div>
</div>
`;

export default function initLibre(container) {
  container.innerHTML = MARKUP;

  const STORAGE_KEY = 'libre-state-v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players)) return parsed;
      return null;
    } catch (e) { return null; }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  let state = loadState() || { players: [], currentIndex: 0, log: [], history: [] };
  if (typeof state.currentIndex !== 'number') state.currentIndex = 0;
  state.players.forEach((p) => { if (typeof p.extra !== 'number') p.extra = 0; });

  const scoreboard = container.querySelector('#scoreboard');
  const activeLabel = container.querySelector('#activeLabel');
  const extraValue = container.querySelector('#extraValue');
  const logEl = container.querySelector('#log');
  const infoBtn = container.querySelector('#infoBtn');
  const infoOverlay = container.querySelector('#infoOverlay');
  const infoClose = container.querySelector('#infoClose');
  const undoBtn = container.querySelector('#undoBtn');

  infoBtn.addEventListener('click', () => infoOverlay.classList.remove('hidden'));
  infoClose.addEventListener('click', () => infoOverlay.classList.add('hidden'));

  const gamesHistory = createGamesHistory({
    container,
    button: container.querySelector('#gamesHistoryBtn'),
    storageKey: 'libre-games-history-v1'
  });

  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function pushHistory() {
    state.history = state.history || [];
    state.history.push(JSON.stringify({ players: state.players, currentIndex: state.currentIndex, log: state.log }));
    if (state.history.length > 30) state.history.shift();
  }

  function undo() {
    if (!state.history || state.history.length === 0) return;
    const prev = JSON.parse(state.history.pop());
    state.players = prev.players;
    state.currentIndex = prev.currentIndex;
    state.log = prev.log;
    saveState();
    render();
  }

  function currentPlayer() {
    if (state.players.length === 0) return null;
    if (state.currentIndex >= state.players.length) state.currentIndex = 0;
    return state.players[state.currentIndex];
  }

  function addLog(text, delta) {
    state.log = state.log || [];
    state.log.unshift({ text, delta });
    if (state.log.length > 40) state.log.length = 40;
  }

  const playerBoard = createPlayerBoard({
    container: scoreboard,
    getPlayers: () => state.players,
    getCurrentIndex: () => state.currentIndex,
    setCurrentIndex: (i) => { state.currentIndex = i; },
    newPlayer: () => ({ score: 0, extra: 0 }),
    renderStat: (p) => `<p class="chip-extra${p.extra > 0 ? ' has-some' : ''}">${p.extra} supp.</p>`,
    beforeChange: () => pushHistory(),
    afterChange: () => { saveState(); render(); }
  });

  function selectPlayer(index) {
    if (index < 0 || index >= state.players.length) return;
    if (index === state.currentIndex) return;
    state.currentIndex = index;
    saveState();
    render();
  }

  function applyPoints(amount) {
    const p = currentPlayer();
    if (!p || !amount) return;
    pushHistory();
    p.score += amount;
    addLog(p.name + (amount > 0 ? ' +' + amount : ' ' + amount), amount);
    saveState();
    render();
  }

  function adjustExtra(delta) {
    const p = currentPlayer();
    if (!p) return;
    pushHistory();
    p.extra = Math.max(0, p.extra + delta);
    addLog(p.name + ' — compteur secondaire ' + (delta > 0 ? '+1' : '−1'), 0);
    saveState();
    render();
  }

  container.querySelectorAll('[data-points]').forEach((btn) => {
    btn.addEventListener('click', () => applyPoints(parseInt(btn.getAttribute('data-points'), 10)));
  });
  container.querySelector('#customAddBtn').addEventListener('click', () => {
    const input = container.querySelector('#customInput');
    const raw = parseInt(input.value, 10);
    if (!isNaN(raw) && raw !== 0) {
      applyPoints(raw);
      input.value = '';
    }
  });
  container.querySelector('#customInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') container.querySelector('#customAddBtn').click();
  });
  container.querySelector('#extraPlusBtn').addEventListener('click', () => adjustExtra(1));
  container.querySelector('#extraMinusBtn').addEventListener('click', () => adjustExtra(-1));

  function maybeRecordGame() {
    const hasActivity = state.players.some((p) => p.score !== 0 || p.extra !== 0);
    if (!hasActivity) return;
    gamesHistory.record(pickLeader(state.players).name, state.players);
  }

  undoBtn.addEventListener('click', undo);
  container.querySelector('#resetScoresBtn').addEventListener('click', () => {
    if (state.players.length === 0) return;
    maybeRecordGame();
    pushHistory();
    state.players.forEach((p) => { p.score = 0; p.extra = 0; });
    state.log = [];
    saveState();
    render();
  });
  container.querySelector('#resetAllBtn').addEventListener('click', () => {
    maybeRecordGame();
    state = { players: [], currentIndex: 0, log: [], history: [] };
    saveState();
    render();
  });

  attachLogToggle(container.querySelector('#logToggle'), logEl, 'Historique');

  function render() {
    playerBoard.render();

    // Tap anywhere on a player's tile (not its own controls) to make it the active player.
    Array.from(scoreboard.querySelectorAll('.chip')).forEach((chip, i) => {
      if (chip.classList.contains('chip-add')) return;
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.chip-remove, .chip-drag, .chip-name-input')) return;
        selectPlayer(i);
      });
    });

    const p = currentPlayer();
    activeLabel.textContent = p ? ('Joueur actif : ' + p.name) : 'Ajoute un joueur pour commencer';
    extraValue.textContent = p ? p.extra : 0;

    const hasPlayers = state.players.length > 0;
    container.querySelectorAll('#actionZone .tile-btn, #customAddBtn, #customInput, .stepper-btn').forEach((el) => {
      el.disabled = !hasPlayers;
    });

    undoBtn.style.opacity = (state.history && state.history.length > 0) ? '1' : '0.5';

    if (state.log && state.log.length > 0) {
      logEl.innerHTML = state.log.slice(0, 12).map((entry) => {
        const deltaClass = entry.delta > 0 ? 'plus' : (entry.delta < 0 ? 'minus' : '');
        const deltaText = entry.delta === 0 ? '—' : (entry.delta > 0 ? '+' + entry.delta : entry.delta);
        return `<div class="log-item"><span><b>${escapeAttr(entry.text)}</b></span><span class="delta ${deltaClass}">${deltaText}</span></div>`;
      }).join('');
    } else {
      logEl.innerHTML = '';
    }
  }

  render();
}
