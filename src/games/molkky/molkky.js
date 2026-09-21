const MARKUP = `
<div class="wrap">

  <div class="brand">
    <h1>Mölkky<span class="dot">.</span></h1>
    <div class="header-actions" id="headerActions">
      <button class="icon-btn-sm" id="historyBtn" title="Historique des parties">🕓</button>
      <button class="icon-btn-sm hidden" id="placementBtn" title="Placement de départ des quilles">📐</button>
      <button class="icon-btn-sm hidden" id="undoBtn" title="Annuler le dernier lancer">↩︎</button>
      <button class="icon-btn-sm hidden" id="rematchBtn" title="Réinitialiser (mêmes joueurs)">🔁</button>
      <button class="icon-btn-sm hidden" id="newGameBtn" title="Nouvelle partie">🆕</button>
      <button class="theme-toggle" id="themeToggle" aria-label="Changer le thème">☾/☀</button>
    </div>
  </div>

  <!-- SETUP -->
  <div id="setupScreen" class="card">
    <p class="lead">Ajoutez les joueurs, dans l'ordre de passage. Premier à exactement 50 points gagne.</p>
    <div class="player-rows" id="playerRows"></div>

    <button class="primary-btn" id="startBtn">Commencer la partie</button>
  </div>

  <!-- GAME -->
  <div id="gameScreen" class="hidden">
    <div class="scoreboard" id="scoreboard"></div>

    <p class="section-label">Une seule quille touchée</p>
    <div class="quille-grid" id="quilleGrid"></div>

    <p class="section-label">Plusieurs quilles touchées</p>
    <div class="multi-grid" id="multiGrid"></div>

    <button class="log-toggle" id="logToggle">▸ Historique des lancers</button>
    <div class="log" id="log"></div>
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

<div id="historyOverlay" class="modal-overlay hidden">
  <div class="modal-card history-card">
    <h3 class="modal-title">Historique des parties</h3>
    <div class="history-list" id="historyList"></div>
    <div class="history-actions">
      <button class="secondary-btn" id="clearHistoryBtn">Vider l'historique</button>
      <button class="modal-ok" id="historyClose">Fermer</button>
    </div>
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

  let state = loadState() || freshState();
  let history = []; // stack of state snapshots for undo
  let editingPlayerIndex = null; // index of the chip currently being renamed
  let dragState = null; // in-progress chip drag (reorder)

  function freshState() {
    return {
      phase: 'setup', // setup | playing | won
      playerNames: ['', ''],
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

  // ---------- GAME HISTORY (finished games) ----------
  function loadGamesHistory() {
    try {
      const raw = localStorage.getItem(GAMES_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveGamesHistory(list) {
    try { localStorage.setItem(GAMES_HISTORY_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function recordFinishedGame(winnerName) {
    const list = loadGamesHistory();
    list.unshift({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      date: new Date().toISOString(),
      winnerName: winnerName,
      players: state.players.map(p => ({ name: p.name, score: p.score }))
    });
    saveGamesHistory(list.slice(0, 100));
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

  // ---------- SETUP SCREEN ----------
  const playerRows = container.querySelector('#playerRows');
  const startBtn = container.querySelector('#startBtn');

  const addPlayerBtn = document.createElement('button');
  addPlayerBtn.type = 'button';
  addPlayerBtn.className = 'player-row-add';
  addPlayerBtn.textContent = '+ Ajouter un joueur';
  addPlayerBtn.addEventListener('click', () => {
    state.playerNames.push('');
    renderSetup();
    saveState();
  });

  function renderSetup() {
    playerRows.innerHTML = '';
    state.playerNames.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'player-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Joueur ' + (i + 1);
      input.value = name;
      input.addEventListener('input', (e) => {
        state.playerNames[i] = e.target.value;
        updateStartState();
        saveState();
      });
      row.appendChild(input);
      if (state.playerNames.length > 1) {
        const del = document.createElement('button');
        del.className = 'icon-btn';
        del.textContent = '×';
        del.setAttribute('aria-label', 'Retirer ce joueur');
        del.addEventListener('click', () => {
          state.playerNames.splice(i, 1);
          renderSetup();
          saveState();
        });
        row.appendChild(del);
      }
      playerRows.appendChild(row);
    });
    playerRows.appendChild(addPlayerBtn);
    updateStartState();
  }

  function updateStartState() {
    const valid = state.playerNames.filter(n => n.trim().length > 0).length >= 1;
    startBtn.disabled = !valid;
  }

  startBtn.addEventListener('click', () => {
    const names = state.playerNames.map(n => n.trim()).filter(n => n.length > 0);
    if (names.length === 0) return;
    state.players = names.map(n => ({ name: n, score: 0, misses: 0 }));
    state.currentIndex = 0;
    state.phase = 'playing';
    state.winnerIndex = null;
    state.log = [];
    history = [];
    saveState();
    render();
  });

  // ---------- GAME SCREEN ----------
  const scoreboard = container.querySelector('#scoreboard');
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
  const historyBtn = container.querySelector('#historyBtn');
  const historyOverlay = container.querySelector('#historyOverlay');
  const historyClose = container.querySelector('#historyClose');
  const historyList = container.querySelector('#historyList');
  const clearHistoryBtn = container.querySelector('#clearHistoryBtn');

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

  const dateFormatter = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function renderHistoryList() {
    const games = loadGamesHistory();
    historyList.innerHTML = '';
    if (games.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = 'Aucune partie terminée pour l\'instant.';
      historyList.appendChild(empty);
      return;
    }
    games.forEach(game => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const top = document.createElement('div');
      top.className = 'history-item-top';
      const date = document.createElement('span');
      date.className = 'history-date';
      let dateLabel = game.date;
      try { dateLabel = dateFormatter.format(new Date(game.date)); } catch (e) {}
      date.textContent = dateLabel;
      const del = document.createElement('button');
      del.className = 'history-delete';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Supprimer cette partie');
      del.addEventListener('click', () => {
        saveGamesHistory(loadGamesHistory().filter(g => g.id !== game.id));
        renderHistoryList();
      });
      top.appendChild(date);
      top.appendChild(del);

      const players = document.createElement('div');
      players.className = 'history-players';
      game.players
        .slice()
        .sort((a, b) => b.score - a.score)
        .forEach(p => {
          const tag = document.createElement('span');
          tag.className = 'history-player' + (p.name === game.winnerName ? ' winner' : '');
          tag.textContent = p.name + ' ' + p.score;
          players.appendChild(tag);
        });

      item.appendChild(top);
      item.appendChild(players);
      historyList.appendChild(item);
    });
  }

  historyBtn.addEventListener('click', () => {
    renderHistoryList();
    historyOverlay.classList.remove('hidden');
  });
  historyClose.addEventListener('click', () => historyOverlay.classList.add('hidden'));
  clearHistoryBtn.addEventListener('click', () => {
    saveGamesHistory([]);
    renderHistoryList();
  });

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

  logToggle.addEventListener('click', () => {
    logEl.classList.toggle('open');
    logToggle.textContent = (logEl.classList.contains('open') ? '▾' : '▸') + ' Historique des lancers';
  });

  newGameBtn.addEventListener('click', resetToSetup);
  playAgainBtn.addEventListener('click', resetToSetup);
  rematchBtn.addEventListener('click', rematchSamePlayers);
  playAgainBtnSame.addEventListener('click', rematchSamePlayers);

  function resetToSetup() {
    state = freshState();
    history = [];
    saveState();
    render();
  }

  function rematchSamePlayers() {
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
    return (fromIndex + 1) % n;
  }

  function reorderPlayers(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= state.players.length) return;
    toIndex = Math.max(0, Math.min(state.players.length - 1, toIndex));
    pushHistory();
    const currentPlayerRef = state.players[state.currentIndex];
    const [moved] = state.players.splice(fromIndex, 1);
    state.players.splice(toIndex, 0, moved);
    state.currentIndex = state.players.indexOf(currentPlayerRef);
    saveState();
    render();
  }

  // ---------- Drag-to-reorder chips (pointer events: works with mouse and touch) ----------
  // Pointer capture must be set on the SAME element the move/up listeners are attached to
  // (the handle), otherwise events get redirected to the captured element and never reach them.
  function onChipDragStart(e, index) {
    e.preventDefault();
    const handle = e.currentTarget;
    const chip = scoreboard.children[index];
    if (!chip) return;
    const rect = chip.getBoundingClientRect();
    const styles = getComputedStyle(scoreboard);
    const gap = parseFloat(styles.columnGap || styles.gap || '8') || 8;
    dragState = {
      startIndex: index,
      currentIndex: index,
      startX: e.clientX,
      chipWidth: rect.width + gap,
      chip,
      pointerId: e.pointerId
    };
    chip.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  }

  function onChipDragMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startX;
    dragState.chip.style.transform = `translateX(${dx}px)`;
    const shift = Math.round(dx / dragState.chipWidth);
    dragState.currentIndex = Math.min(state.players.length - 1, Math.max(0, dragState.startIndex + shift));
  }

  function onChipDragEnd(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    dragState.chip.classList.remove('dragging');
    dragState.chip.style.transform = '';
    const { startIndex, currentIndex } = dragState;
    dragState = null;
    if (currentIndex !== startIndex) {
      reorderPlayers(startIndex, currentIndex);
    }
  }

  function applyThrow(label, points) {
    if (state.phase !== 'playing') return;
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
      recordFinishedGame(player.name);
      saveState();
      render();
      return;
    }

    state.currentIndex = nextIndex(state.currentIndex);
    saveState();
    render();
  }

  function render() {
    container.querySelector('#setupScreen').classList.toggle('hidden', state.phase !== 'setup');
    container.querySelector('#gameScreen').classList.toggle('hidden', state.phase !== 'playing');
    container.querySelector('#winnerScreen').classList.toggle('hidden', state.phase !== 'won');

    const showHeaderActions = state.phase === 'playing';
    placementBtn.classList.toggle('hidden', !showHeaderActions);
    undoBtn.classList.toggle('hidden', !showHeaderActions);
    rematchBtn.classList.toggle('hidden', !showHeaderActions);
    newGameBtn.classList.toggle('hidden', !showHeaderActions);

    if (state.phase === 'setup') {
      renderSetup();
      return;
    }
    if (state.phase === 'won') {
      const w = state.players[state.winnerIndex];
      winnerName.textContent = w ? w.name : '—';
      return;
    }

    // playing
    scoreboard.innerHTML = '';
    state.players.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (i === state.currentIndex ? ' active' : '');

      if (editingPlayerIndex === i) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'chip-name-input';
        input.value = p.name;
        input.maxLength = 20;
        const commit = () => {
          const trimmed = input.value.trim();
          if (trimmed) p.name = trimmed;
          editingPlayerIndex = null;
          saveState();
          render();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') input.blur();
          if (e.key === 'Escape') { editingPlayerIndex = null; render(); }
        });
        input.addEventListener('click', (e) => e.stopPropagation());
        chip.appendChild(input);
        setTimeout(() => { input.focus(); input.select(); }, 0);
      } else {
        const nameEl = document.createElement('p');
        nameEl.className = 'chip-name';
        nameEl.textContent = p.name;
        nameEl.title = 'Toucher pour renommer';
        nameEl.addEventListener('click', () => {
          editingPlayerIndex = i;
          render();
        });
        chip.appendChild(nameEl);
      }

      const scoreEl = document.createElement('p');
      scoreEl.className = 'chip-score';
      scoreEl.textContent = p.score;
      chip.appendChild(scoreEl);
      const chipDots = document.createElement('div');
      chipDots.className = 'chip-miss-dots';
      for (let d = 0; d < 3; d++) {
        const dot = document.createElement('span');
        dot.className = 'chip-miss-dot' + (d < p.misses ? ' filled' : '');
        chipDots.appendChild(dot);
      }
      chip.appendChild(chipDots);

      const dragHandle = document.createElement('span');
      dragHandle.className = 'chip-drag';
      dragHandle.title = 'Glisser pour réordonner';
      dragHandle.textContent = '⠿';
      dragHandle.addEventListener('pointerdown', (e) => onChipDragStart(e, i));
      dragHandle.addEventListener('pointermove', onChipDragMove);
      dragHandle.addEventListener('pointerup', onChipDragEnd);
      dragHandle.addEventListener('pointercancel', onChipDragEnd);
      chip.appendChild(dragHandle);

      scoreboard.appendChild(chip);
    });

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
