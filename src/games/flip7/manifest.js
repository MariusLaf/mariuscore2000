import styles from './flip7.css?inline';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap';

let styleEl = null;
let fontEl = null;

export default {
  id: 'flip7',
  name: 'Flip 7',
  icon: '🃏',
  description: "Compteur de points pour le jeu de cartes Flip 7 (objectif 200).",
  themeColor: '#e0568a',

  async mount(container) {
    styleEl = document.createElement('style');
    styleEl.dataset.game = 'flip7';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    fontEl = document.createElement('link');
    fontEl.rel = 'stylesheet';
    fontEl.href = FONT_HREF;
    fontEl.dataset.game = 'flip7';
    document.head.appendChild(fontEl);

    const { default: initFlip7 } = await import('./flip7.js');
    initFlip7(container);
  },

  unmount() {
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (fontEl) { fontEl.remove(); fontEl = null; }
  }
};
