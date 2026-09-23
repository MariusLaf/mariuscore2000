import { createPlayerBoard, attachLogToggle } from '../../shared/player-board.js';
import { createGamesHistory, pickLeader } from '../../shared/games-history.js';

const MARKUP = `
<div class="wrap">
  <div class="brand">
    <h1>Le 5000<span class="dot">.</span></h1>
    <div class="header-actions">
      <span class="round-chip" id="roundChip">Manche 1</span>
      <button class="icon-btn-sm" id="gamesHistoryBtn" title="Historique des parties">🕓</button>
      <button class="icon-btn-sm" id="rulesBtn" title="Règles du compteur">ℹ️</button>
      <button class="icon-btn-sm" id="undoBtn" title="Annuler le dernier tour">↩︎</button>
      <button class="icon-btn-sm" id="resetBtn" title="Nouvelle partie">🔄</button>
      <button class="icon-btn-sm danger" id="resetAllBtn" title="Tout réinitialiser">🗑</button>
    </div>
  </div>

  <div id="winnerZone"></div>

  <div class="scoreboard" id="scoreboard"></div>

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

  let state = loadState() || { players: [], log: [], history: [], currentIndex: 0, round: 1, pending: 0, gameRecorded: false };
  if(typeof state.currentIndex !== 'number') state.currentIndex = 0;
  if(typeof state.round !== 'number') state.round = 1;
  if(typeof state.pending !== 'number') state.pending = 0;
  if(typeof state.gameRecorded !== 'boolean') state.gameRecorded = false;
  state.pending = Math.max(0, Math.round(state.pending / 100) * 100);
  state.players.forEach(p => { if(typeof p.started !== 'boolean') p.started = p.score > 0; if(typeof p.quequettes !== 'number') p.quequettes = 0; if(typeof p.streak !== 'number') p.streak = 0; });

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

  const gamesHistory = createGamesHistory({
    container,
    button: container.querySelector('#gamesHistoryBtn'),
    storageKey: 'jeu5000-games-history-v1'
  });

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
    if(!state.gameRecorded && p.score >= 5000){
      state.gameRecorded = true;
      gamesHistory.record(p.name, state.players);
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

  function maybeRecordUnfinishedGame(){
    if(state.gameRecorded) return; // already recorded when someone reached 5000
    const hasActivity = state.players.some(p => p.score > 0 || p.turns > 0);
    if(!hasActivity) return;
    gamesHistory.record(pickLeader(state.players).name, state.players);
  }

  function resetGame(){
    if(state.players.length === 0) return;
    showConfirm('Démarrer une nouvelle partie ? Les scores actuels seront remis à zéro.', () => {
      maybeRecordUnfinishedGame();
      pushHistorySnapshot();
      state.players.forEach(p => { p.score = 0; p.streak = 0; p.turns = 0; p.started = false; p.quequettes = 0; });
      state.log = [];
      state.currentIndex = 0;
      state.round = 1;
      state.pending = 0;
      state.gameRecorded = false;
      saveState();
      render();
    });
  }

  function resetAll(){
    showConfirm('Tout réinitialiser ? Les joueurs seront supprimés et il faudra recommencer la partie de zéro.', () => {
      maybeRecordUnfinishedGame();
      state = { players: [], log: [], history: [], currentIndex: 0, round: 1, pending: 0, gameRecorded: false };
      saveState();
      render();
    });
  }

  const QUICK_VALUES = [100, 200, 500];

  const playerBoard = createPlayerBoard({
    container: scoreboard,
    getPlayers: () => state.players,
    getCurrentIndex: () => state.currentIndex,
    setCurrentIndex: (i) => { state.currentIndex = i; },
    newPlayer: () => ({ score: 0, streak: 0, turns: 0, started: false, quequettes: 0 }),
    formatScore,
    renderStat: (p) => `<p class="chip-quequettes${p.quequettes > 0 ? ' has-some' : ''}">${p.quequettes} quequette${p.quequettes !== 1 ? 's' : ''}</p>`,
    beforeChange: () => pushHistorySnapshot(),
    afterChange: () => { saveState(); render(); }
  });

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

    playerBoard.render();
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

  container.querySelector('#resetBtn').onclick = resetGame;
  container.querySelector('#resetAllBtn').onclick = resetAll;
  container.querySelector('#undoBtn').onclick = undo;
  attachLogToggle(container.querySelector('#logToggle'), logEl, 'Historique');

  render();
}
