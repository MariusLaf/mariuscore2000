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
      <button class="icon-btn-sm danger" id="resetAllBtn" title="Tout réinitialiser">🆕</button>
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
    <p class="modal-message">Le téléphone se pose au milieu de la table : l'ardoise de l'équipe 1 est retournée à 180° pour se lire normalement depuis l'autre côté. Un bouton ⇅ dans la saisie permet de retourner le clavier manuellement si besoin.</p>
    <p class="modal-message">« Saisir les points » ouvre un clavier avec les annonces (20 à 200). Une manche vaut 157 points hors annonces (257 pour un capot) : cochez « L'autre équipe marque 157 − plis » pour que l'équipe adverse soit créditée automatiquement.</p>
    <button class="modal-ok" id="infoClose">Fermer</button>
  </div>
</div>

<div id="entryOverlay" class="modal-overlay hidden">
  <div class="entry-card" id="entryCard">
    <div class="entry-card-inner" id="entryCardInner">
      <div class="entry-header">
        <div class="entry-team-tabs" id="entryTeamTabs"></div>
        <div class="entry-header-actions">
          <button type="button" class="entry-flip" id="entryFlip" title="Retourner le clavier">⇅</button>
          <button type="button" class="entry-close" id="entryClose">✕</button>
        </div>
      </div>
      <div id="entryBody"></div>
    </div>
  </div>
