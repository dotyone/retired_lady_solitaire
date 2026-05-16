/* =============================================
   Mom's Solitaire — Klondike Engine + UI
   ============================================= */

// ── Constants ──────────────────────────────────
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const IMG_DIR = 'assets/PNG/Cards (large)/';

function suitColor(suit) {
  return (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
}

function rankAssetSuffix(rank) {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank).padStart(2, '0');
}

function cardImageSrc(card) {
  return IMG_DIR + 'card_' + card.suit + '_' + rankAssetSuffix(card.rank) + '.png';
}

const CARD_BACK_SRC = IMG_DIR + 'card_back.png';

// ── Deck creation & shuffle ────────────────────
let nextId = 0;

function createCard(suit, rank) {
  return { id: nextId++, suit, rank, faceUp: false };
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(suit, rank));
    }
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Game state ─────────────────────────────────
const game = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  moveCount: 0,
  elapsedSeconds: 0,
  timerRunning: false,
};

let selection = null;   // { source, pile, cardIndex }
let timerInterval = null;

// ── Deal / New Game ────────────────────────────
function newGame() {
  const deck = shuffle(createDeck());

  game.tableau = [];
  for (let col = 0; col < 7; col++) {
    const pile = [];
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      card.faceUp = (row === col);
      pile.push(card);
    }
    game.tableau.push(pile);
  }

  game.stock = deck; // remaining 24
  game.waste = [];
  game.foundations = [[], [], [], []];
  game.moveCount = 0;
  game.elapsedSeconds = 0;
  game.timerRunning = false;
  selection = null;

  clearInterval(timerInterval);
  timerInterval = null;

  saveGame();
  render();
}

// ── Timer ──────────────────────────────────────
function startTimer() {
  if (game.timerRunning) return;
  game.timerRunning = true;
  timerInterval = setInterval(() => {
    game.elapsedSeconds++;
    document.getElementById('timer').textContent = formatTime(game.elapsedSeconds);
  }, 1000);
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// ── Validation ─────────────────────────────────
function canPlaceOnTableau(card, pileIdx) {
  const pile = game.tableau[pileIdx];
  if (pile.length === 0) return card.rank === 13; // only King
  const top = pile[pile.length - 1];
  return top.faceUp
    && suitColor(top.suit) !== suitColor(card.suit)
    && top.rank === card.rank + 1;
}

function canPlaceOnFoundation(card, pileIdx) {
  const pile = game.foundations[pileIdx];
  if (pile.length === 0) return card.rank === 1; // only Ace
  const top = pile[pile.length - 1];
  return top.suit === card.suit && card.rank === top.rank + 1;
}

// ── Moves ──────────────────────────────────────
function drawFromStock() {
  startTimer();
  if (game.stock.length === 0) {
    // recycle waste → stock
    game.stock = game.waste.reverse().map(c => ({ ...c, faceUp: false }));
    game.waste = [];
  } else {
    const card = game.stock.pop();
    card.faceUp = true;
    game.waste.push(card);
  }
  selection = null;
  saveGame();
  render();
}

function moveWasteToTableau(pileIdx) {
  if (game.waste.length === 0) return false;
  const card = game.waste[game.waste.length - 1];
  if (!canPlaceOnTableau(card, pileIdx)) return false;
  game.waste.pop();
  game.tableau[pileIdx].push(card);
  game.moveCount++;
  return true;
}

function moveWasteToFoundation(pileIdx) {
  if (game.waste.length === 0) return false;
  const card = game.waste[game.waste.length - 1];
  if (!canPlaceOnFoundation(card, pileIdx)) return false;
  game.waste.pop();
  game.foundations[pileIdx].push(card);
  game.moveCount++;
  return true;
}

function moveTableauToTableau(fromPile, cardIndex, toPile) {
  if (fromPile === toPile) return false;
  const srcPile = game.tableau[fromPile];
  if (cardIndex < 0 || cardIndex >= srcPile.length) return false;
  if (!srcPile[cardIndex].faceUp) return false;
  if (!canPlaceOnTableau(srcPile[cardIndex], toPile)) return false;

  const cards = srcPile.splice(cardIndex);
  game.tableau[toPile].push(...cards);
  flipTopCard(fromPile);
  game.moveCount++;
  return true;
}

function moveTableauToFoundation(fromPile, foundPile) {
  const srcPile = game.tableau[fromPile];
  if (srcPile.length === 0) return false;
  const card = srcPile[srcPile.length - 1];
  if (!canPlaceOnFoundation(card, foundPile)) return false;
  srcPile.pop();
  game.foundations[foundPile].push(card);
  flipTopCard(fromPile);
  game.moveCount++;
  return true;
}

function moveFoundationToTableau(foundPile, toPile) {
  const srcPile = game.foundations[foundPile];
  if (srcPile.length === 0) return false;
  const card = srcPile[srcPile.length - 1];
  if (!canPlaceOnTableau(card, toPile)) return false;
  srcPile.pop();
  game.tableau[toPile].push(card);
  game.moveCount++;
  return true;
}

function flipTopCard(pileIdx) {
  const pile = game.tableau[pileIdx];
  if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
    pile[pile.length - 1].faceUp = true;
  }
}

