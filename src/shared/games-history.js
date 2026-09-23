// Shared "finished games" history: a modal listing past completed games
// (winner + final scores), independent from a game's own action log.
// See CONTRIBUTING_GAMES.md for the contract this implements.

function uid() {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

const dateFormatter = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function createGamesHistory({ container, button, storageKey }) {
  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch (e) {}
  }

  const overlay = document.createElement('div');
  overlay.className = 'games-history-overlay hidden';
  overlay.innerHTML = `
    <div class="games-history-card">
      <h3 class="games-history-title">Historique des parties</h3>
      <div class="games-history-list"></div>
      <div class="games-history-actions">
        <button type="button" class="games-history-clear">Vider l'historique</button>
        <button type="button" class="games-history-close">Fermer</button>
      </div>
    </div>
  `;
  container.appendChild(overlay);

  const listEl = overlay.querySelector('.games-history-list');

  function renderList() {
    const games = load();
    if (games.length === 0) {
      listEl.innerHTML = '<p class="history-empty">Aucune partie terminée pour l\'instant.</p>';
      return;
    }
    listEl.innerHTML = games.map((game) => {
      let dateLabel = game.date;
      try { dateLabel = dateFormatter.format(new Date(game.date)); } catch (e) {}
      const players = game.players
        .slice()
        .sort((a, b) => b.score - a.score)
        .map((p) => `<span class="history-player${p.name === game.winnerName ? ' winner' : ''}">${escapeAttr(p.name)} ${p.score}</span>`)
        .join('');
      return `<div class="history-item">
        <div class="history-item-top">
          <span class="history-date">${escapeAttr(dateLabel)}</span>
          <button type="button" class="history-delete" data-delete="${game.id}" aria-label="Supprimer cette partie">×</button>
        </div>
        <div class="history-players">${players}</div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        save(load().filter((g) => g.id !== btn.getAttribute('data-delete')));
        renderList();
      });
    });
  }

  button.addEventListener('click', () => {
    renderList();
    overlay.classList.remove('hidden');
  });
  overlay.querySelector('.games-history-close').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.querySelector('.games-history-clear').addEventListener('click', () => {
    save([]);
    renderList();
  });

  function record(winnerName, players) {
    const list = load();
    list.unshift({
      id: uid(),
      date: new Date().toISOString(),
      winnerName,
      players: players.map((p) => ({ name: p.name, score: p.score }))
    });
    save(list.slice(0, 100));
  }

  return { record };
}

// The player with the highest score, for games without a fixed win condition
// (or to record an early/manual reset before anyone formally won).
export function pickLeader(players) {
  return players.reduce((best, p) => (!best || p.score > best.score ? p : best), null);
}
