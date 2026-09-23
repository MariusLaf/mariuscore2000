import { attachLogToggle } from '../../shared/player-board.js';
import { createGamesHistory, pickLeader } from '../../shared/games-history.js';

const MARKUP = `
<div class="wrap">
  <div class="brand">
    <h1>Jass<span class="dot">.</span></h1>
    <div class="header-actions">
      <button class="icon-btn-sm" id="infoBtn" title="La convention du Z">ℹ️</button>
      <button class="icon-btn-sm" id="gamesHistoryBtn" title="Historique des parties">🕓</button>
      <button class="icon-btn-sm" id="undoBtn" title="Annuler la dernière action">↩︎</button>
      <button class="icon-btn-sm" id="resetScoresBtn" title="Remettre les scores à zéro">🔄</button>
      <button class="icon-btn-sm danger" id="resetAllBtn" title="Tout réinitialiser">🗑</button>
    </div>
  </div>

  <div id="teamsZone"></div>

  <button class="log-toggle" id="logToggle">▸ Historique des manches</button>
  <div class="log" id="log"></div>
</div>

<div id="infoOverlay" class="modal-overlay hidden">
  <div class="modal-card">
    <h3 class="modal-title">La convention du Z</h3>
    <p class="modal-message">Chaque équipe a sa propre ardoise. Le score total se lit en additionnant les traits :</p>
    <ul class="legend-list">
      <li><span class="legend-swatch swatch-blue"></span> traits = 100 points chacun</li>
      <li><span class="legend-swatch swatch-green"></span> traits = 50 points chacun</li>
      <li><span class="legend-swatch swatch-yellow"></span> traits = 20 points chacun</li>
      <li><span class="legend-swatch swatch-purple"></span> V (500) ou X (1000)</li>
      <li><span class="legend-swatch swatch-red"></span> le reste, écrit en chiffres</li>
    </ul>
    <p class="modal-message">Le téléphone se pose au milieu de la table : l'ardoise de l'équipe 2 est retournée à 180° pour se lire normalement depuis l'autre côté. Chaque équipe entre ses propres points et valide de son côté.</p>
    <button class="modal-ok" id="infoClose">Fermer</button>
  </div>
</div>
`;

const TEAM_TEMPLATE = () => ({ players: ['', ''], score: 0, tally: emptyTally() });

function emptyTally() { return { x: 0, v: 0, blue: 0, green: 0, yellow: 0, red: 0 }; }

function teamLabel(team, fallback) {
  const names = team.players.map((n) => n.trim()).filter(Boolean);
  return names.length ? names.join(' & ') : fallback;
}

// One-time decomposition of a raw total, used only to migrate a save from
// before per-zone tallies existed. Never used to re-derive the display from
// the total during normal play — see addPointsToTally().
function decompose(totalScore) {
  let n = Math.max(0, Math.trunc(totalScore || 0));
  const x = Math.floor(n / 1000); n %= 1000;
  const v = Math.floor(n / 500); n %= 500;
  const blue = Math.floor(n / 100); n %= 100;
  const green = Math.floor(n / 50); n %= 50;
  const yellow = Math.floor(n / 20); n %= 20;
  const red = n;
  return { x, v, blue, green, yellow, red };
}

// The traditional ardoise never erases or reorganizes existing strokes: new
// points only ever ADD marks. Only the "reste" (red) digit is overwritten,
// since it's redrawn fresh every time anyway. A round's own points are
// broken into the biggest denominations first, and whatever's left over is
// added to the existing reste — carrying into a new yellow stroke if that
// pushes it past 19.
function addPointsToTally(tally, points) {
  let remaining = Math.max(0, Math.trunc(points || 0));
  const newX = Math.floor(remaining / 1000); remaining %= 1000;
  const newV = Math.floor(remaining / 500); remaining %= 500;
  const newBlue = Math.floor(remaining / 100); remaining %= 100;
  const newGreen = Math.floor(remaining / 50); remaining %= 50;
  const newYellow = Math.floor(remaining / 20); remaining %= 20;

  let combinedRed = tally.red + remaining;
  const carryYellow = Math.floor(combinedRed / 20);
  combinedRed %= 20;

  tally.x += newX;
  tally.v += newV;
  tally.blue += newBlue;
  tally.green += newGreen;
  tally.yellow += newYellow + carryYellow;
  tally.red = combinedRed;
}

