/* =============================================
   Card Renderer — SVG Playing Cards
   ============================================= */
const CardRenderer = (() => {

  // ── Color Themes ───────────────────────────────
  const THEMES = {
    classic: {
      label: 'Classic',
      hearts:   '#cc0000',
      diamonds: '#cc0000',
      clubs:    '#222222',
      spades:   '#222222',
      back1: '#f5f5f0',  back2: '#e8e4dc',  accent: '#cc0000',
      border: '#999',    glow: '#cc0000',
    },
    grizz: {
      label: 'Grizz',
      hearts:   '#660033',
      diamonds: '#660033',
      clubs:    '#71706E',
      spades:   '#71706E',
      back1: '#660033',  back2: '#7a1a4a',  accent: '#71706E',
      border: '#440022',  glow: '#71706E',
    },
    illini: {
      label: 'Illini',
      hearts:   '#FF5F05',
      diamonds: '#FF5F05',
      clubs:    '#13294B',
      spades:   '#13294B',
      back1: '#13294B',  back2: '#1a3a60',  accent: '#FF5F05',
      border: '#0e2040',  glow: '#FF5F05',
    },
  };

  let currentTheme = localStorage.getItem('solitaire-theme') || 'grizz';
  if (!THEMES[currentTheme]) currentTheme = 'grizz';

  // ── Suit Characters ────────────────────────────
  const SUIT_CHAR = {
    hearts:   '\u2665',   // ♥
    diamonds: '\u2666',   // ♦
    clubs:    '\u2663',   // ♣
    spades:   '\u2660',   // ♠
  };

  function rankLabel(r) {
    if (r === 1)  return 'A';
    if (r === 11) return 'J';
    if (r === 12) return 'Q';
    if (r === 13) return 'K';
    return String(r);
  }

  function col(suit) { return THEMES[currentTheme][suit]; }

  /** SVG stroke attrs for text outline — helps light colors on white */
  function outline(c) {
    return ' paint-order="stroke" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" stroke-linejoin="round"';
  }

  // ── Pip Layouts (absolute coords in 250×350 viewBox) ──
  // Columns — pushed inward to avoid mega-index corners
  const LL = 90, CC = 125, RR = 160;

  // Positions: [x, y] — pips with y > 176 render upside-down
  const PIP_POS = {
    2:  [[CC,110],                                                        [CC,240]],
    3:  [[CC,110],                          [CC,175],                     [CC,240]],
    4:  [[LL,110],[RR,110],                                    [LL,240],[RR,240]],
    5:  [[LL,110],[RR,110],                 [CC,175],          [LL,240],[RR,240]],
    6:  [[LL,110],[RR,110],      [LL,175],[RR,175],            [LL,240],[RR,240]],
    7:  [[LL,110],[RR,110],[CC,142],[LL,175],[RR,175],         [LL,240],[RR,240]],
    8:  [[LL,110],[RR,110],[CC,142],[LL,175],[RR,175],[CC,208],[LL,240],[RR,240]],
    9:  [[LL,100],[CC,100],[RR,100],[LL,155],[CC,155],[RR,155],[LL,210],[CC,210],[RR,210]],
    10: [[LL,100],[CC,100],[RR,100],[LL,148],[RR,148],[LL,202],[RR,202],[LL,250],[CC,250],[RR,250]],
  };

  // ── SVG Building Blocks ────────────────────────

  /** Shared card outline */
  function cardRect() {
    return '<rect x="1" y="1" width="248" height="348" rx="14" ry="14" fill="white" stroke="#bbb" stroke-width="1"/>';
  }

  /** Top-left + bottom-right corner rank & suit labels (mega-index) */
  function corners(suit, rank) {
    const c  = col(suit);
    const ch = SUIT_CHAR[suit];
    const lbl = rankLabel(rank);
    const fs  = lbl.length > 1 ? 36 : 42;      // large rank
    const o = outline(c);
    return `
  <text x="28" y="48" font-size="${fs}" font-weight="700" fill="${c}"${o} text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif">${lbl}</text>
  <text x="28" y="80" font-size="32" fill="${c}"${o} text-anchor="middle">${ch}</text>
  <g transform="rotate(180,125,175)">
    <text x="28" y="48" font-size="${fs}" font-weight="700" fill="${c}"${o} text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif">${lbl}</text>
    <text x="28" y="80" font-size="32" fill="${c}"${o} text-anchor="middle">${ch}</text>
  </g>`;
  }

  /** Wrap inner content in a full-card SVG */
  function svgWrap(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350">'
      + cardRect() + inner + '</svg>';
  }

  // ── Number Cards (2-10) ────────────────────────
  function buildPipCard(suit, rank) {
    const c  = col(suit);
    const ch = SUIT_CHAR[suit];
    const positions = PIP_POS[rank];
    const o = outline(c);

    // Scale pip size by rank — bold for low cards, tighter for crowded ones
    const pipSize = rank <= 3 ? 48 : rank <= 5 ? 42 : rank <= 8 ? 38 : 34;

    let pips = '';
    for (const [x, y] of positions) {
      const flip = y > 176;
      if (flip) {
        pips += '<text x="' + x + '" y="' + y + '" font-size="' + pipSize + '" fill="' + c
          + '"' + o + ' text-anchor="middle" dominant-baseline="central" transform="rotate(180,' + x + ',' + y + ')">' + ch + '</text>';
      } else {
        pips += '<text x="' + x + '" y="' + y + '" font-size="' + pipSize + '" fill="' + c
          + '"' + o + ' text-anchor="middle" dominant-baseline="central">' + ch + '</text>';
      }
    }
    return svgWrap(corners(suit, rank) + pips);
  }

  // ── Ace ────────────────────────────────────────
  function buildAce(suit) {
    const c  = col(suit);
    const ch = SUIT_CHAR[suit];
    const o = outline(c);
    return svgWrap(corners(suit, 1)
      + '<text x="125" y="175" font-size="80" fill="' + c
      + '"' + o + ' text-anchor="middle" dominant-baseline="central">' + ch + '</text>');
  }

  // ── Face Cards (J, Q, K) — PNG art with suit color tint ──

  const ROYAL_PATHS = { 11: 'assets/royals/jack.png', 12: 'assets/royals/queen.png', 13: 'assets/royals/king.png' };
  const royalB64 = {};  // base64 data URLs, populated by init()

  function hexToRGB(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function buildFaceCard(suit, rank) {
    const c  = col(suit);
    const imgData = royalB64[rank];

    // Fall back to simple SVG if images haven't loaded
    if (!imgData) return buildFaceCardFallback(suit, rank);

    // Color matrix: remap black → suit color, white → white
    const rgb = hexToRGB(c);
    const sr = (rgb.r / 255).toFixed(3), sg = (rgb.g / 255).toFixed(3), sb = (rgb.b / 255).toFixed(3);
    const mr = (1 - sr).toFixed(3),      mg = (1 - sg).toFixed(3),      mb = (1 - sb).toFixed(3);

    return svgWrap(
      '<defs><filter id="st" color-interpolation-filters="sRGB">'
      + '<feColorMatrix type="matrix" values="'
      + mr + ' 0 0 0 ' + sr + ' '
      + '0 ' + mg + ' 0 0 ' + sg + ' '
      + '0 0 ' + mb + ' 0 ' + sb + ' '
      + '0 0 0 1 0"/>'
      + '</filter></defs>'
      // Full illustration with suit color tint
      + '<image href="' + imgData + '" x="3" y="3" width="244" height="344" preserveAspectRatio="xMidYMid meet" filter="url(#st)"/>'
      // White corner badges for readability
      + '<rect x="2" y="2" width="52" height="90" rx="10" fill="white" opacity="0.88"/>'
      + '<rect x="196" y="258" width="52" height="90" rx="10" fill="white" opacity="0.88"/>'
      // Corner labels
      + corners(suit, rank));
  }

  function buildFaceCardFallback(suit, rank) {
    const c   = col(suit);
    const ch  = SUIT_CHAR[suit];
    const lbl = rankLabel(rank);
    return svgWrap(corners(suit, rank)
      + '<rect x="48" y="70" width="154" height="210" rx="8" fill="' + c + '" opacity="0.06"/>'
      + '<rect x="48" y="70" width="154" height="210" rx="8" fill="none" stroke="' + c + '" stroke-width="1.5" opacity="0.2"/>'
      + '<text x="125" y="158" font-size="68" font-weight="700" fill="' + c
      + '" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif">' + lbl + '</text>'
      + '<text x="125" y="222" font-size="40" fill="' + c
      + '" text-anchor="middle" dominant-baseline="central">' + ch + '</text>');
  }

  // ── Card Back ──────────────────────────────────
  function buildCardBack() {
    const t = THEMES[currentTheme];
    const b1 = t.back1, b2 = t.back2, ac = t.accent, bd = t.border, gl = t.glow;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350">
  <defs>
    <pattern id="bp" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="24" height="24" fill="${b1}"/>
      <rect x="1" y="1" width="10" height="10" rx="1.5" fill="${b2}" opacity="0.6"/>
      <rect x="13" y="13" width="10" height="10" rx="1.5" fill="${b2}" opacity="0.6"/>
      <rect x="5" y="5" width="2" height="2" rx="1" fill="${ac}" opacity="0.3"/>
      <rect x="17" y="17" width="2" height="2" rx="1" fill="${ac}" opacity="0.3"/>
    </pattern>
    <radialGradient id="glow" cx="50%" cy="50%" r="40%">
      <stop offset="0%" stop-color="${gl}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${gl}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="1" y="1" width="248" height="348" rx="14" ry="14" fill="url(#bp)" stroke="${bd}" stroke-width="2"/>
  <rect x="8" y="8" width="234" height="334" rx="11" ry="11" fill="none" stroke="${ac}" stroke-width="1" opacity="0.35"/>
  <rect x="14" y="14" width="222" height="322" rx="9" ry="9" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  <ellipse cx="125" cy="175" rx="85" ry="105" fill="url(#glow)"/>
  <g transform="translate(125,175)">
    <polygon points="0,-55 38,0 0,55 -38,0" fill="none" stroke="${ac}" stroke-width="1.8" opacity="0.5"/>
    <polygon points="0,-40 28,0 0,40 -28,0" fill="${ac}" opacity="0.12"/>
    <polygon points="0,-25 17,0 0,25 -17,0" fill="none" stroke="${ac}" stroke-width="1" opacity="0.35"/>
    <circle cx="0" cy="-18" r="3" fill="${ac}" opacity="0.5"/>
    <circle cx="0" cy="18" r="3" fill="${ac}" opacity="0.5"/>
    <circle cx="-13" cy="0" r="3" fill="${ac}" opacity="0.5"/>
    <circle cx="13" cy="0" r="3" fill="${ac}" opacity="0.5"/>
    <circle cx="0" cy="0" r="4.5" fill="${ac}" opacity="0.55"/>
  </g>
  <circle cx="30" cy="30" r="5" fill="none" stroke="${ac}" stroke-width="0.8" opacity="0.3"/>
  <circle cx="220" cy="30" r="5" fill="none" stroke="${ac}" stroke-width="0.8" opacity="0.3"/>
  <circle cx="30" cy="320" r="5" fill="none" stroke="${ac}" stroke-width="0.8" opacity="0.3"/>
  <circle cx="220" cy="320" r="5" fill="none" stroke="${ac}" stroke-width="0.8" opacity="0.3"/>
</svg>`;
  }

  // ── Cache ──────────────────────────────────────
  const cache = {};
  let backCache = null;

  function getCardSVG(suit, rank) {
    const key = currentTheme + '_' + suit + '_' + rank;
    if (cache[key]) return cache[key];
    let svg;
    if (rank === 1)                    svg = buildAce(suit);
    else if (rank >= 2 && rank <= 10)  svg = buildPipCard(suit, rank);
    else                               svg = buildFaceCard(suit, rank);
    cache[key] = svg;
    return svg;
  }

  function getBackSVG() {
    if (!backCache) backCache = buildCardBack();
    return backCache;
  }

  function toDataURL(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ── Public API ─────────────────────────────────
  return {
    /** Load royal PNGs and convert to base64 for embedding in SVG */
    init() {
      return Promise.all(Object.entries(ROYAL_PATHS).map(([rank, path]) => {
        return new Promise(resolve => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            royalB64[rank] = c.toDataURL('image/png');
            resolve();
          };
          img.onerror = () => resolve(); // fallback to SVG
          img.src = path;
        });
      }));
    },

    getCardDataURL(suit, rank) { return toDataURL(getCardSVG(suit, rank)); },
    getCardBackDataURL()       { return toDataURL(getBackSVG()); },

    setTheme(name) {
      if (THEMES[name]) {
        currentTheme = name;
        localStorage.setItem('solitaire-theme', name);
        for (const k in cache) delete cache[k];
        backCache = null;
      }
    },
    getTheme()  { return currentTheme; },
    getThemes() { return Object.keys(THEMES).map(k => ({ id: k, label: THEMES[k].label, colors: THEMES[k] })); },
  };
})();
