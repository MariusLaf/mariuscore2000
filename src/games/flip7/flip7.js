import { createPlayerBoard, attachLogToggle } from '../../shared/player-board.js';
import { createGamesHistory, pickLeader } from '../../shared/games-history.js';

const TARGET = 200;
const FLIP7_BONUS = 15;

const MARKUP = `
<div class="wrap">
  <div class="brand">
    <h1>Flip 7<span class="dot">.</span></h1>
    <div class="header-actions">
      <span class="round-chip" id="roundChip">Manche 1</span>
      <button class="icon-btn-sm" id="gamesHistoryBtn" title="Historique des parties">🕓</button>
      <button class="icon-btn-sm" id="rulesBtn" title="Règles du compteur">ℹ️</button>
      <button class="icon-btn-sm" id="undoBtn" title="Annuler la dernière manche">↩︎</button>
      <button class="icon-btn-sm" id="resetBtn" title="Nouvelle partie">🔄</button>
      <button class="icon-btn-sm danger" id="resetAllBtn" title="Tout réinitialiser">🗑</button>
    </div>
  </div>

  <div id="winnerZone"></div>
  <div class="scoreboard" id="scoreboard"></div>
  <div id="roundZone"></div>

  <button class="log-toggle" id="logToggle">▸ Historique</button>
  <div class="log" id="log"></div>
</div>

<div id="rulesOverlay" class="modal-overlay hidden">
  <div class="modal-card">
    <h3 class="modal-title">Règles du compteur</h3>
    <p class="modal-message">Chaque manche, saisis pour chaque joueur la somme de ses cartes Nombre (modificateurs inclus). « Raté » met la manche à 0 (doublon). « Flip 7 » ajoute 15 points de bonus (7 cartes différentes). « Valider la manche » additionne tout et fait tourner le donneur (chip en surbrillance). La partie se termine à la fin de la manche où quelqu'un atteint 200 points : le meilleur score gagne.</p>
    <button class="modal-ok" id="rulesClose">Fermer</button>
  </div>
</div>

<div id="modalZone"></div>
`;

