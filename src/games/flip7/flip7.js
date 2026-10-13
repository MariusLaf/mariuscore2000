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
    <p class="modal-message">Chaque manche, touche un joueur puis les cartes qu'il a devant lui (onglet Cartes : total et Flip 7 automatiques) ou saisis son total à la main (onglet Manuel). « Raté » met la manche à 0 (doublon) et passe au joueur suivant. Flip 7 = 7 cartes Nombre différentes : +15 points. « Valider la manche » additionne tout et fait tourner le donneur (chip en surbrillance). La partie se termine à la fin de la manche où quelqu'un atteint 200 points : le meilleur score gagne.</p>
    <button class="modal-ok" id="rulesClose">Fermer</button>
  </div>
</div>

<div id="sheetZone"></div>
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

  const MODS = [2, 4, 6, 8, 10];

  function entryFor(id) {
    state.entries[id] = Object.assign(
      { mode: 'cards', nums: [], mods: [], x2: false, bust: false, pts: 0, flip7: false },
      state.entries[id]
    );
    return state.entries[id];
  }

  function isFlip7(e) { return !e.bust && (e.mode === 'cards' ? e.nums.length >= 7 : e.flip7); }

  function entryTotal(e) {
    if (e.bust) return 0;
    if (e.mode === 'manual') return Math.max(0, e.pts) + (e.flip7 ? FLIP7_BONUS : 0);
    const sum = e.nums.reduce((a, n) => a + n, 0) * (e.x2 ? 2 : 1);
    return sum + e.mods.reduce((a, n) => a + n, 0) + (e.nums.length >= 7 ? FLIP7_BONUS : 0);
  }

  function entrySummary(e) {
    if (e.bust) return 'Raté';
    if (e.mode === 'manual') return e.pts > 0 || e.flip7 ? 'Saisie manuelle' : 'Touche pour saisir';
    if (!e.nums.length && !e.mods.length && !e.x2) return 'Touche pour saisir';
    const nums = e.nums.slice().sort((a, b) => a - b).join(' ');
    const mods = e.mods.slice().sort((a, b) => a - b).map((m) => '+' + m).join(' ');
    return [nums, mods, e.x2 ? '×2' : ''].filter(Boolean).join(' · ');
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
      if (isFlip7(e)) p.flips += 1;
      parts.push(`${p.name} ${e.bust ? 'raté' : (isFlip7(e) ? 'Flip 7 ' : '') + '+' + total}`);
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

  let sheetId = null; // player whose card sheet is open

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
          <button class="entry${e.bust ? ' is-bust' : ''}${isFlip7(e) ? ' is-flip' : ''}" data-id="${p.id}">
            <span class="entry-name">${escapeAttr(p.name)}</span>
            <span class="entry-sum">${isFlip7(e) ? '⭐ Flip 7 · ' : ''}${escapeAttr(entrySummary(e))}</span>
            <span class="entry-total">+${entryTotal(e)}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="main-actions">
        <button class="btn btn-validate" id="validateBtn">Valider la manche</button>
      </div>
    `;
    roundZone.querySelectorAll('.entry').forEach((row) => {
      row.onclick = () => { sheetId = row.getAttribute('data-id'); renderSheet(); };
    });
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
    const manual = e.mode === 'manual';
    const next = nextPlayerId(p.id);
    const total = entryTotal(e);
    const refresh = () => { saveState(); renderSheet(); };

    sheetZone.innerHTML = `
      <div class="sheet-overlay" id="sheetOverlay">
        <div class="sheet">
          <div class="sheet-top">
            <span class="sheet-player">${escapeAttr(p.name)}</span>
            <div class="sheet-tabs">
              <button class="sheet-tab${manual ? '' : ' on'}" data-mode="cards">Cartes</button>
              <button class="sheet-tab${manual ? ' on' : ''}" data-mode="manual">Manuel</button>
            </div>
            <button class="sheet-clear" id="sheetClear" title="Effacer">↺</button>
          </div>
          <div class="sheet-total">${total}</div>
          <div class="sheet-count">${e.bust ? 'Raté — 0 point' : (manual ? (e.flip7 ? 'Flip 7 !' : '&nbsp;') : (e.nums.length >= 7 ? '⭐ Flip 7 ! +' + FLIP7_BONUS : e.nums.length + '/7 cartes'))}</div>
          ${manual ? `
            <div class="manual">
              <button class="step-btn" data-step="-1">−</button>
              <input class="pts-input" type="number" inputmode="numeric" min="0" value="${e.pts}">
              <button class="step-btn" data-step="1">+</button>
              <button class="toggle toggle-flip${e.flip7 ? ' on' : ''}" id="manualFlip">Flip 7 +${FLIP7_BONUS}</button>
            </div>
            <div class="manual-quick">${[5, 10, 20].map((v) => `<button class="toggle" data-add="${v}">+${v}</button>`).join('')}</div>
          ` : `
            <div class="num-grid">
              ${[0,1,2,3,4,5,6,7,8,9,10,11,12].map((n) => `<button class="num${e.nums.includes(n) ? ' on' : ''}" data-num="${n}">${n}</button>`).join('')}
            </div>
            <div class="mod-row">
              ${MODS.map((m) => `<button class="mod${e.mods.includes(m) ? ' on' : ''}" data-mod="${m}">+${m}</button>`).join('')}
              <button class="mod${e.x2 ? ' on' : ''}" id="x2Btn">×2</button>
            </div>
          `}
          <div class="sheet-actions">
            <button class="btn btn-bust${e.bust ? ' on' : ''}" id="bustBtn">Raté</button>
            <button class="btn btn-validate" id="okBtn">${next ? 'Suivant ›' : 'OK'}</button>
          </div>
        </div>
      </div>`;

    sheetZone.querySelector('#sheetOverlay').addEventListener('click', (ev) => {
      if (ev.target.id === 'sheetOverlay') closeSheet();
    });
    sheetZone.querySelectorAll('[data-mode]').forEach((b) => {
      b.onclick = () => { e.mode = b.getAttribute('data-mode'); refresh(); };
    });
    sheetZone.querySelector('#sheetClear').onclick = () => {
      Object.assign(e, { nums: [], mods: [], x2: false, bust: false, pts: 0, flip7: false });
      refresh();
    };
    sheetZone.querySelectorAll('[data-num]').forEach((b) => {
      b.onclick = () => {
        const n = parseInt(b.getAttribute('data-num'), 10);
        e.bust = false;
        e.nums = e.nums.includes(n) ? e.nums.filter((x) => x !== n) : e.nums.concat(n);
        refresh();
      };
    });
    sheetZone.querySelectorAll('[data-mod]').forEach((b) => {
      b.onclick = () => {
        const m = parseInt(b.getAttribute('data-mod'), 10);
        e.bust = false;
        e.mods = e.mods.includes(m) ? e.mods.filter((x) => x !== m) : e.mods.concat(m);
        refresh();
      };
    });
    const x2 = sheetZone.querySelector('#x2Btn');
    if (x2) x2.onclick = () => { e.bust = false; e.x2 = !e.x2; refresh(); };
    sheetZone.querySelectorAll('[data-step]').forEach((b) => {
      b.onclick = () => { e.bust = false; e.pts = Math.max(0, e.pts + parseInt(b.getAttribute('data-step'), 10)); refresh(); };
    });
    sheetZone.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => { e.bust = false; e.pts += parseInt(b.getAttribute('data-add'), 10); refresh(); };
    });
    const input = sheetZone.querySelector('.pts-input');
    if (input) input.addEventListener('change', (ev) => { e.bust = false; e.pts = Math.max(0, parseInt(ev.target.value, 10) || 0); refresh(); });
    const mf = sheetZone.querySelector('#manualFlip');
    if (mf) mf.onclick = () => { e.bust = false; e.flip7 = !e.flip7; refresh(); };

    // Raté = 0 pt and jump straight to the next player
    sheetZone.querySelector('#bustBtn').onclick = () => {
      e.bust = !e.bust;
      saveState();
      if (e.bust && next) { sheetId = next; renderSheet(); } else if (e.bust) closeSheet(); else renderSheet();
    };
    sheetZone.querySelector('#okBtn').onclick = () => {
      saveState();
      if (next) { sheetId = next; renderSheet(); } else closeSheet();
    };
  }

  function render() {
    if (sheetId) renderSheet();
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
