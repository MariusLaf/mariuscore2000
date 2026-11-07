import { createPlayerBoard, attachLogToggle } from '../../shared/player-board.js';
import { createGamesHistory } from '../../shared/games-history.js';

const TARGET = 100;
const QUICK_DELTAS = [-4, -2, 2, 5, 10, 20];

const MARKUP = `
<div class="wrap">
  <div class="brand">
    <h1>Skyjo<span class="dot">.</span></h1>
    <div class="header-actions">
      <span class="round-chip" id="roundChip">Manche 1</span>
      <button class="icon-btn-sm" id="rankBtn" title="Classement">🏆</button>
      <button class="icon-btn-sm" id="gamesHistoryBtn" title="Historique des parties">🕓</button>
      <button class="icon-btn-sm" id="rulesBtn" title="Règles du compteur">ℹ️</button>
      <button class="icon-btn-sm" id="undoBtn" title="Annuler la dernière manche">↩︎</button>
      <button class="icon-btn-sm" id="resetBtn" title="Remettre les scores à zéro">🔄</button>
      <button class="icon-btn-sm danger" id="resetAllBtn" title="Tout réinitialiser">🆕</button>
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
    <p class="modal-message">Chaque manche, touche « + saisir » sous un joueur et entre le total de ses cartes retournées (les cartes vont de −2 à 12, le total peut être négatif). Le joueur qui a fini la manche en premier doit avoir un score <b>strictement inférieur</b> à tous les autres ce tour-ci — sinon son score est doublé : marque-le avec 🏁 « Fini le 1ᵉʳ », le compteur applique la pénalité automatiquement. « Valider la manche » additionne tout aux totaux. La partie se termine dès qu'un joueur atteint 100 points : c'est le score le plus <b>bas</b> qui gagne.</p>
    <button class="modal-ok" id="rulesClose">Fermer</button>
  </div>
</div>

<div id="sheetZone"></div>
<div id="modalZone"></div>
`;