function autoMoveToFoundation(source, pile, cardIndex) {
  let card;
  if (source === 'waste') {
    if (game.waste.length === 0) return false;
    card = game.waste[game.waste.length - 1];
  } else if (source === 'tableau') {
    const p = game.tableau[pile];
    if (cardIndex !== p.length - 1) return false; // only top card
    card = p[p.length - 1];
  } else {
    return false;
  }

  for (let i = 0; i < 4; i++) {
    if (canPlaceOnFoundation(card, i)) {
      if (source === 'waste') return moveWasteToFoundation(i);
      if (source === 'tableau') return moveTableauToFoundation(pile, i);
    }
  }
  return false;
}

function checkWin() {
  return game.foundations.every(p => p.length === 13);
}

// ── Selection & click dispatch ─────────────────
function handleStockClick() {
  drawFromStock();
}

function handleWasteClick() {
  startTimer();
  if (game.waste.length === 0) return;

  if (selection && selection.source === 'waste') {
    // same card tapped again → try auto-foundation
    autoMoveToFoundation('waste', 0, 0);
    selection = null;
  } else {
    selection = { source: 'waste', pile: 0, cardIndex: game.waste.length - 1 };
  }
  saveGame();
  render();
}

function handleFoundationClick(pileIdx) {
  startTimer();

  if (selection) {
    let moved = false;
    if (selection.source === 'waste') {
      moved = moveWasteToFoundation(pileIdx);
    } else if (selection.source === 'tableau') {
      moved = moveTableauToFoundation(selection.pile, pileIdx);
    } else if (selection.source === 'foundation' && selection.pile === pileIdx) {
      selection = null;
      render();
      return;
    }

    if (moved && checkWin()) {
      selection = null;
      saveGame();
      render();
      showWin();
      return;
    }

    if (!moved && game.foundations[pileIdx].length > 0) {
      selection = { source: 'foundation', pile: pileIdx, cardIndex: game.foundations[pileIdx].length - 1 };
    } else {
      selection = null;
    }
  } else {
    if (game.foundations[pileIdx].length > 0) {
      selection = { source: 'foundation', pile: pileIdx, cardIndex: game.foundations[pileIdx].length - 1 };
    }
  }
  saveGame();
  render();
}

function handleTableauClick(pileIdx, cardIndex) {
  startTimer();
  const pile = game.tableau[pileIdx];

  // Tapped a face-down card — ignore
  if (cardIndex < pile.length && !pile[cardIndex].faceUp) return;

  if (selection) {
    // Tapped the same card/stack → auto-foundation or deselect
    if (selection.source === 'tableau' && selection.pile === pileIdx && selection.cardIndex === cardIndex) {
      if (cardIndex === pile.length - 1) {
        autoMoveToFoundation('tableau', pileIdx, cardIndex);
        if (checkWin()) { selection = null; saveGame(); render(); showWin(); return; }
      }
      selection = null;
      saveGame();
      render();
      return;
    }

    // Try to move selection here
    let moved = false;
    if (selection.source === 'waste') {
      moved = moveWasteToTableau(pileIdx);
    } else if (selection.source === 'tableau') {
      moved = moveTableauToTableau(selection.pile, selection.cardIndex, pileIdx);
    } else if (selection.source === 'foundation') {
      moved = moveFoundationToTableau(selection.pile, pileIdx);
    }

    if (moved) {
      selection = null;
    } else if (cardIndex < pile.length && pile[cardIndex].faceUp) {
      selection = { source: 'tableau', pile: pileIdx, cardIndex };
    } else {
      selection = null;
    }
  } else {
    // Nothing selected → select this card
    if (pile.length === 0) return; // empty pile, nothing to select
    if (cardIndex < pile.length && pile[cardIndex].faceUp) {
      selection = { source: 'tableau', pile: pileIdx, cardIndex };
    }
  }
  saveGame();
  render();
}

