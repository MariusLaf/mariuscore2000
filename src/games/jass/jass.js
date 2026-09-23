import { attachLogToggle } from '../../shared/player-board.js';
import { createGamesHistory, pickLeader } from '../../shared/games-history.js';

const MARKUP = `
<div class="wrap">
  <div class="brand">
    <h1>Jass<span class="dot">.</span></h1>
    <div class="header-actions">
      <button class="icon-btn-sm" id="infoBtn" title="La convention du Z">ℹ️</button>
      <button class="icon-btn-sm" id="gamesHistoryBtn" title="Historique des parties">🕓</button>
      <button class="icon-btn-sm" id="undoBtn" title="Annuler la dernière manche">↩︎</button>
      <button class="icon-btn-sm" id="resetScoresBtn" title="Remettre les scores à zéro">🔄</button>
      <button class="icon-btn-sm danger" id="resetAllBtn" title="Tout réinitialiser">🗑</button>
    </div>
  </div>

  <div id="teamsZone"></div>

  <div class="round-card">
    <p class="section-label">Manche en cours</p>
    <div class="round-row">
      <label class="round-field">
        <span class="round-field-label" id="team1Label">Équipe 1</span>
        <input type="number" inputmode="numeric" min="0" placeholder="0" id="round1Input">
      </label>
      <label class="round-field">
        <span class="round-field-label" id="team2Label">Équipe 2</span>
        <input type="number" inputmode="numeric" min="0" placeholder="0" id="round2Input">
      </label>
    </div>
    <button class="primary-btn" id="validateRoundBtn">Valider la manche</button>
  </div>

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
    <p class="modal-message">Entre les points marqués par chaque équipe après chaque manche ; l'ardoise se redessine automatiquement.</p>
    <button class="modal-ok" id="infoClose">Fermer</button>
  </div>
</div>
`;

const TEAM_TEMPLATE = () => ({ players: ['', ''], score: 0 });

function teamLabel(team, fallback) {
  const names = team.players.map((n) => n.trim()).filter(Boolean);
  return names.length ? names.join(' & ') : fallback;
}

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

function renderArdoise(score) {
  const { x, v, blue, green, yellow, red } = decompose(score);
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
        ${tallySVG(green, 'tally-green')}
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

  const teamsZone = container.querySelector('#teamsZone');
  const logEl = container.querySelector('#log');
  const round1Input = container.querySelector('#round1Input');
  const round2Input = container.querySelector('#round2Input');
  const team1Label = container.querySelector('#team1Label');
  const team2Label = container.querySelector('#team2Label');
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

  function validateRound() {
    const p1 = parseInt(round1Input.value, 10);
    const p2 = parseInt(round2Input.value, 10);
    const points = [isNaN(p1) ? 0 : p1, isNaN(p2) ? 0 : p2];
    if (points[0] === 0 && points[1] === 0) return;
    pushHistory();
    state.teams.forEach((t, i) => { t.score += Math.max(0, points[i]); });
    const label1 = teamLabel(state.teams[0], 'Équipe 1');
    const label2 = teamLabel(state.teams[1], 'Équipe 2');
    addLog(label1 + ' +' + Math.max(0, points[0]) + ' · ' + label2 + ' +' + Math.max(0, points[1]), points[0] - points[1]);

    round1Input.value = '';
    round2Input.value = '';
    saveState();
    render();
  }

  container.querySelector('#validateRoundBtn').addEventListener('click', validateRound);
  [round1Input, round2Input].forEach((input) => {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') validateRound(); });
  });

  undoBtn.addEventListener('click', undo);
  container.querySelector('#resetScoresBtn').addEventListener('click', () => {
    maybeRecordGame();
    pushHistory();
    state.teams.forEach((t) => { t.score = 0; });
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

  function renderTeamNames() {
    teamsZone.querySelectorAll('[data-player-input]').forEach((input) => {
      const teamIndex = parseInt(input.getAttribute('data-team'), 10);
      const playerIndex = parseInt(input.getAttribute('data-player-input'), 10);
      input.addEventListener('input', (e) => {
        state.teams[teamIndex].players[playerIndex] = e.target.value;
        saveState();
        team1Label.textContent = teamLabel(state.teams[0], 'Équipe 1');
        team2Label.textContent = teamLabel(state.teams[1], 'Équipe 2');
      });
    });
  }

  function render() {
    teamsZone.innerHTML = state.teams.map((team, i) => `
      <div class="team-panel">
        <div class="team-names">
          <input type="text" class="team-name-input" placeholder="Joueur ${i * 2 + 1}" value="${escapeAttr(team.players[0])}" data-team="${i}" data-player-input="0">
          <span class="team-and">&amp;</span>
          <input type="text" class="team-name-input" placeholder="Joueur ${i * 2 + 2}" value="${escapeAttr(team.players[1])}" data-team="${i}" data-player-input="1">
        </div>
        <div class="team-score">${team.score}</div>
        ${renderArdoise(team.score)}
      </div>
    `).join('');

    renderTeamNames();

    team1Label.textContent = teamLabel(state.teams[0], 'Équipe 1');
    team2Label.textContent = teamLabel(state.teams[1], 'Équipe 2');

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
