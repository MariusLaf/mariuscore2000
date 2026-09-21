const MARKUP = `
<div class="wrap">
  <div class="brand">
    <h1>Le 5000<span class="dot">.</span></h1>
    <div class="header-actions">
      <span class="round-chip" id="roundChip">Manche 1</span>
      <button class="icon-btn-sm" id="rulesBtn" title="Règles du compteur">ℹ️</button>
      <button class="icon-btn-sm" id="undoBtn" title="Annuler le dernier tour">↩︎</button>
      <button class="icon-btn-sm" id="resetBtn" title="Nouvelle partie">🔄</button>
      <button class="icon-btn-sm danger" id="resetAllBtn" title="Tout réinitialiser">🗑</button>
    </div>
  </div>

  <div id="winnerZone"></div>

  <div class="scoreboard" id="scoreboard"></div>

  <button class="add-player-btn" id="addPlayerBtn">+ Ajouter un joueur</button>

  <div id="turnZone"></div>

  <button class="log-toggle" id="logToggle">▸ Historique</button>
  <div class="log" id="log"></div>
</div>

<div id="rulesOverlay" class="modal-overlay hidden">
  <div class="modal-card">
    <h3 class="modal-title">Règles du compteur</h3>
    <p class="modal-message">On joue joueur après joueur : ajoute les points du tour, puis "Valider le tour" pour passer au suivant. Tous les 3 coups à vide d'affilée, une pénalité s'applique automatiquement (−200, −400, −600…) — sauf tant que le joueur n'est pas encore entré en jeu (n'a jamais marqué de points). Dès qu'un joueur marque des points, son compteur de quequettes repart à zéro. Glisse une tuile de joueur par sa poignée (⠿) pour changer l'ordre de passage.</p>
    <button class="modal-ok" id="rulesClose">Fermer</button>
  </div>
</div>

<div id="modalZone"></div>
`;