// ── Rendering ──────────────────────────────────
let cardW = 50;
let cardH = 70;

function computeSizes() {
  const gameEl = document.getElementById('game');
  const w = gameEl.clientWidth;
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-gap')) || 3;
  cardW = Math.floor((w - 8 - gap * 6) / 7);   // 8 = side padding
  cardH = Math.floor(cardW * 1.4);
}

function render() {
  computeSizes();
  renderToolbar();
  renderStock();
  renderWaste();
  for (let i = 0; i < 4; i++) renderFoundation(i);
  for (let i = 0; i < 7; i++) renderTableauPile(i);
  sizeSlots();
}

function sizeSlots() {
  document.querySelectorAll('.card-slot').forEach(el => {
    el.style.width = cardW + 'px';
    el.style.height = cardH + 'px';
  });
}

function renderToolbar() {
  document.getElementById('move-counter').textContent = 'Moves: ' + game.moveCount;
  document.getElementById('timer').textContent = formatTime(game.elapsedSeconds);
}

function makeCardEl(card, isFaceUp) {
  const div = document.createElement('div');
  div.className = 'card' + (isFaceUp ? '' : ' face-down');
  div.style.width = cardW + 'px';
  div.style.height = cardH + 'px';

  const img = document.createElement('img');
  img.src = isFaceUp ? cardImageSrc(card) : CARD_BACK_SRC;
  img.alt = '';
  img.draggable = false;
  div.appendChild(img);
  return div;
}

function renderStock() {
  const el = document.getElementById('stock');
  el.innerHTML = '';
  el.className = 'card-slot' + (game.stock.length === 0 ? ' empty-stock' : '');

  if (game.stock.length > 0) {
    const c = makeCardEl(game.stock[game.stock.length - 1], false);
    el.appendChild(c);
  }

  el.onclick = handleStockClick;
}

function renderWaste() {
  const el = document.getElementById('waste');
  el.innerHTML = '';
  el.className = 'card-slot';

  if (game.waste.length > 0) {
    const top = game.waste[game.waste.length - 1];
    const c = makeCardEl(top, true);
    if (selection && selection.source === 'waste') c.classList.add('selected');
    el.appendChild(c);
  }

  el.onclick = handleWasteClick;
}

function renderFoundation(idx) {
  const el = document.querySelectorAll('.foundation')[idx];
  // remove old card elements but keep the pseudo-element
  el.querySelectorAll('.card').forEach(c => c.remove());

  const pile = game.foundations[idx];
  if (pile.length > 0) {
    el.classList.add('has-card');
    const top = pile[pile.length - 1];
    const c = makeCardEl(top, true);
    if (selection && selection.source === 'foundation' && selection.pile === idx) {
      c.classList.add('selected');
    }
    el.appendChild(c);
  } else {
    el.classList.remove('has-card');
  }

  el.onclick = () => handleFoundationClick(idx);
}

