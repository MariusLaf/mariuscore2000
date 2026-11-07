import styles from './skyjo.css?inline';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap';

let styleEl = null;
let fontEl = null;

export default {
  id: 'skyjo',
  name: 'Skyjo',
  icon: '<svg viewBox="0 0 28 38" width="1.5em" height="1.5em" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1.5" y="1.5" width="25" height="35" rx="4" fill="#ffffff" stroke="#185FA5" stroke-width="2"/><text x="14" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="13" fill="#185FA5">-2</text></svg>',
  description: "Compteur de points pour le jeu de cartes Skyjo.",
  themeColor: '#ff4d6d',

  async mount(container) {
    styleEl = document.createElement('style');
    styleEl.dataset.game = 'skyjo';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    fontEl = document.createElement('link');
    fontEl.rel = 'stylesheet';
    fontEl.href = FONT_HREF;
    fontEl.dataset.game = 'skyjo';
    document.head.appendChild(fontEl);

    const { default: initSkyjo } = await import('./skyjo.js');
    initSkyjo(container);
  },

  unmount() {
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (fontEl) { fontEl.remove(); fontEl = null; }
  }
};
