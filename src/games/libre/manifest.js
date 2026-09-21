import styles from './libre.css?inline';

let styleEl = null;

export default {
  id: 'libre',
  name: 'Compteur libre',
  icon: '🧮',
  description: "Points libres et compteur secondaire pour improviser n'importe quel jeu.",
  themeColor: '#3B6FD6',

  async mount(container) {
    styleEl = document.createElement('style');
    styleEl.dataset.game = 'libre';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    const { default: initLibre } = await import('./libre.js');
    initLibre(container);
  },

  unmount() {
    if (styleEl) { styleEl.remove(); styleEl = null; }
  }
};
