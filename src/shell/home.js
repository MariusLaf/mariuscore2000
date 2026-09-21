export function renderHome(root, games, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'home-screen';

  const header = document.createElement('header');
  header.className = 'home-header';
  header.innerHTML = `
    <h1>MariuScore2000</h1>
    <p>Choisis un jeu pour commencer à compter les points.</p>
  `;
  wrap.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'home-grid';

  games.forEach((manifest) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-card';
    if (manifest.themeColor) {
      card.style.setProperty('--card-accent', manifest.themeColor);
    }
    card.innerHTML = `
      <span class="game-card-icon">${manifest.icon || '🎲'}</span>
      <span class="game-card-name">${manifest.name}</span>
      <span class="game-card-desc">${manifest.description || ''}</span>
    `;
    card.addEventListener('click', () => onSelect(manifest.id));
    grid.appendChild(card);
  });

  if (games.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'home-empty';
    empty.textContent = 'Aucun jeu pour le moment.';
    grid.appendChild(empty);
  }

  wrap.appendChild(grid);
  root.appendChild(wrap);
}
