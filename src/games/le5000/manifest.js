import styles from './le5000.css?inline';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap';

let styleEl = null;
let fontEl = null;

export default {
  id: 'le5000',
  name: 'Le 5000',
  icon: '🎲',
  description: "Compteur de points pour le jeu de dés Le 5000.",
  themeColor: '#d9a441',

  async mount(container) {
    styleEl = document.createElement('style');
    styleEl.dataset.game = 'le5000';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    fontEl = document.createElement('link');
    fontEl.rel = 'stylesheet';
    fontEl.href = FONT_HREF;
    fontEl.dataset.game = 'le5000';
    document.head.appendChild(fontEl);

    const { default: initLe5000 } = await import('./le5000.js');
    initLe5000(container);
  },

  unmount() {
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (fontEl) { fontEl.remove(); fontEl = null; }
  }
};
