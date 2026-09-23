import styles from './jass.css?inline';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Inter:wght@400;500;600;700&display=swap';

let styleEl = null;
let fontEl = null;

export default {
  id: 'jass',
  name: 'Jass',
  icon: '🃏',
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
