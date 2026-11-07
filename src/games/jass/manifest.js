import styles from './jass.css?inline';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Inter:wght@400;500;600;700&display=swap';

let styleEl = null;
let fontEl = null;

export default {
  id: 'jass',
  name: 'Jass',
  icon: '<svg viewBox="0 0 28 38" width="1.5em" height="1.5em" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1.5" y="1.5" width="25" height="35" rx="4" fill="#2E4A3A" stroke="#EDEAE0" stroke-width="2"/><text x="14" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="19" fill="#EDEAE0">Z</text></svg>',
  description: "Compteur de Jass à l'ardoise, avec l'affichage traditionnel en Z.",
  themeColor: '#2E4A3A',

  async mount(container) {
    styleEl = document.createElement('style');
    styleEl.dataset.game = 'jass';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    fontEl = document.createElement('link');
    fontEl.rel = 'stylesheet';
    fontEl.href = FONT_HREF;
    fontEl.dataset.game = 'jass';
    document.head.appendChild(fontEl);

    const { default: initJass } = await import('./jass.js');
    initJass(container);
  },

  unmount() {
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (fontEl) { fontEl.remove(); fontEl = null; }
  }
};
