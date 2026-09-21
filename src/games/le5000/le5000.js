const MARKUP = `
<div class="wrap">
  <header>
    <div class="title-block">
      <h1>Le 5000 🎲</h1>
      <div class="round-chip" id="roundChip">Manche 1</div>
    </div>
  </header>

  <div class="header-actions">
    <button class="icon-btn" id="undoBtn">↩︎ Annuler</button>
    <button class="icon-btn" id="resetBtn">🔄 Nouvelle partie</button>
    <button class="icon-btn danger" id="resetAllBtn">🗑 Réinitialiser</button>
  </div>

  <div id="winnerZone"></div>

  <div id="turnZone"></div>

  <div class="leaderboard" id="leaderboardZone" style="display:none;">
    <h2>Classement</h2>
    <div id="lbList"></div>
  </div>

  <div class="add-player">
    <input id="newPlayerName" type="text" placeholder="Nom du joueur" maxlength="20">
    <button id="addPlayerBtn">+ Ajouter</button>
  </div>

  <details class="collapsible">
    <summary>ℹ️ Règles du compteur</summary>
    <div class="rules-note">On joue joueur après joueur : ajoute les points du tour par paliers de 100, puis "Valider le tour" pour passer au suivant. Tous les 3 coups à vide d'affilée, une pénalité s'applique automatiquement (−200, −400, −600…) — sauf tant que le joueur n'est pas encore entré en jeu (n'a jamais marqué de points). Dès qu'un joueur marque des points, son compteur de quequettes repart à zéro.</div>
  </details>

  <details class="collapsible" id="logSection" style="display:none;">
    <summary>📜 Historique</summary>
    <div id="logList"></div>
  </details>

  <div id="modalZone"></div>
</div>
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
  state.players.forEach(p => { if(typeof p.started !== 'boolean') p.started = p.score > 0; if(typeof p.quequettes !== 'number') p.quequettes = 0; });

  const turnZone = container.querySelector('#turnZone');
  const winnerZoneEl = container.querySelector('#winnerZone');
  const leaderboardZone = container.querySelector('#leaderboardZone');
  const lbList = container.querySelector('#lbList');
  const logSection = container.querySelector('#logSection');
  const logList = container.querySelector('#logList');
  const roundChip = container.querySelector('#roundChip');

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
  function initials(name){
    return name.trim().slice(0,2).toUpperCase();
  }

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

  function addPlayer(name){
    const trimmed = (name || '').trim();
    if(!trimmed) return;
    pushHistorySnapshot();
    state.players.push({ id: uid(), name: trimmed, score: 0, streak: 0, turns: 0, started: false, quequettes: 0 });
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

  function addLog(text, delta){
    state.log = state.log || [];
    state.log.unshift({ text, delta });
    if(state.log.length > 40) state.log.length = 40;
  }

  function adjustPending(amount){
    state.pending = Math.max(0, round100(state.pending + amount));
    saveState();
    renderTurnOnly();
  }

  function clearPending(){
    state.pending = 0;
    saveState();
    renderTurnOnly();
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

  const QUICK_VALUES = [100, 200, 300, 400, 500, 600, 700, 800];

  function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

  function renderTurnOnly(){
    const p = currentPlayer();
    if(!p){
      turnZone.innerHTML = '<div class="empty">Ajoute des joueurs pour commencer la partie 👇</div>';
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
      <div class="turn-card">
        <div class="turn-label">Au tour de</div>
        <div class="turn-name">${escapeAttr(p.name)}</div>
        <div class="turn-total">Total actuel : ${formatScore(p.score)} pts · ${p.quequettes} quequette${p.quequettes !== 1 ? 's' : ''}</div>

        <div class="pending-display">
          <div class="pending-number">+${state.pending}</div>
          <div class="pending-caption">points ce tour</div>
        </div>

        <button class="plus50-btn" id="plus50Btn">+ 100</button>

        <div class="quick-row">
          ${QUICK_VALUES.map(v => `<button data-quick="${v}">+${v}</button>`).join('')}
        </div>

        <div class="adjust-row">
          <button id="minus50Btn">− 100</button>
          <button id="clearPendingBtn">Effacer</button>
        </div>

        <div class="custom-row">
          <input type="number" inputmode="numeric" placeholder="Montant libre (x100)" id="customInput">
          <button id="customAddBtn">Ajouter</button>
        </div>

        <div class="streak-note">${streakNote}</div>

        <div class="main-actions">
          <button class="btn btn-bust" id="bustBtn">Quequette (0 pt)</button>
          <button class="btn btn-validate" id="validateBtn" ${state.pending <= 0 ? 'disabled' : ''}>Valider le tour</button>
        </div>
      </div>
    `;

    container.querySelector('#plus50Btn').onclick = () => adjustPending(100);
    container.querySelector('#minus50Btn').onclick = () => adjustPending(-100);
    container.querySelector('#clearPendingBtn').onclick = clearPending;
    container.querySelector('#bustBtn').onclick = bustTurn;
    container.querySelector('#validateBtn').onclick = validateTurn;
    turnZone.querySelectorAll('[data-quick]').forEach(btn => {
      btn.onclick = () => adjustPending(parseInt(btn.getAttribute('data-quick'), 10));
    });
    container.querySelector('#customAddBtn').onclick = () => {
      const input = container.querySelector('#customInput');
      const raw = parseInt(input.value, 10);
      if(!isNaN(raw) && raw !== 0){
        adjustPending(round100(raw));
        input.value = '';
      }
    };
    container.querySelector('#customInput').addEventListener('keydown', (e) => {
      if(e.key === 'Enter') container.querySelector('#customAddBtn').click();
    });
  }

  function renderLeaderboard(){
    if(state.players.length === 0){
      leaderboardZone.style.display = 'none';
      return;
    }
    leaderboardZone.style.display = 'block';
    lbList.innerHTML = state.players.map((p, i) => `
      <div class="lb-row ${i === state.currentIndex ? 'is-current' : ''}">
        <div class="lb-avatar">${escapeAttr(initials(p.name))}</div>
        <div class="lb-name-wrap">
          <input class="lb-name" data-id="${p.id}" value="${escapeAttr(p.name)}" maxlength="20">
          <div class="lb-sub">${p.turns} tour${p.turns>1?'s':''} · ${p.quequettes} quequette${p.quequettes !== 1 ? 's' : ''}${!p.started ? ' · pas encore en jeu' : ''}${i === state.currentIndex ? ' · à jouer' : ''}</div>
        </div>
        <div class="lb-score">${formatScore(p.score)}</div>
        <button class="lb-remove" data-remove="${p.id}">✕</button>
      </div>
    `).join('');

    lbList.querySelectorAll('.lb-name').forEach(input => {
      input.onchange = () => renamePlayer(input.getAttribute('data-id'), input.value);
    });
    lbList.querySelectorAll('[data-remove]').forEach(btn => {
      btn.onclick = () => removePlayer(btn.getAttribute('data-remove'));
    });
  }

  function render(){
    const winner = state.players.find(p => p.score >= 5000);
    winnerZoneEl.innerHTML = winner
      ? `<div class="winner-banner">🎉 ${escapeAttr(winner.name)} a atteint ${winner.score.toLocaleString('fr-CH')} points — victoire !</div>`
      : '';

    roundChip.textContent = 'Manche ' + state.round;

    renderTurnOnly();
    renderLeaderboard();

    if(state.log && state.log.length > 0){
      logSection.style.display = 'block';
      logList.innerHTML = state.log.slice(0, 12).map(entry => {
        const deltaClass = entry.delta > 0 ? 'plus' : (entry.delta < 0 ? 'minus' : '');
        const deltaText = entry.delta === 0 ? '—' : (entry.delta > 0 ? '+' + entry.delta : entry.delta);
        return `<div class="log-entry"><span class="who">${escapeAttr(entry.text)}</span><span class="delta ${deltaClass}">${deltaText}</span></div>`;
      }).join('');
    } else {
      logSection.style.display = 'none';
    }
  }

  container.querySelector('#addPlayerBtn').onclick = () => {
    const input = container.querySelector('#newPlayerName');
    addPlayer(input.value);
    input.value = '';
    input.focus();
  };
  container.querySelector('#newPlayerName').addEventListener('keydown', (e) => {
    if(e.key === 'Enter') container.querySelector('#addPlayerBtn').click();
  });
  container.querySelector('#resetBtn').onclick = resetGame;
  container.querySelector('#resetAllBtn').onclick = resetAll;
  container.querySelector('#undoBtn').onclick = undo;

  render();
}