function tallySVG(count, extraClass) {
  if (count <= 0) return '<span class="tally-empty">—</span>';
  const groups = [];
  let remaining = count;
  while (remaining > 0) {
    const inGroup = Math.min(5, remaining);
    groups.push(inGroup);
    remaining -= inGroup;
  }
  const groupWidth = 20;
  const width = groups.length * groupWidth + 6;
  let marks = '';
  let x = 5;
  groups.forEach((n) => {
    const verticals = Math.min(n, 4);
    for (let i = 0; i < verticals; i++) {
      marks += `<line x1="${x + i * 4}" y1="3" x2="${x + i * 4}" y2="21" />`;
    }
    if (n === 5) {
      marks += `<line x1="${x - 2}" y1="19" x2="${x + 14}" y2="3" />`;
    }
    x += groupWidth;
  });
  return `<svg class="tally-svg ${extraClass || ''}" viewBox="0 0 ${width} 24" preserveAspectRatio="xMinYMid meet">${marks}</svg>`;
}

// The 50-point marks aren't grouped-by-5 tally bars like the 20s and 100s:
// each pair of 50s is drawn as a single crossed "X" (2×50 = 100), with a
// lone "\" for an odd one left over.
function tallyPairSVG(count, extraClass) {
  if (count <= 0) return '<span class="tally-empty">—</span>';
  const pairs = Math.floor(count / 2);
  const remainder = count % 2;
  const symbolWidth = 20;
  const width = (pairs + remainder) * symbolWidth + 6;
  let marks = '';
  let x = 5;
  for (let i = 0; i < pairs; i++) {
    marks += `<line x1="${x}" y1="3" x2="${x + 14}" y2="21" /><line x1="${x}" y1="21" x2="${x + 14}" y2="3" />`;
    x += symbolWidth;
  }
  if (remainder) {
    marks += `<line x1="${x}" y1="3" x2="${x + 14}" y2="21" />`;
  }
  return `<svg class="tally-svg ${extraClass || ''}" viewBox="0 0 ${width} 24" preserveAspectRatio="xMinYMid meet">${marks}</svg>`;
}

function renderArdoise(tally) {
  const { x, v, blue, green, yellow, red } = tally;
  const purple = (x > 0 || v > 0)
    ? (Array.from({ length: x }, () => 'X').join(' ') + (v > 0 ? (x > 0 ? ' V' : 'V') : ''))
    : '—';
  return `
    <div class="ardoise">
      <div class="ardoise-zone zone-red">
        <span class="zone-label">reste</span>
        <span class="zone-value red-number">${red}</span>
      </div>
      <div class="ardoise-zone zone-yellow">
        <span class="zone-label">×20</span>
        ${tallySVG(yellow, 'tally-yellow')}
      </div>
      <div class="ardoise-zone zone-green">
        <span class="zone-label">×50</span>
        ${tallyPairSVG(green, 'tally-green')}
      </div>
      <div class="ardoise-zone zone-purple">
        <span class="zone-label">500/1000</span>
        <span class="zone-value purple-symbol">${purple}</span>
      </div>
      <div class="ardoise-zone zone-blue">
        <span class="zone-label">×100</span>
        ${tallySVG(blue, 'tally-blue')}
      </div>
    </div>
  `;
}