export default function initSkyjo(container) {
  container.innerHTML = MARKUP;

  const STORAGE_KEY = 'skyjo-state-v1';

  function freshState() {
    return { players: [], log: [], history: [], round: 1, entries: {}, finisherId: null, gameRecorded: false };
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
  if (state.finisherId === undefined) state.finisherId = null;

  const scoreboard = container.querySelector('#scoreboard');
  const roundZone = container.querySelector('#roundZone');
  const sheetZone = container.querySelector('#sheetZone');
  const winnerZoneEl = container.querySelector('#winnerZone');
  const logEl = container.querySelector('#log');
  const roundChip = container.querySelector('#roundChip');
  const rulesOverlay = container.querySelector('#rulesOverlay');

  container.querySelector('#rulesBtn').addEventListener('click', () => rulesOverlay.classList.remove('hidden'));
  container.querySelector('#rulesClose').addEventListener('click', () => rulesOverlay.classList.add('hidden'));

  const gamesHistory = createGamesHistory({
    container,
    button: container.querySelector('#gamesHistoryBtn'),
    storageKey: 'skyjo-games-history-v1'
  });

  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  // Score le plus bas gagne à Skyjo : le classement et "meneur" du jeu sont inversés
  // par rapport aux autres compteurs (pickLeader partagé prend le score le plus haut).
  function pickLowest(players) {
    return players.reduce((best, p) => (!best || p.score < best.score ? p : best), null);
  }

  function showRanking() {
    const modalZone = container.querySelector('#modalZone');
    const sorted = state.players.slice().sort((a, b) => a.score - b.score);
    const medals = ['🥇', '🥈', '🥉'];
    let rank = 0;
    const rows = sorted.map((p, i) => {
      if (i === 0 || p.score !== sorted[i - 1].score) rank = i + 1; // ex æquo : même rang
      const left = TARGET - p.score;
      return `<div class="rank-row${i === 0 ? ' first' : ''}">
        <span class="rank-pos">${medals[rank - 1] || rank}</span>
        <span class="rank-name">${escapeAttr(p.name)}</span>
        <span class="rank-left">${left > 0 ? left + ' avant la fin' : 'fin de partie'}</span>
        <span class="rank-score">${p.score}</span>
      </div>`;
    }).join('');
    modalZone.innerHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal-box">
          <h3 class="modal-title">Classement — le plus bas gagne</h3>
          ${rows || '<p>Aucun joueur.</p>'}
          <div class="modal-actions"><button class="modal-cancel" id="modalCancel">Fermer</button></div>
        </div>
      </div>`;
    container.querySelector('#modalCancel').onclick = () => { modalZone.innerHTML = ''; };
    container.querySelector('#modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') modalZone.innerHTML = '';
    });
  }
  container.querySelector('#rankBtn').addEventListener('click', showRanking);

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
      players: state.players, log: state.log,
      round: state.round, entries: state.entries, finisherId: state.finisherId, gameRecorded: state.gameRecorded
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
    if (!state.entries[id]) state.entries[id] = { pts: 0, confirmed: false };
    return state.entries[id];
  }

  function isDone(e) { return e.confirmed || e.pts !== 0; }

  function doneCount() { return state.players.filter((p) => isDone(entryFor(p.id))).length; }

  // Pénalité "fini le 1er" : son score de la manche doit être strictement le plus bas,
  // sinon il est doublé.
  function roundMinExcluding(id) {
    const others = state.players.filter((p) => p.id !== id);
    if (others.length === 0) return null;
    return Math.min(...others.map((p) => entryFor(p.id).pts));
  }

  function isPenalized(id) {
    if (state.finisherId !== id) return false;
    const min = roundMinExcluding(id);
    if (min === null) return false;
    return entryFor(id).pts >= min;
  }

  function appliedTotal(id) {
    const pts = entryFor(id).pts;
    return isPenalized(id) ? pts * 2 : pts;
  }

  function addLog(text) {
    state.log.unshift({ text });
    if (state.log.length > 40) state.log.length = 40;
  }

  function fmtDelta(n) { return (n >= 0 ? '+' : '') + n; }

  function validateRound() {
    if (state.players.length === 0) return;
    pushHistorySnapshot();
    const parts = [];
    state.players.forEach((p) => {
      const penalized = isPenalized(p.id);
      const total = appliedTotal(p.id);
      p.score += total;
      p.rounds += 1;
      const tag = state.finisherId === p.id ? '🏁 ' : '';
      parts.push(`${p.name} ${tag}${fmtDelta(total)}${penalized ? ' (×2)' : ''}`);
    });
    addLog(`Manche ${state.round} — ${parts.join(', ')}`);
    state.round += 1;
    state.entries = {};
    state.finisherId = null;
    if (!state.gameRecorded) {
      const winner = winnerIfOver();
      if (winner) {
        state.gameRecorded = true;
        gamesHistory.record(winner.name, state.players);
      }
    }
    saveState();
    render();
  }

  function winnerIfOver() {
    if (!state.players.some((p) => p.score >= TARGET)) return null;
    return pickLowest(state.players);
  }

  function maybeRecordUnfinishedGame() {
    if (state.gameRecorded) return;
    if (!state.players.some((p) => p.score !== 0 || p.rounds > 0)) return;
    gamesHistory.record(pickLowest(state.players).name, state.players);
  }

  function resetGame() {
    if (state.players.length === 0) return;
    showConfirm('Démarrer une nouvelle partie ? Les scores actuels seront remis à zéro.', () => {
      maybeRecordUnfinishedGame();
      pushHistorySnapshot();
      state.players.forEach((p) => { p.score = 0; p.rounds = 0; });
      state.log = [];
      state.round = 1;
      state.entries = {};
      state.finisherId = null;
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
    getCurrentIndex: () => -1, // pas de joueur actif à Skyjo, tout le monde joue en même temps
    setCurrentIndex: () => {},
    newPlayer: () => ({ score: 0, rounds: 0 }),
    renderStat: (p) => {
      const e = entryFor(p.id);
      const done = isDone(e);
      const finisher = state.finisherId === p.id;
      const penalized = isPenalized(p.id);
      const label = done
        ? (finisher ? '🏁 ' : '') + fmtDelta(e.pts) + (penalized ? ' (×2)' : '')
        : '+ saisir';
      return `<button type="button" class="chip-entry${done ? ' has-entry' : ''}${finisher ? ' is-finisher' : ''}${penalized ? ' is-penalized' : ''}${p.id === sheetId ? ' editing' : ''}" data-entry="${p.id}">${label}</button>`;
    },
    beforeChange: () => pushHistorySnapshot(),
    afterChange: () => { saveState(); render(); }
  });

  let sheetId = null; // player whose entry sheet is open

  function renderRoundZone() {
    if (state.players.length === 0) {
      roundZone.innerHTML = '<div class="empty">Ajoute un joueur pour commencer la partie 👇</div>';
      return;
    }
    roundZone.innerHTML = `
      <div class="round-title">Manche ${state.round}</div>
      <div class="main-actions">
        <button class="btn btn-validate" id="validateBtn">Valider la manche · ${doneCount()}/${state.players.length}</button>
      </div>
    `;
    container.querySelector('#validateBtn').onclick = validateRound;
  }

  function closeSheet() {
    sheetId = null;
    sheetZone.innerHTML = '';
    saveState();
    render();
  }

  function nextPlayerId(id) {
    const i = state.players.findIndex((p) => p.id === id);
    return i >= 0 && i + 1 < state.players.length ? state.players[i + 1].id : null;
  }

  function renderSheet() {
    const p = state.players.find((pl) => pl.id === sheetId);
    if (!p) { sheetZone.innerHTML = ''; return; }
    const e = entryFor(p.id);
    const next = nextPlayerId(p.id);
    const finisher = state.finisherId === p.id;
    const penalized = isPenalized(p.id);
    const refresh = () => { saveState(); renderSheet(); };
    renderScoreboard();
    const doneBtn = roundZone.querySelector('#validateBtn');
    if (doneBtn) doneBtn.textContent = `Valider la manche · ${doneCount()}/${state.players.length}`;

    let countText = '&nbsp;';
    if (finisher) countText = penalized ? '⚠️ pas le plus bas — score doublé' : '✓ score le plus bas, pas de pénalité';

    sheetZone.innerHTML = `
      <div class="sheet-overlay" id="sheetOverlay">
        <div class="sheet">
          <div class="sheet-players">
            ${state.players.map((pl) => {
              const pe = entryFor(pl.id);
              return `<button class="sp${pl.id === p.id ? ' cur' : ''}${isDone(pe) ? ' done' : ''}" data-goto="${pl.id}">${isDone(pe) ? '✓ ' : ''}${escapeAttr(pl.name)}</button>`;
            }).join('')}
          </div>
          <div class="sheet-top">
            <span class="sheet-player">${escapeAttr(p.name)}</span>
            <button class="sheet-clear" id="sheetClear" title="Remettre à 0">↺</button>
          </div>
          <div class="sheet-total${penalized ? ' is-penalized' : ''}">${fmtDelta(e.pts)}</div>
          <div class="sheet-count">${countText}</div>
          <div class="manual">
            <button class="step-btn" data-step="-1">−</button>
            <input class="pts-input" type="number" inputmode="numeric" value="${e.pts}">
            <button class="step-btn" data-step="1">+</button>
          </div>
          <div class="manual-quick">${QUICK_DELTAS.map((v) => `<button class="toggle" data-add="${v}">${v > 0 ? '+' : ''}${v}</button>`).join('')}</div>
          <button class="toggle toggle-finisher${finisher ? ' on' : ''}" id="finisherBtn">🏁 Fini le 1ᵉʳ cette manche</button>
          <div class="sheet-actions">
            <button class="btn btn-validate" id="okBtn">${next ? 'Suivant ›' : 'OK'}</button>
          </div>
        </div>
      </div>`;

    sheetZone.querySelector('#sheetOverlay').addEventListener('click', (ev) => {
      if (ev.target.id === 'sheetOverlay') closeSheet();
    });
    sheetZone.querySelectorAll('[data-goto]').forEach((b) => {
      b.onclick = () => { saveState(); sheetId = b.getAttribute('data-goto'); renderSheet(); };
    });
    const cur = sheetZone.querySelector('.sp.cur');
    if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
    sheetZone.querySelector('#sheetClear').onclick = () => {
      e.pts = 0; e.confirmed = false;
      refresh();
    };
    sheetZone.querySelectorAll('[data-step]').forEach((b) => {
      b.onclick = () => { e.pts += parseInt(b.getAttribute('data-step'), 10); refresh(); };
    });
    sheetZone.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => { e.pts += parseInt(b.getAttribute('data-add'), 10); refresh(); };
    });
    const input = sheetZone.querySelector('.pts-input');
    if (input) input.addEventListener('change', (ev) => { e.pts = parseInt(ev.target.value, 10) || 0; refresh(); });
    sheetZone.querySelector('#finisherBtn').onclick = () => {
      state.finisherId = finisher ? null : p.id;
      refresh();
    };
    sheetZone.querySelector('#okBtn').onclick = () => {
      e.confirmed = true;
      saveState();
      if (next) { sheetId = next; renderSheet(); } else closeSheet();
    };
  }

  // Re-render the tiles and rebind their "saisir" buttons (also called live while the sheet is open)
  function renderScoreboard() {
    playerBoard.render();
    scoreboard.querySelectorAll('[data-entry]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        sheetId = btn.getAttribute('data-entry');
        renderSheet();
      });
    });
  }

  function render() {
    if (sheetId) renderSheet();
    const winner = state.players.length ? winnerIfOver() : null;
    winnerZoneEl.innerHTML = winner
      ? `<div class="winner-banner">🎉 ${escapeAttr(winner.name)} gagne avec ${winner.score} points !</div>`
      : '';
    roundChip.textContent = 'Manche ' + state.round;

    renderScoreboard();
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
