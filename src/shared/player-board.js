// Shared player-board: player add/remove/rename/reorder + chip rendering,
// used by every game so this logic (and its bug fixes) lives in one place.
// See CONTRIBUTING_GAMES.md for the contract this implements.

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

export function createPlayerBoard(config) {
  const {
    container,              // the scoreboard element; its innerHTML is fully owned by this board
    getPlayers,             // () => live players array reference
    getCurrentIndex,        // () => number
    setCurrentIndex,        // (n) => void
    newPlayer,              // () => object with the game's own default fields (must include score)
    renderStat,             // (player) => html string, the secondary line under the score
    formatScore,            // (n) => string, defaults to String(n)
    beforeChange,           // () => void, called before add/remove/reorder (e.g. push an undo snapshot)
    afterChange             // () => void, called after any mutation (e.g. save + re-render the game)
  } = config;

  const toScoreText = formatScore || ((n) => String(n));

  let editingId = null;
  let dragState = null;

  function addPlayer() {
    beforeChange();
    const players = getPlayers();
    const player = Object.assign(
      { id: uid(), name: 'Joueur ' + (players.length + 1) },
      newPlayer()
    );
    players.push(player);
    editingId = player.id; // straight into rename mode: named in the tile
    afterChange();
  }

  function removePlayer(id) {
    beforeChange();
    const players = getPlayers();
    const idx = players.findIndex((p) => p.id === id);
    if (idx === -1) return;
    players.splice(idx, 1);
    let current = getCurrentIndex();
    if (idx < current) current -= 1;
    if (current >= players.length) current = 0;
    if (current < 0) current = 0;
    setCurrentIndex(current);
    afterChange();
  }

  function reorderPlayers(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const players = getPlayers();
    if (fromIndex < 0 || fromIndex >= players.length) return;
    toIndex = Math.max(0, Math.min(players.length - 1, toIndex));
    beforeChange();
    const current = players[getCurrentIndex()];
    const currentId = current ? current.id : null;
    const [moved] = players.splice(fromIndex, 1);
    players.splice(toIndex, 0, moved);
    if (currentId) {
      const newIdx = players.findIndex((p) => p.id === currentId);
      if (newIdx !== -1) setCurrentIndex(newIdx);
    }
    afterChange();
  }

  // ---------- Drag-to-reorder (pointer events: works with mouse and touch) ----------
  // Pointer capture must be set on the SAME element the move/up listeners are attached to
  // (the handle), otherwise events get redirected to the captured element and never reach them.
  function onChipDragStart(e, index) {
    e.preventDefault();
    const handle = e.currentTarget;
    const chip = container.children[index];
    if (!chip) return;
    const rect = chip.getBoundingClientRect();
    const styles = getComputedStyle(container);
    const gap = parseFloat(styles.columnGap || styles.gap || '8') || 8;
    dragState = {
      startIndex: index,
      currentIndex: index,
      startX: e.clientX,
      chipWidth: rect.width + gap,
      chip,
      pointerId: e.pointerId
    };
    chip.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  }

  function onChipDragMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startX;
    dragState.chip.style.transform = `translateX(${dx}px)`;
    const shift = Math.round(dx / dragState.chipWidth);
    dragState.currentIndex = Math.min(getPlayers().length - 1, Math.max(0, dragState.startIndex + shift));
  }

  function onChipDragEnd(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    dragState.chip.classList.remove('dragging');
    dragState.chip.style.transform = '';
    const { startIndex, currentIndex } = dragState;
    dragState = null;
    if (currentIndex !== startIndex) {
      reorderPlayers(startIndex, currentIndex);
    }
  }

  function render() {
    const players = getPlayers();
    const currentIndex = getCurrentIndex();

    container.innerHTML = players.map((p, i) => `
      <div class="chip ${i === currentIndex ? 'active' : ''}">
        <button class="chip-remove" data-remove="${p.id}" title="Retirer ce joueur">×</button>
        ${editingId === p.id
          ? `<input type="text" class="chip-name-input" data-editing="${p.id}" value="${escapeAttr(p.name)}" maxlength="20">`
          : `<p class="chip-name" data-rename="${p.id}" title="Toucher pour renommer">${escapeAttr(p.name)}</p>`}
        <p class="chip-score">${toScoreText(p.score)}</p>
        ${renderStat(p)}
        <span class="chip-drag" data-drag="${i}" title="Glisser pour réordonner">⠿</span>
      </div>
    `).join('') + `<button type="button" class="chip chip-add" title="Ajouter un joueur">
      <span class="chip-add-icon">+</span><span class="chip-add-label">Joueur</span>
    </button>`;

    container.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePlayer(btn.getAttribute('data-remove'));
      });
    });
    container.querySelectorAll('[data-rename]').forEach((el) => {
      el.addEventListener('click', () => {
        editingId = el.getAttribute('data-rename');
        render();
      });
    });
    container.querySelectorAll('[data-editing]').forEach((input) => {
      const id = input.getAttribute('data-editing');
      const commit = () => {
        const p = getPlayers().find((pl) => pl.id === id);
        const trimmed = input.value.trim();
        if (p && trimmed) p.name = trimmed;
        editingId = null;
        afterChange();
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { editingId = null; render(); }
      });
      input.addEventListener('click', (e) => e.stopPropagation());
      setTimeout(() => { input.focus(); input.select(); }, 0);
    });
    container.querySelectorAll('[data-drag]').forEach((handle) => {
      const index = parseInt(handle.getAttribute('data-drag'), 10);
      handle.addEventListener('pointerdown', (e) => onChipDragStart(e, index));
      handle.addEventListener('pointermove', onChipDragMove);
      handle.addEventListener('pointerup', onChipDragEnd);
      handle.addEventListener('pointercancel', onChipDragEnd);
    });
    container.querySelector('.chip-add').addEventListener('click', addPlayer);
  }

  return { render, addPlayer, removePlayer, reorderPlayers };
}

export function attachLogToggle(toggleEl, logEl, label) {
  toggleEl.addEventListener('click', () => {
    logEl.classList.toggle('open');
    toggleEl.textContent = (logEl.classList.contains('open') ? '▾' : '▸') + ' ' + label;
  });
}
