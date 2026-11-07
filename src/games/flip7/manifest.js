import styles from './flip7.css?inline';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap';

let styleEl = null;
let fontEl = null;

export default {
  id: 'flip7',
  name: 'Flip 7',
  icon: '<svg viewBox="0 0 28 38" width="1.5em" height="1.5em" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1.5" y="1.5" width="25" height="35" rx="4" fill="#fff6dc" stroke="#2b2a7c" stroke-width="2"/><text x="14" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="19" fill="#2b2a7c">7</text></svg>',
  description: "Compteur de points pour le jeu de cartes Flip 7 (objectif 200).",
  themeColor: '#2aa3a6',

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
