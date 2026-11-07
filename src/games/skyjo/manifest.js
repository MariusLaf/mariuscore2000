import styles from './skyjo.css?inline';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap';

let styleEl = null;
let fontEl = null;

export default {
  id: 'skyjo',
  name: 'Skyjo',
  icon: '🃏',
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
