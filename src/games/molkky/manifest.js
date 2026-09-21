import styles from './molkky.css?inline';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap';

let styleEl = null;
let fontEl = null;

export default {
  id: 'molkky',
  name: 'Mölkky',
  icon: '🎳',
  description: "Comptage de points pour le jeu de quilles finlandais.",
  themeColor: '#5B7553',

  async mount(container) {
    styleEl = document.createElement('style');
    styleEl.dataset.game = 'molkky';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    fontEl = document.createElement('link');
    fontEl.rel = 'stylesheet';
    fontEl.href = FONT_HREF;
    fontEl.dataset.game = 'molkky';
    document.head.appendChild(fontEl);

    const { default: initMolkky } = await import('./molkky.js');
    initMolkky(container);
  },

  unmount() {
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (fontEl) { fontEl.remove(); fontEl = null; }
  }
};