</div>
`;

// The fixed set of card-combination announces, each worth a fixed value
// regardless of how many such combinations exist — see
// https://fr.wikipedia.org/wiki/Jass for the full probability table. Quinte
// and Carré (As) share the same value (100) but are distinct declarations,
// so they get separate toggle buttons.
//
// `max` caps how many times a team can declare the same announce in one
// hand, per the 36-card deck: Stöck and each Carré are backed by a single,
// unique set of cards (one trump king+queen, one set of four of a given
// rank), so a team can hold at most one. A run (tierce/quarte/quinte) can be
// held by either partner, so a team can hold at most two — never three.
const ANNONCES = [
  { key: 'tierce', value: 20, label: 'Tierce', title: 'Suite de 3 cartes (20 pts)', max: 2 },
  { key: 'stock', value: 20, label: 'Stöck', title: 'Roi + dame d\'atout (20 pts)', max: 1 },
  { key: 'quarte', value: 50, label: 'Quarte', title: 'Suite de 4 cartes (50 pts)', max: 2 },
  { key: 'quinte', value: 100, label: 'Quinte', title: 'Suite de 5 cartes ou plus (100 pts)', max: 2 },
  { key: 'carreAs', value: 100, label: 'Carré As', title: 'Quatre 10, dames, rois ou as (100 pts)', max: 1 },
  { key: 'carreNeuf', value: 150, label: 'Carré 9', title: 'Quatre neufs (150 pts)', max: 1 },
  { key: 'carreValets', value: 200, label: 'Carré V', title: 'Quatre valets (200 pts)', max: 1 }
];

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
//
// A single round is worth at most ~257 (a capot), so a round's own points
// never reach 500 on their own — the only way the running total crosses the
// 500/1000 marks is by accumulating enough ×100 strokes over several rounds.
// So, same as the reste→×20 carry above, five ×100 strokes carry into one
// "V" and two "V"s carry into one "X".
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

  const carryV = Math.floor(tally.blue / 5);
  tally.blue %= 5;
  tally.v += carryV;
  const carryX = Math.floor(tally.v / 2);
  tally.v %= 2;
  tally.x += carryX;
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
      <div class="ardoise-zone zone-purple">
        <span class="zone-label">500/1000</span>
        <span class="zone-value purple-symbol">${purple}</span>
      </div>
      <div class="ardoise-zone zone-blue">
        <span class="zone-label">×100</span>
        ${tallySVG(blue, 'tally-blue')}
      </div>
      <div class="ardoise-zone zone-red">
        <span class="zone-label">reste</span>
        <span class="zone-value red-number">${red}</span>
      </div>
      <div class="ardoise-zone zone-green">
        <span class="zone-label">×50</span>
        ${tallyPairSVG(green, 'tally-green')}
      </div>
      <div class="ardoise-zone zone-yellow">
        <span class="zone-label">×20</span>
        ${tallySVG(yellow, 'tally-yellow')}
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
  // Points being keyed in for the current round, per team. Kept outside
  // `state` since it's a transient entry in progress, not a committed score.
  // Card points (base) are tracked separately from annonces because only
  // the base counts toward the 157-point pool used for the auto-complement.
  // Announces are toggles (keyed by ANNONCES[].key) rather than a running
  // total, so each one can be switched back off if tapped by mistake, and
  // several different announces can be active at once for the same team.
  let pendingBase = [0, 0];
  let pendingAnnonceActive = [{}, {}];
  let autoComplement = true;
  let manualFlip = [false, false];
  let activeEntryTeam = null;
  // Orientation of the entry card, fixed when it is opened from a team panel
  // so that switching team tabs never flips the view.
  let entryMirrored = false;

  function annonceTotal(teamIndex) {
    return ANNONCES.reduce((sum, a) => sum + (pendingAnnonceActive[teamIndex][a.key] || 0) * a.value, 0);
  }

  function pendingTotal(teamIndex) {
    return pendingBase[teamIndex] + annonceTotal(teamIndex);
  }

  function isMirrored(teamIndex) {
    // Team 1's modal/panel is flipped 180° by default so it reads right-side
    // up from their side of the table; the manual flip button toggles that.
    return (teamIndex === 0) !== manualFlip[teamIndex];
  }
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

  const entryOverlay = container.querySelector('#entryOverlay');
  const entryCard = container.querySelector('#entryCard');
  const entryTeamTabs = container.querySelector('#entryTeamTabs');
  const entryClose = container.querySelector('#entryClose');
  const entryFlip = container.querySelector('#entryFlip');
  const entryBody = container.querySelector('#entryBody');

  entryClose.addEventListener('click', closeEntryModal);
  entryOverlay.addEventListener('click', (e) => { if (e.target === entryOverlay) closeEntryModal(); });
  entryFlip.addEventListener('click', () => {
    if (activeEntryTeam === null) return;
    manualFlip[activeEntryTeam] = !manualFlip[activeEntryTeam];
    entryMirrored = !entryMirrored;
    entryCard.classList.toggle('entry-card-mirrored', entryMirrored);
  });

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

  function autoComplementLabel(teamIndex) {
    const base = pendingBase[teamIndex];
    if (base <= 0) return 'L\'autre équipe marque 157 − plis';
    if (base >= 157) return 'L\'autre équipe ne marque rien (157 déjà atteint)';
    return `L'autre équipe marque ${157 - base} points`;
  }

  function annonceButtonLabel(a, count) {
    const countBadge = count > 1 ? ` <span class="annonce-count">×${count}</span>` : '';
    return `${a.label} <span class="annonce-value">${a.value}</span>${countBadge}`;
  }

  function summaryText(teamIndex) {
    const annonces = annonceTotal(teamIndex);
    const total = pendingTotal(teamIndex);
    if (annonces > 0) return `+ ${annonces} d'annonces = ${total} points`;
    return `${total} point${total === 1 ? '' : 's'} à valider`;
  }

  // The keypad only ever edits the "plis" (card points) figure, kept visibly
  // separate from the annonces total — those two are never the same number,
  // since only the plis count toward the 157-point pool used for the
  // auto-complement (see commitPoints below).
  function updatePointsDisplay(teamIndex) {
    const modalDisplay = entryOverlay.querySelector(`[data-points-display="${teamIndex}"]`);
    if (modalDisplay) modalDisplay.textContent = String(pendingBase[teamIndex]);
    const summary = entryOverlay.querySelector(`[data-points-summary="${teamIndex}"]`);
    if (summary) summary.textContent = summaryText(teamIndex);
    const badge = teamsZone.querySelector(`[data-pending-badge="${teamIndex}"]`);
    const total = pendingTotal(teamIndex);
    if (badge) badge.textContent = total > 0 ? ` (${total})` : '';
    const autoLabel = entryOverlay.querySelector(`[data-auto-complement-label="${teamIndex}"]`);
    if (autoLabel) autoLabel.textContent = autoComplementLabel(teamIndex);
  }

  function appendDigit(teamIndex, digit) {
    const current = pendingBase[teamIndex];
    const nextStr = (current === 0 ? '' : String(current)) + digit;
    if (nextStr.length > 3) return; // cap at 999, the 157-point pool never exceeds this
    pendingBase[teamIndex] = parseInt(nextStr, 10);
    updatePointsDisplay(teamIndex);
  }

  // Each tap cycles the count for that announce: 0 → 1 → … → its max (see
  // ANNONCES) → back to 0. This both lets a wrong tap be corrected (keep
  // tapping back to 0 — the only "undo" announces have, since they don't go
  // through the keypad's backspace) and lets a repeatable announce (a run,
  // held by either partner) be declared twice in the same hand.
  function cycleAnnonce(teamIndex, key) {
    const max = ANNONCES.find((a) => a.key === key).max;
    const current = pendingAnnonceActive[teamIndex][key] || 0;
    const next = current >= max ? 0 : current + 1;
    if (next === 0) delete pendingAnnonceActive[teamIndex][key];
    else pendingAnnonceActive[teamIndex][key] = next;
    updatePointsDisplay(teamIndex);
    return next;
  }

  function backspaceDigit(teamIndex) {
    pendingBase[teamIndex] = Math.floor(pendingBase[teamIndex] / 10);
    updatePointsDisplay(teamIndex);
  }

  // A Jass hand is worth 157 points total (hors annonces): once one team's
  // card points are known, the other team's are the complement to 157.
  function commitPoints(teamIndex) {
    const base = pendingBase[teamIndex];
    const annonces = annonceTotal(teamIndex);
    const points = base + annonces;
    if (points <= 0) return;
    pushHistory();

    const team = state.teams[teamIndex];
    team.score += points;
    addPointsToTally(team.tally, points);
    addLog(teamLabel(team, 'Équipe ' + (teamIndex + 1)) + ' +' + points, points);

    if (autoComplement && base > 0 && base < 157) {
      const otherIndex = 1 - teamIndex;
      const complement = 157 - base;
      const otherTeam = state.teams[otherIndex];
      otherTeam.score += complement;
      addPointsToTally(otherTeam.tally, complement);
      addLog(teamLabel(otherTeam, 'Équipe ' + (otherIndex + 1)) + ' +' + complement + ' (complément à 157)', complement);
    }

    pendingBase[teamIndex] = 0;
    pendingAnnonceActive[teamIndex] = {};
    saveState();
    render();
  }

  undoBtn.addEventListener('click', undo);
  container.querySelector('#resetScoresBtn').addEventListener('click', () => {
    maybeRecordGame();
    pushHistory();
    state.teams.forEach((t) => { t.score = 0; t.tally = emptyTally(); });
    state.log = [];
    pendingBase = [0, 0];
    pendingAnnonceActive = [{}, {}];
    saveState();
    render();
  });
  container.querySelector('#resetAllBtn').addEventListener('click', () => {
    maybeRecordGame();
    state = { teams: [TEAM_TEMPLATE(), TEAM_TEMPLATE()], log: [], history: [] };
    pendingBase = [0, 0];
    pendingAnnonceActive = [{}, {}];
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

    const openBtn = teamsZone.querySelector(`[data-open-entry="${teamIndex}"]`);
    openBtn.addEventListener('click', () => openEntryModal(teamIndex));

    updatePointsDisplay(teamIndex);
  }

  // The on-screen keypad/annonces live in a single shared modal (rather than
  // inline in each team panel) so both team panels stay short enough to fit
  // on screen together without scrolling.
  function entryBodyHTML(teamIndex) {
    return `
      <div class="annonces-row">
        <span class="annonces-label">Annonces</span>
        ${ANNONCES.map((a) => {
          const count = pendingAnnonceActive[teamIndex][a.key] || 0;
          return `<button type="button" class="annonce-btn${count > 0 ? ' active' : ''}" data-annonce-key="${a.key}" title="${escapeAttr(a.title)}">${annonceButtonLabel(a, count)}</button>`;
        }).join('')}
      </div>
      <div class="points-display-row">
        <div class="points-display-wrap">
          <span class="points-display-label">Points de plis</span>
          <div class="points-display" data-points-display="${teamIndex}">${pendingBase[teamIndex]}</div>
        </div>
        <button type="button" class="backspace-btn" data-backspace="${teamIndex}" title="Effacer le dernier chiffre">⌫</button>
      </div>
      <div class="points-summary" data-points-summary="${teamIndex}">${summaryText(teamIndex)}</div>
      <div class="keypad" data-keypad="${teamIndex}">
        <button type="button" data-key="7">7</button>
        <button type="button" data-key="8">8</button>
        <button type="button" data-key="9">9</button>
        <button type="button" data-key="4">4</button>
        <button type="button" data-key="5">5</button>
        <button type="button" data-key="6">6</button>
        <button type="button" data-key="1">1</button>
        <button type="button" data-key="2">2</button>
        <button type="button" data-key="3">3</button>
        <button type="button" class="keypad-zero" data-key="0">0</button>
        <button type="button" class="keypad-valider" data-validate="${teamIndex}">Valider</button>
      </div>
      <label class="auto-complement-row">
        <input type="checkbox" id="autoComplementToggle" ${autoComplement ? 'checked' : ''}>
        <span data-auto-complement-label="${teamIndex}">${autoComplementLabel(teamIndex)}</span>
      </label>
    `;
  }

  function wireEntryBody(teamIndex) {
    entryOverlay.querySelectorAll(`[data-annonce-key]`).forEach((btn) => {
      const key = btn.getAttribute('data-annonce-key');
      const annonce = ANNONCES.find((a) => a.key === key);
      btn.addEventListener('click', () => {
        const count = cycleAnnonce(teamIndex, key);
        btn.classList.toggle('active', count > 0);
        btn.innerHTML = annonceButtonLabel(annonce, count);
      });
    });

    const backspaceBtn = entryOverlay.querySelector(`[data-backspace="${teamIndex}"]`);
    backspaceBtn.addEventListener('click', () => backspaceDigit(teamIndex));

    entryOverlay.querySelectorAll(`[data-keypad="${teamIndex}"] [data-key]`).forEach((btn) => {
      btn.addEventListener('click', () => appendDigit(teamIndex, btn.getAttribute('data-key')));
    });

    const validateBtn = entryOverlay.querySelector(`[data-validate="${teamIndex}"]`);
    validateBtn.addEventListener('click', () => { commitPoints(teamIndex); closeEntryModal(); });

    const autoComplementToggle = entryOverlay.querySelector('#autoComplementToggle');
    autoComplementToggle.addEventListener('change', (e) => { autoComplement = e.target.checked; });
  }

  // The active team's tab is just a highlighted label; the other one doubles
  // as the "switch team" control, so both teams can key in their round
  // back-to-back without closing the popup in between.
  function renderEntryTeamTabs(teamIndex) {
    entryTeamTabs.innerHTML = [0, 1].map((i) => {
      const label = teamLabel(state.teams[i], 'Équipe ' + (i + 1));
      const isActive = i === teamIndex;
      return `<button type="button" class="entry-team-tab${isActive ? ' active' : ''}" data-switch-to="${i}">${escapeAttr(label)}</button>`;
    }).join('');
    entryTeamTabs.querySelectorAll('[data-switch-to]').forEach((btn) => {
      const target = parseInt(btn.getAttribute('data-switch-to'), 10);
      if (target !== teamIndex) btn.addEventListener('click', () => openEntryModal(target, true));
    });
  }

  function openEntryModal(teamIndex, keepOrientation) {
    activeEntryTeam = teamIndex;
    if (!keepOrientation) entryMirrored = isMirrored(teamIndex);
    renderEntryTeamTabs(teamIndex);
    entryBody.innerHTML = entryBodyHTML(teamIndex);
    wireEntryBody(teamIndex);
    entryCard.classList.toggle('entry-card-mirrored', entryMirrored);
    entryOverlay.classList.remove('hidden');
  }

  function closeEntryModal() {
    entryOverlay.classList.add('hidden');
    activeEntryTeam = null;
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
      <button type="button" class="open-entry-btn" data-open-entry="${i}">
        Saisir les points<span class="pending-badge" data-pending-badge="${i}"></span>
      </button>
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