export default function initJass(container) {
  container.innerHTML = MARKUP;

  const STORAGE_KEY = 'jass-state-v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.teams) && parsed.teams.length === 2) return parsed;
      return null;
    } catch (e) { return null; }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  let state = loadState() || {
    teams: [TEAM_TEMPLATE(), TEAM_TEMPLATE()],
    log: [],
    history: []
  };
  if (!Array.isArray(state.log)) state.log = [];
  if (!Array.isArray(state.history)) state.history = [];
  state.teams.forEach((t) => {
    if (!t.tally) t.tally = decompose(t.score); // migrate a save from before per-zone tallies
  });

  const teamsZone = container.querySelector('#teamsZone');
  const logEl = container.querySelector('#log');
  const undoBtn = container.querySelector('#undoBtn');
  const infoBtn = container.querySelector('#infoBtn');
  const infoOverlay = container.querySelector('#infoOverlay');
  const infoClose = container.querySelector('#infoClose');

  infoBtn.addEventListener('click', () => infoOverlay.classList.remove('hidden'));
  infoClose.addEventListener('click', () => infoOverlay.classList.add('hidden'));

  const gamesHistory = createGamesHistory({
    container,
    button: container.querySelector('#gamesHistoryBtn'),
    storageKey: 'jass-games-history-v1'
  });

  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function pushHistory() {
    state.history.push(JSON.stringify({ teams: state.teams, log: state.log }));
    if (state.history.length > 30) state.history.shift();
  }

  function undo() {
    if (state.history.length === 0) return;
    const prev = JSON.parse(state.history.pop());
    state.teams = prev.teams;
    state.log = prev.log;
    saveState();
    render();
  }

  function addLog(text, delta) {
    state.log.unshift({ text, delta });
    if (state.log.length > 40) state.log.length = 40;
  }

  function maybeRecordGame() {
    const hasActivity = state.teams.some((t) => t.score > 0);
    if (!hasActivity) return;
    const named = state.teams.map((t, i) => ({ name: teamLabel(t, 'Équipe ' + (i + 1)), score: t.score }));
    gamesHistory.record(pickLeader(named).name, named);
  }

  function applyTeamPoints(teamIndex, input) {
    const raw = parseInt(input.value, 10);
    const points = isNaN(raw) ? 0 : Math.max(0, raw);
    if (points === 0) return;
    pushHistory();
    const team = state.teams[teamIndex];
    team.score += points;
    addPointsToTally(team.tally, points);
    addLog(teamLabel(team, 'Équipe ' + (teamIndex + 1)) + ' +' + points, points);
    saveState();
    render();
  }

  undoBtn.addEventListener('click', undo);
  container.querySelector('#resetScoresBtn').addEventListener('click', () => {
    maybeRecordGame();
    pushHistory();
    state.teams.forEach((t) => { t.score = 0; t.tally = emptyTally(); });
    state.log = [];
    saveState();
    render();
  });
  container.querySelector('#resetAllBtn').addEventListener('click', () => {
    maybeRecordGame();
    state = { teams: [TEAM_TEMPLATE(), TEAM_TEMPLATE()], log: [], history: [] };
    saveState();
    render();
  });

  attachLogToggle(container.querySelector('#logToggle'), logEl, 'Historique des manches');

  function wireTeamPanel(teamIndex) {
    teamsZone.querySelectorAll(`[data-player-input][data-team="${teamIndex}"]`).forEach((input) => {
      const playerIndex = parseInt(input.getAttribute('data-player-input'), 10);
      input.addEventListener('input', (e) => {
        state.teams[teamIndex].players[playerIndex] = e.target.value;
        saveState();
      });
    });

    const pointsInput = teamsZone.querySelector(`[data-points-input="${teamIndex}"]`);
    const validateBtn = teamsZone.querySelector(`[data-validate="${teamIndex}"]`);
    const commit = () => { applyTeamPoints(teamIndex, pointsInput); };
    validateBtn.addEventListener('click', commit);
    pointsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  }

  function renderTeamPanel(team, i) {
    return `
      <div class="team-names">
        <input type="text" class="team-name-input" placeholder="Joueur ${i * 2 + 1}" value="${escapeAttr(team.players[0])}" data-team="${i}" data-player-input="0">
        <span class="team-and">&amp;</span>
        <input type="text" class="team-name-input" placeholder="Joueur ${i * 2 + 2}" value="${escapeAttr(team.players[1])}" data-team="${i}" data-player-input="1">
      </div>
      <div class="team-score">${team.score}</div>
      ${renderArdoise(team.tally)}
      <div class="round-entry">
        <input type="number" inputmode="numeric" min="0" placeholder="Points de la manche" data-points-input="${i}">
        <button type="button" data-validate="${i}">Valider</button>
      </div>
    `;
  }

  function render() {
    // Team 1's panel sits at the top of the phone, closest to team 1's own
    // side of the table, so it must be flipped 180° to read right-side up
    // from there (facing outward, away from the table's center) — team 2's
    // panel, at the bottom near their side, already reads correctly as-is.
    teamsZone.innerHTML = `
      <div class="team-panel team-panel-mirrored"><div class="mirror-inner">${renderTeamPanel(state.teams[0], 0)}</div></div>
      <div class="team-panel">${renderTeamPanel(state.teams[1], 1)}</div>
    `;

    wireTeamPanel(0);
    wireTeamPanel(1);

    undoBtn.style.opacity = state.history.length === 0 ? '0.5' : '1';

    if (state.log.length > 0) {
      logEl.innerHTML = state.log.slice(0, 12).map((entry) => {
        const deltaClass = entry.delta > 0 ? 'plus' : (entry.delta < 0 ? 'minus' : '');
        const deltaText = entry.delta === 0 ? '=' : (entry.delta > 0 ? '+' + entry.delta : entry.delta);
        return `<div class="log-item"><span>${escapeAttr(entry.text)}</span><span class="delta ${deltaClass}">${deltaText}</span></div>`;
      }).join('');
    } else {
      logEl.innerHTML = '';
    }
  }

  render();
}