export default function initFlip7(container) {
  container.innerHTML = MARKUP;

  const STORAGE_KEY = 'flip7-state-v1';

  function freshState() {
    return { players: [], log: [], history: [], currentIndex: 0, round: 1, entries: {}, gameRecorded: false };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && Array.isArray(parsed.players) ? parsed : null;
    } catch (e) { return null; }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* storage unavailable, continue silently */ }
  }

  let state = Object.assign(freshState(), loadState() || {});
  if (!state.entries || typeof state.entries !== 'object') state.entries = {};

  const scoreboard = container.querySelector('#scoreboard');
  const roundZone = container.querySelector('#roundZone');
  const winnerZoneEl = container.querySelector('#winnerZone');
  const logEl = container.querySelector('#log');
  const roundChip = container.querySelector('#roundChip');
  const rulesOverlay = container.querySelector('#rulesOverlay');

  container.querySelector('#rulesBtn').addEventListener('click', () => rulesOverlay.classList.remove('hidden'));
  container.querySelector('#rulesClose').addEventListener('click', () => rulesOverlay.classList.add('hidden'));

  const gamesHistory = createGamesHistory({
    container,
    button: container.querySelector('#gamesHistoryBtn'),
    storageKey: 'flip7-games-history-v1'
  });

  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function showConfirm(message, onConfirm) {
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
      if (e.target.id === 'modalOverlay') modalZone.innerHTML = '';
    });
    container.querySelector('#modalConfirm').onclick = () => { modalZone.innerHTML = ''; onConfirm(); };
  }

  function pushHistorySnapshot() {
    state.history = state.history || [];
    state.history.push(JSON.stringify({
      players: state.players, log: state.log, currentIndex: state.currentIndex,
      round: state.round, entries: state.entries, gameRecorded: state.gameRecorded
    }));
    if (state.history.length > 20) state.history.shift();
  }

  function undo() {
    if (!state.history || state.history.length === 0) return;
    const prev = JSON.parse(state.history.pop());
    Object.assign(state, prev);
    saveState();
    render();
  }

  function entryFor(id) {
    if (!state.entries[id]) state.entries[id] = { pts: 0, bust: false, flip7: false };
    return state.entries[id];
  }

  function entryTotal(e) {
    if (e.bust) return 0;
    return Math.max(0, e.pts) + (e.flip7 ? FLIP7_BONUS : 0);
  }

  function addLog(text, delta) {
    state.log.unshift({ text, delta });
    if (state.log.length > 40) state.log.length = 40;
  }

  function validateRound() {
    if (state.players.length === 0) return;
    pushHistorySnapshot();
    const parts = [];
    state.players.forEach((p) => {
      const e = entryFor(p.id);
      const total = entryTotal(e);
      p.score += total;
      p.rounds += 1;
      if (e.bust) p.busts += 1;
      if (e.flip7) p.flips += 1;
      parts.push(`${p.name} ${e.bust ? 'raté' : (e.flip7 ? 'Flip 7 ' : '') + '+' + total}`);
    });
    addLog(`Manche ${state.round} — ${parts.join(', ')}`, 0);
    state.round += 1;
    state.currentIndex = (state.currentIndex + 1) % state.players.length;
    state.entries = {};
    if (!state.gameRecorded) {
      const winner = bestAtOrAboveTarget();
      if (winner) {
        state.gameRecorded = true;
        gamesHistory.record(winner.name, state.players);
      }
    }
    saveState();
    render();
  }

  function bestAtOrAboveTarget() {
    const reached = state.players.filter((p) => p.score >= TARGET);
    if (reached.length === 0) return null;
    return reached.reduce((a, b) => (b.score > a.score ? b : a));
  }

  function maybeRecordUnfinishedGame() {
    if (state.gameRecorded) return;
    if (!state.players.some((p) => p.score > 0 || p.rounds > 0)) return;
    gamesHistory.record(pickLeader(state.players).name, state.players);
  }

  function resetGame() {
    if (state.players.length === 0) return;
    showConfirm('Démarrer une nouvelle partie ? Les scores actuels seront remis à zéro.', () => {
      maybeRecordUnfinishedGame();
      pushHistorySnapshot();
      state.players.forEach((p) => { p.score = 0; p.rounds = 0; p.busts = 0; p.flips = 0; });
      state.log = [];
      state.currentIndex = 0;
      state.round = 1;
      state.entries = {};
      state.gameRecorded = false;
      saveState();
      render();
    });
  }

  function resetAll() {
    showConfirm('Tout réinitialiser ? Les joueurs seront supprimés et il faudra recommencer la partie de zéro.', () => {
      maybeRecordUnfinishedGame();
      state = freshState();
      saveState();
      render();
    });
  }

  const playerBoard = createPlayerBoard({
    container: scoreboard,
    getPlayers: () => state.players,
    getCurrentIndex: () => state.currentIndex,
    setCurrentIndex: (i) => { state.currentIndex = i; },
    newPlayer: () => ({ score: 0, rounds: 0, busts: 0, flips: 0 }),
    renderStat: (p) => `<p class="chip-stat${p.flips > 0 ? ' has-some' : ''}">${p.flips || 0} × Flip 7</p>`,
    beforeChange: () => pushHistorySnapshot(),
    afterChange: () => { saveState(); render(); }
  });

  function renderRoundZone() {
    if (state.players.length === 0) {
      roundZone.innerHTML = '<div class="empty">Ajoute un joueur pour commencer la partie 👇</div>';
      return;
    }
    roundZone.innerHTML = `
      <div class="round-title">Manche ${state.round} — donneur : <b>${escapeAttr(state.players[state.currentIndex % state.players.length].name)}</b></div>
      <div class="entry-list">
        ${state.players.map((p) => {
          const e = entryFor(p.id);
          return `
          <div class="entry${e.bust ? ' is-bust' : ''}${e.flip7 ? ' is-flip' : ''}" data-id="${p.id}">
            <div class="entry-name">${escapeAttr(p.name)}</div>
            <div class="entry-stepper">
              <button class="step-btn" data-step="-1" ${e.bust ? 'disabled' : ''}>−</button>
              <input class="pts-input" type="number" inputmode="numeric" min="0" value="${e.bust ? 0 : e.pts}" ${e.bust ? 'disabled' : ''} aria-label="Points de ${escapeAttr(p.name)}">
              <button class="step-btn" data-step="1" ${e.bust ? 'disabled' : ''}>+</button>
            </div>
            <div class="entry-toggles">
              <button class="toggle toggle-bust${e.bust ? ' on' : ''}" data-toggle="bust">Raté</button>
              <button class="toggle toggle-flip${e.flip7 ? ' on' : ''}" data-toggle="flip7" ${e.bust ? 'disabled' : ''}>Flip 7 +${FLIP7_BONUS}</button>
            </div>
            <div class="entry-total">+${entryTotal(e)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="main-actions">
        <button class="btn btn-validate" id="validateBtn">Valider la manche</button>
      </div>
    `;

    roundZone.querySelectorAll('.entry').forEach((row) => {
      const id = row.getAttribute('data-id');
      const e = entryFor(id);
      const refresh = () => { saveState(); renderRoundZone(); };
      row.querySelectorAll('[data-step]').forEach((btn) => {
        btn.onclick = () => {
          e.pts = Math.max(0, (parseInt(e.pts, 10) || 0) + parseInt(btn.getAttribute('data-step'), 10));
          refresh();
        };
      });
      row.querySelector('.pts-input').addEventListener('change', (ev) => {
        e.pts = Math.max(0, parseInt(ev.target.value, 10) || 0);
        refresh();
      });
      row.querySelector('[data-toggle="bust"]').onclick = () => {
        e.bust = !e.bust;
        if (e.bust) e.flip7 = false;
        refresh();
      };
      row.querySelector('[data-toggle="flip7"]').onclick = () => { e.flip7 = !e.flip7; refresh(); };
    });
    container.querySelector('#validateBtn').onclick = validateRound;
  }

  function render() {
    const winner = state.players.length ? bestAtOrAboveTarget() : null;
    winnerZoneEl.innerHTML = winner
      ? `<div class="winner-banner">🎉 ${escapeAttr(winner.name)} gagne avec ${winner.score} points !</div>`
      : '';
    roundChip.textContent = 'Manche ' + state.round;

    playerBoard.render();
    renderRoundZone();

    logEl.innerHTML = (state.log || []).slice(0, 12).map((entry) =>
      `<div class="log-item"><span><b>${escapeAttr(entry.text)}</b></span></div>`
    ).join('');
  }

  container.querySelector('#resetBtn').onclick = resetGame;
  container.querySelector('#resetAllBtn').onclick = resetAll;
  container.querySelector('#undoBtn').onclick = undo;
  attachLogToggle(container.querySelector('#logToggle'), logEl, 'Historique');

  render();
}