export default function initLe5000(container) {
  container.innerHTML = MARKUP;

  const STORAGE_KEY = 'jeu5000_state_v2';

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(parsed && Array.isArray(parsed.players)) return parsed;
      return null;
    }catch(e){ return null; }
  }

  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ /* storage unavailable, continue silently */ }
  }

  let state = loadState() || { players: [], log: [], history: [], currentIndex: 0, round: 1, pending: 0 };
  if(typeof state.currentIndex !== 'number') state.currentIndex = 0;
  if(typeof state.round !== 'number') state.round = 1;
  if(typeof state.pending !== 'number') state.pending = 0;
  state.pending = Math.max(0, Math.round(state.pending / 100) * 100);
  state.players.forEach(p => { if(typeof p.started !== 'boolean') p.started = p.score > 0; if(typeof p.quequettes !== 'number') p.quequettes = 0; if(typeof p.streak !== 'number') p.streak = 0; });

  let editingPlayerId = null; // id of the chip currently being renamed
  let dragState = null; // in-progress chip drag (reorder)

  const scoreboard = container.querySelector('#scoreboard');
  const turnZone = container.querySelector('#turnZone');
  const winnerZoneEl = container.querySelector('#winnerZone');
  const logEl = container.querySelector('#log');
  const roundChip = container.querySelector('#roundChip');
  const rulesBtn = container.querySelector('#rulesBtn');
  const rulesOverlay = container.querySelector('#rulesOverlay');
  const rulesClose = container.querySelector('#rulesClose');

  rulesBtn.addEventListener('click', () => rulesOverlay.classList.remove('hidden'));
  rulesClose.addEventListener('click', () => rulesOverlay.classList.add('hidden'));

  function showConfirm(message, onConfirm){
    const modalZone = container.querySelector('#modalZone');
    modalZone.innerHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal-box">
          <p>${message}</p>
          <div class="modal-actions">
            <button class="modal-cancel" id="modalCancel">Annuler</button>
            <button class="modal-confirm" id="modalConfirm">Confirmer</button>
          </div>
        </div>
      </div>
    `;
    container.querySelector('#modalCancel').onclick = () => { modalZone.innerHTML = ''; };
    container.querySelector('#modalOverlay').addEventListener('click', (e) => {
      if(e.target.id === 'modalOverlay') modalZone.innerHTML = '';
    });
    container.querySelector('#modalConfirm').onclick = () => {
      modalZone.innerHTML = '';
      onConfirm();
    };
  }

  function uid(){ return Math.random().toString(36).slice(2,9); }
  function round100(n){ return Math.round(n / 100) * 100; }
  function formatScore(n){
    return n.toLocaleString('fr-CH');
  }
  function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

  function pushHistorySnapshot(){
    state.history = state.history || [];
    state.history.push(JSON.stringify({
      players: state.players, log: state.log,
      currentIndex: state.currentIndex, round: state.round, pending: state.pending
    }));
    if(state.history.length > 20) state.history.shift();
  }

  function undo(){
    if(!state.history || state.history.length === 0) return;
    const prev = JSON.parse(state.history.pop());
    state.players = prev.players;
    state.log = prev.log;
    state.currentIndex = prev.currentIndex;
    state.round = prev.round;
    state.pending = prev.pending;
    saveState();
    render();
  }

  function currentPlayer(){
    if(state.players.length === 0) return null;
    if(state.currentIndex >= state.players.length) state.currentIndex = 0;
    return state.players[state.currentIndex];
  }

  function advanceTurn(){
    if(state.players.length === 0) return;
    state.currentIndex += 1;
    if(state.currentIndex >= state.players.length){
      state.currentIndex = 0;
      state.round += 1;
    }
    state.pending = 0;
  }

  function addPlayer(){
    pushHistorySnapshot();
    const player = { id: uid(), name: 'Joueur ' + (state.players.length + 1), score: 0, streak: 0, turns: 0, started: false, quequettes: 0 };
    state.players.push(player);
    editingPlayerId = player.id; // straight into rename mode: the player is named in the tile
    saveState();
    render();
  }

  function removePlayer(id){
    pushHistorySnapshot();
    const idx = state.players.findIndex(p => p.id === id);
    state.players = state.players.filter(p => p.id !== id);
    if(idx !== -1 && idx < state.currentIndex) state.currentIndex -= 1;
    if(state.currentIndex >= state.players.length) state.currentIndex = 0;
    saveState();
    render();
  }

  function renamePlayer(id, name){
    const p = state.players.find(p => p.id === id);
    if(!p) return;
    const trimmed = name.trim();
    if(trimmed) p.name = trimmed;
    saveState();
  }

  function reorderPlayers(fromIndex, toIndex){
    if(fromIndex === toIndex) return;
    if(fromIndex < 0 || fromIndex >= state.players.length) return;
    toIndex = Math.max(0, Math.min(state.players.length - 1, toIndex));
    pushHistorySnapshot();
    const currentId = currentPlayer() ? currentPlayer().id : null;
    const [moved] = state.players.splice(fromIndex, 1);
    state.players.splice(toIndex, 0, moved);
    if(currentId){
      const newIdx = state.players.findIndex(p => p.id === currentId);
      if(newIdx !== -1) state.currentIndex = newIdx;
    }
    saveState();
    render();
  }

  function addLog(text, delta){
    state.log = state.log || [];
    state.log.unshift({ text, delta });
    if(state.log.length > 40) state.log.length = 40;
  }

  function adjustPending(amount){
    state.pending = Math.max(0, round100(state.pending + amount));
    saveState();
    render();
  }

  function validateTurn(){
    const p = currentPlayer();
    if(!p || state.pending <= 0) return;
    pushHistorySnapshot();
    p.score += state.pending;
    p.streak = 0;
    p.quequettes = 0;
    p.turns += 1;
    if(!p.started){
      p.started = true;
      addLog(p.name + ' entre en jeu et marque', state.pending);
    } else {
      addLog(p.name + ' marque', state.pending);
    }
    advanceTurn();
    saveState();
    render();
  }

  function bustTurn(){
    const p = currentPlayer();
    if(!p) return;
    pushHistorySnapshot();
    p.streak += 1;
    p.turns += 1;
    p.quequettes += 1;
    let penalty = 0;
    if(p.started && p.streak % 3 === 0){
      penalty = 200 * (p.streak / 3);
      p.score -= penalty;
    }
    if(penalty > 0){
      addLog(p.name + ' — coup à vide n°' + p.streak + ' d\'affilée (pénalité)', -penalty);
    } else if(!p.started){
      addLog(p.name + ' — coup à vide (' + p.streak + ' d\'affilée, pas encore en jeu, sans pénalité)', 0);
    } else {
      addLog(p.name + ' — coup à vide (' + p.streak + ' d\'affilée)', 0);
    }
    advanceTurn();
    saveState();
    render();
  }

  function resetGame(){
    if(state.players.length === 0) return;
    showConfirm('Démarrer une nouvelle partie ? Les scores actuels seront remis à zéro.', () => {
      pushHistorySnapshot();
      state.players.forEach(p => { p.score = 0; p.streak = 0; p.turns = 0; p.started = false; p.quequettes = 0; });
      state.log = [];
      state.currentIndex = 0;
      state.round = 1;
      state.pending = 0;
      saveState();
      render();
    });
  }

  function resetAll(){
    showConfirm('Tout réinitialiser ? Les joueurs seront supprimés et il faudra recommencer la partie de zéro.', () => {
      state = { players: [], log: [], history: [], currentIndex: 0, round: 1, pending: 0 };
      saveState();
      render();
    });
  }

  const QUICK_VALUES = [100, 200, 500];

  // ---------- Drag-to-reorder chips (pointer events: works with mouse and touch) ----------
  // Pointer capture must be set on the SAME element the move/up listeners are attached to
  // (the handle), otherwise events get redirected to the captured element and never reach them.
  function onChipDragStart(e, index){
    e.preventDefault();
    const handle = e.currentTarget;
    const chip = scoreboard.children[index];
    if(!chip) return;
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

  function onChipDragMove(e){
    if(!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startX;
    dragState.chip.style.transform = `translateX(${dx}px)`;
    const shift = Math.round(dx / dragState.chipWidth);
    dragState.currentIndex = Math.min(state.players.length - 1, Math.max(0, dragState.startIndex + shift));
  }

  function onChipDragEnd(e){
    if(!dragState || e.pointerId !== dragState.pointerId) return;
    dragState.chip.classList.remove('dragging');
    dragState.chip.style.transform = '';
    const { startIndex, currentIndex } = dragState;
    dragState = null;
    if(currentIndex !== startIndex){
      reorderPlayers(startIndex, currentIndex);
    }
  }

  function renderScoreboard(){
    scoreboard.classList.toggle('hidden', state.players.length === 0);
    scoreboard.innerHTML = state.players.map((p, i) => `
      <div class="chip ${i === state.currentIndex ? 'active' : ''}">
        <button class="chip-remove" data-remove="${p.id}" title="Retirer ce joueur">×</button>
        ${editingPlayerId === p.id
          ? `<input type="text" class="chip-name-input" data-editing="${p.id}" value="${escapeAttr(p.name)}" maxlength="20">`
          : `<p class="chip-name" data-rename="${p.id}" title="Toucher pour renommer">${escapeAttr(p.name)}</p>`}
        <p class="chip-score">${formatScore(p.score)}</p>
        <p class="chip-quequettes${p.quequettes > 0 ? ' has-some' : ''}">${p.quequettes} quequette${p.quequettes !== 1 ? 's' : ''}</p>
        <span class="chip-drag" data-drag="${i}" title="Glisser pour réordonner">⠿</span>
      </div>
    `).join('');

    scoreboard.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePlayer(btn.getAttribute('data-remove'));
      });
    });
    scoreboard.querySelectorAll('[data-rename]').forEach(el => {
      el.addEventListener('click', () => {
        editingPlayerId = el.getAttribute('data-rename');
        render();
      });
    });
    scoreboard.querySelectorAll('[data-editing]').forEach(input => {
      const id = input.getAttribute('data-editing');
      const commit = () => {
        const trimmed = input.value.trim();
        if(trimmed) renamePlayer(id, trimmed);
        editingPlayerId = null;
        render();
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') input.blur();
        if(e.key === 'Escape'){ editingPlayerId = null; render(); }
      });
      input.addEventListener('click', (e) => e.stopPropagation());
      setTimeout(() => { input.focus(); input.select(); }, 0);
    });
    scoreboard.querySelectorAll('[data-drag]').forEach(handle => {
      const index = parseInt(handle.getAttribute('data-drag'), 10);
      handle.addEventListener('pointerdown', (e) => onChipDragStart(e, index));
      handle.addEventListener('pointermove', onChipDragMove);
      handle.addEventListener('pointerup', onChipDragEnd);
      handle.addEventListener('pointercancel', onChipDragEnd);
    });
  }

  function renderTurnZone(){
    const p = currentPlayer();
    if(!p){
      turnZone.innerHTML = '<div class="empty">Ajoute un joueur pour commencer la partie 👇</div>';
      return;
    }
    let streakNote = '';
    if(!p.started){
      streakNote = p.streak > 0
        ? `Pas encore en jeu — ${p.streak} coup${p.streak>1?'s':''} à vide, aucune pénalité tant que le joueur n'a pas marqué`
        : `Pas encore en jeu — aucune pénalité tant que le joueur n'a pas marqué`;
    } else if(p.streak > 0){
      streakNote = `⚠ ${p.streak} coup${p.streak>1?'s':''} à vide d'affilée${p.streak % 3 === 2 ? ' — attention, pénalité au prochain !' : ''}`;
    }
    turnZone.innerHTML = `
      <div class="pending-block">
        <div class="pending-value">${state.pending > 0 ? '+' + state.pending : '0'}</div>
        <div class="pending-label">point${state.pending > 1 ? 's' : ''} ce tour</div>
      </div>

      <div class="tile-grid">
        ${QUICK_VALUES.map(v => `<button class="tile-btn" data-quick="${v}">+${v}</button>`).join('')}
        <button class="tile-btn tile-btn-minor" id="minus100Btn">−100</button>
      </div>

      <div class="streak-note">${streakNote}</div>

      <div class="main-actions">
        <button class="btn btn-bust" id="bustBtn">Quequette (0 pt)</button>
        <button class="btn btn-validate" id="validateBtn" ${state.pending <= 0 ? 'disabled' : ''}>Valider le tour</button>
      </div>
    `;

    container.querySelector('#minus100Btn').onclick = () => adjustPending(-100);
    container.querySelector('#bustBtn').onclick = bustTurn;
    container.querySelector('#validateBtn').onclick = validateTurn;
    turnZone.querySelectorAll('[data-quick]').forEach(btn => {
      btn.onclick = () => adjustPending(parseInt(btn.getAttribute('data-quick'), 10));
    });
  }

  function render(){
    const winner = state.players.find(p => p.score >= 5000);
    winnerZoneEl.innerHTML = winner
      ? `<div class="winner-banner">🎉 ${escapeAttr(winner.name)} a atteint ${winner.score.toLocaleString('fr-CH')} points — victoire !</div>`
      : '';

    roundChip.textContent = 'Manche ' + state.round;

    renderScoreboard();
    renderTurnZone();

    if(state.log && state.log.length > 0){
      logEl.innerHTML = state.log.slice(0, 12).map(entry => {
        const deltaClass = entry.delta > 0 ? 'plus' : (entry.delta < 0 ? 'minus' : '');
        const deltaText = entry.delta === 0 ? '—' : (entry.delta > 0 ? '+' + entry.delta : entry.delta);
        return `<div class="log-item"><span><b>${escapeAttr(entry.text)}</b></span><span class="delta ${deltaClass}">${deltaText}</span></div>`;
      }).join('');
    } else {
      logEl.innerHTML = '';
    }
  }

  container.querySelector('#addPlayerBtn').onclick = addPlayer;
  container.querySelector('#resetBtn').onclick = resetGame;
  container.querySelector('#resetAllBtn').onclick = resetAll;
  container.querySelector('#undoBtn').onclick = undo;
  container.querySelector('#logToggle').addEventListener('click', () => {
    logEl.classList.toggle('open');
    const open = logEl.classList.contains('open');
    container.querySelector('#logToggle').textContent = (open ? '▾' : '▸') + ' Historique';
  });

  render();
}