function renderTableauPile(pileIdx) {
  const container = document.querySelectorAll('.tableau-pile')[pileIdx];
  container.innerHTML = '';

  const pile = game.tableau[pileIdx];

  if (pile.length === 0) {
    // empty placeholder — clickable
    container.style.height = cardH + 'px';
    const placeholder = document.createElement('div');
    placeholder.className = 'card-slot';
    placeholder.style.width = cardW + 'px';
    placeholder.style.height = cardH + 'px';
    placeholder.style.position = 'absolute';
    placeholder.style.top = '0';
    placeholder.onclick = () => handleTableauClick(pileIdx, 0);
    container.appendChild(placeholder);
    return;
  }

  // Compute fan offsets
  const offsets = computeFanOffsets(pileIdx);
  let topOffset = 0;

  pile.forEach((card, idx) => {
    const c = makeCardEl(card, card.faceUp);
    c.style.position = 'absolute';
    c.style.top = topOffset + 'px';
    c.style.left = '0';
    c.style.zIndex = idx;

    // Highlight selected cards (from cardIndex onward in the selected pile)
    if (selection && selection.source === 'tableau' &&
        selection.pile === pileIdx && idx >= selection.cardIndex) {
      c.classList.add('selected');
    }

    // Click handler for face-up cards
    if (card.faceUp) {
      c.onclick = (e) => { e.stopPropagation(); handleTableauClick(pileIdx, idx); };
    }

    container.appendChild(c);

    if (idx < pile.length - 1) {
      topOffset += card.faceUp ? offsets.faceUp : offsets.faceDown;
    }
  });

  container.style.height = (topOffset + cardH) + 'px';
}

function computeFanOffsets() {
  const idealDown = Math.round(cardH * 0.18);
  const idealUp = Math.round(cardH * 0.28);

  // Available height for tableau
  const gameH = document.getElementById('game').clientHeight;
  const topSection = document.getElementById('top-row').offsetHeight;
  const toolbarH = document.getElementById('toolbar').offsetHeight;
  const available = gameH - topSection - toolbarH - 20; // padding

  // Find tallest pile with ideal offsets
  let worst = cardH;
  for (const pile of game.tableau) {
    if (pile.length === 0) continue;
    let h = cardH;
    for (let i = 0; i < pile.length - 1; i++) {
      h += pile[i].faceUp ? idealUp : idealDown;
    }
    worst = Math.max(worst, h);
  }

  if (worst <= available) return { faceDown: idealDown, faceUp: idealUp };

  const scale = Math.max(0.35, available / worst);
  return {
    faceDown: Math.max(4, Math.round(idealDown * scale)),
    faceUp: Math.max(8, Math.round(idealUp * scale)),
  };
}

// ── Win screen ─────────────────────────────────
function showWin() {
  clearInterval(timerInterval);
  game.timerRunning = false;
  document.getElementById('win-stats').textContent =
    'Completed in ' + game.moveCount + ' moves · ' + formatTime(game.elapsedSeconds);
  document.getElementById('win-overlay').classList.remove('hidden');
  localStorage.removeItem('solitaire_save');
}

// ── Save / Load ────────────────────────────────
function saveGame() {
  const state = {
    stock: game.stock,
    waste: game.waste,
    foundations: game.foundations,
    tableau: game.tableau,
    moveCount: game.moveCount,
    elapsedSeconds: game.elapsedSeconds,
  };
  try {
    localStorage.setItem('solitaire_save', JSON.stringify(state));
  } catch (_) { /* quota exceeded — ignore */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('solitaire_save');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s.tableau || s.tableau.length !== 7) return false;
    game.stock = s.stock;
    game.waste = s.waste;
    game.foundations = s.foundations;
    game.tableau = s.tableau;
    game.moveCount = s.moveCount || 0;
    game.elapsedSeconds = s.elapsedSeconds || 0;
    game.timerRunning = false;
    selection = null;
    return true;
  } catch (_) {
    return false;
  }
}

// ── Image preloading ───────────────────────────
function preloadImages() {
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      new Image().src = cardImageSrc({ suit, rank });
    }
  }
  new Image().src = CARD_BACK_SRC;
}

// ── Service Worker registration ────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ── Resize handling ────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 100);
});

// ── Boot ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  preloadImages();
  registerSW();

  document.getElementById('new-game-btn').onclick = () => {
    if (confirm('Start a new game?')) newGame();
  };
  document.getElementById('win-new-game').onclick = () => {
    document.getElementById('win-overlay').classList.add('hidden');
    newGame();
  };

  if (!loadGame()) {
    newGame();
  } else {
    render();
  }
});
