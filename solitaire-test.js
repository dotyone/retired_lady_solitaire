/* =============================================
   Mom's Solitaire — Klondike Engine + UI
   ============================================= */

// ── Constants ──────────────────────────────────
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function suitColor(suit) {
  return (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
}

function cardImageSrc(card) {
  return CardRenderer.getCardDataURL(card.suit, card.rank);
}

function cardBackSrc() {
  return CardRenderer.getCardBackDataURL();
}

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

function checkWin() { return true; /* TEST */
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
  img.src = isFaceUp ? cardImageSrc(card) : cardBackSrc();
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
    c.dataset.source = 'waste';
    c.dataset.pile = '0';
    c.dataset.cardIndex = String(game.waste.length - 1);
    addDragListeners(c);
    el.appendChild(c);
  }

  el.onclick = handleWasteClick;
}

function renderFoundation(idx) {
  const el = document.querySelector('.foundation[data-pile="' + idx + '"]');
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
    c.dataset.source = 'foundation';
    c.dataset.pile = idx;
    c.dataset.cardIndex = String(pile.length - 1);
    addDragListeners(c);
    el.appendChild(c);
  } else {
    el.classList.remove('has-card');
  }

  el.onclick = () => handleFoundationClick(idx);
}

function renderTableauPile(pileIdx) {
  const container = document.querySelector('.tableau-pile[data-pile="' + pileIdx + '"]');
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
      c.dataset.source = 'tableau';
      c.dataset.pile = pileIdx;
      c.dataset.cardIndex = idx;
      addDragListeners(c);
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
let winAnimationId = null;

function showWin() {
  clearInterval(timerInterval);
  game.timerRunning = false;
  localStorage.removeItem('solitaire_save');
  recordWin(game.moveCount, game.elapsedSeconds);

  // Start the cascading cards animation
  startCascadeAnimation(() => {
    // When animation finishes, show the modal
    document.getElementById('win-stats').textContent =
      'Completed in ' + game.moveCount + ' moves · ' + formatTime(game.elapsedSeconds);
    document.getElementById('win-overlay').classList.remove('hidden');
  });
}

function startCascadeAnimation(onDone) {
  const canvas = document.getElementById('win-canvas');
  canvas.classList.remove('hidden');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  // Preload card images for the cascade
  const cardImgs = [];
  let loaded = 0;
  const allCards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      allCards.push({ suit, rank });
    }
  }

  // Shuffle for variety
  for (let i = allCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
  }

  const total = allCards.length;
  allCards.forEach(card => {
    const img = new Image();
    img.src = cardImageSrc(card);
    img.onload = img.onerror = () => {
      loaded++;
      if (loaded === total) runCascade(ctx, canvas, cardImgs, onDone);
    };
    cardImgs.push(img);
  });
}

function runCascade(ctx, canvas, cardImgs, onDone) {
  const W = canvas.width;
  const H = canvas.height;
  const cw = Math.min(70, W / 8);
  const ch = cw * 1.4;
  const gravity = 0.4;
  const bounce = -0.6;

  // Create bouncing cards launched from top, one at a time
  const cards = [];
  let nextCard = 0;
  let spawnTimer = 0;
  const spawnInterval = 4; // frames between card spawns
  const maxCards = Math.min(cardImgs.length, 26); // half deck for performance
  let doneFrames = 0;

  function frame() {
    // Semi-transparent fill to create trailing effect
    ctx.fillStyle = 'rgba(13, 115, 38, 0.15)';
    ctx.fillRect(0, 0, W, H);

    // Spawn new cards
    spawnTimer++;
    if (nextCard < maxCards && spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      const startX = (nextCard / maxCards) * (W - cw);
      cards.push({
        img: cardImgs[nextCard],
        x: startX,
        y: -ch,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 2 + 1,
        rotation: (Math.random() - 0.5) * 0.3,
        active: true,
      });
      nextCard++;
    }

    // Update & draw cards
    let allDone = true;
    for (const c of cards) {
      if (!c.active) continue;

      c.vy += gravity;
      c.x += c.vx;
      c.y += c.vy;

      // Bounce off bottom
      if (c.y + ch > H) {
        c.y = H - ch;
        c.vy *= bounce;
        if (Math.abs(c.vy) < 1) {
          c.vy = 0;
          c.active = false;
          continue;
        }
      }

      // Bounce off sides
      if (c.x < 0) { c.x = 0; c.vx = Math.abs(c.vx); }
      if (c.x + cw > W) { c.x = W - cw; c.vx = -Math.abs(c.vx); }

      allDone = false;

      // Draw with slight rotation
      ctx.save();
      ctx.translate(c.x + cw / 2, c.y + ch / 2);
      ctx.rotate(c.rotation);
      ctx.drawImage(c.img, -cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    }

    if (nextCard >= maxCards && allDone) {
      doneFrames++;
    }

    if (doneFrames > 60) {
      // Hold final frame briefly then callback
      cancelAnimationFrame(winAnimationId);
      winAnimationId = null;
      if (onDone) onDone();
      return;
    }

    winAnimationId = requestAnimationFrame(frame);
  }

  winAnimationId = requestAnimationFrame(frame);
}

function stopCascadeAnimation() {
  if (winAnimationId) {
    cancelAnimationFrame(winAnimationId);
    winAnimationId = null;
  }
  const canvas = document.getElementById('win-canvas');
  canvas.classList.add('hidden');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ── Hint System ────────────────────────────────
function findHint() {
  // Priority 1: Tableau/Waste → Foundation
  for (let i = 0; i < 7; i++) {
    const pile = game.tableau[i];
    if (pile.length === 0) continue;
    const card = pile[pile.length - 1];
    if (!card.faceUp) continue;
    for (let f = 0; f < 4; f++) {
      if (canPlaceOnFoundation(card, f)) {
        return { from: { source: 'tableau', pile: i, cardIndex: pile.length - 1 }, to: { type: 'foundation', pile: f } };
      }
    }
  }
  if (game.waste.length > 0) {
    const card = game.waste[game.waste.length - 1];
    for (let f = 0; f < 4; f++) {
      if (canPlaceOnFoundation(card, f)) {
        return { from: { source: 'waste' }, to: { type: 'foundation', pile: f } };
      }
    }
  }

  // Priority 2: Tableau → Tableau (move face-up stacks)
  for (let i = 0; i < 7; i++) {
    const pile = game.tableau[i];
    if (pile.length === 0) continue;
    // Find the topmost face-up card in this pile
    let firstFaceUp = 0;
    while (firstFaceUp < pile.length && !pile[firstFaceUp].faceUp) firstFaceUp++;
    if (firstFaceUp >= pile.length) continue;

    for (let j = 0; j < 7; j++) {
      if (i === j) continue;
      if (canPlaceOnTableau(pile[firstFaceUp], j)) {
        // Skip if just moving a King to an empty pile with nothing to gain
        if (pile[firstFaceUp].rank === 13 && firstFaceUp === 0 && game.tableau[j].length === 0) continue;
        return { from: { source: 'tableau', pile: i, cardIndex: firstFaceUp }, to: { type: 'tableau', pile: j } };
      }
    }
  }

  // Priority 3: Waste → Tableau
  if (game.waste.length > 0) {
    const card = game.waste[game.waste.length - 1];
    for (let j = 0; j < 7; j++) {
      if (canPlaceOnTableau(card, j)) {
        return { from: { source: 'waste' }, to: { type: 'tableau', pile: j } };
      }
    }
  }

  // Priority 4: Foundation → Tableau (sometimes needed to unblock)
  for (let f = 0; f < 4; f++) {
    const pile = game.foundations[f];
    if (pile.length === 0) continue;
    const card = pile[pile.length - 1];
    for (let j = 0; j < 7; j++) {
      if (canPlaceOnTableau(card, j)) {
        return { from: { source: 'foundation', pile: f }, to: { type: 'tableau', pile: j } };
      }
    }
  }

  // Priority 5: Draw from stock
  if (game.stock.length > 0) {
    return { from: { source: 'stock' }, to: null };
  }

  return null; // no moves available
}

function showHint() {
  // Clear any existing hints
  clearHints();

  const hint = findHint();
  if (!hint) {
    // Flash the hint button to indicate no moves
    const btn = document.getElementById('hint-btn');
    btn.style.background = 'rgba(255,80,80,0.5)';
    setTimeout(() => { btn.style.background = ''; }, 800);
    return;
  }

  // Highlight source
  const sourceEl = getHintElement(hint.from);
  if (sourceEl) sourceEl.classList.add('hint-source');

  // Highlight target
  if (hint.to) {
    const targetEl = getHintTargetElement(hint.to);
    if (targetEl) targetEl.classList.add('hint-target');
  }

  // Auto-clear after animation
  setTimeout(clearHints, 2000);
}

function getHintElement(from) {
  if (from.source === 'waste') {
    return document.querySelector('#waste .card');
  }
  if (from.source === 'stock') {
    return document.getElementById('stock');
  }
  if (from.source === 'foundation') {
    const el = document.querySelector('.foundation[data-pile="' + from.pile + '"]');
    return el ? el.querySelector('.card') : null;
  }
  if (from.source === 'tableau') {
    const container = document.querySelector('.tableau-pile[data-pile="' + from.pile + '"]');
    if (!container) return null;
    const cards = container.querySelectorAll('.card');
    return cards[from.cardIndex] || null;
  }
  return null;
}

function getHintTargetElement(to) {
  if (to.type === 'foundation') {
    const el = document.querySelector('.foundation[data-pile="' + to.pile + '"]');
    if (!el) return null;
    return el.querySelector('.card') || el;
  }
  if (to.type === 'tableau') {
    const container = document.querySelector('.tableau-pile[data-pile="' + to.pile + '"]');
    if (!container) return null;
    const cards = container.querySelectorAll('.card');
    if (cards.length > 0) return cards[cards.length - 1];
    return container.querySelector('.card-slot') || container;
  }
  return null;
}

function clearHints() {
  document.querySelectorAll('.hint-source').forEach(el => el.classList.remove('hint-source'));
  document.querySelectorAll('.hint-target').forEach(el => el.classList.remove('hint-target'));
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
  // SVG cards are generated on-the-fly — no preloading needed
}

// ── Service Worker registration ────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ── Drag and Drop ──────────────────────────────
const DRAG_THRESHOLD = 8; // px before a tap becomes a drag

let drag = null; // { ghost, source, pile, cardIndex, startX, startY, isDragging }

function addDragListeners(el) {
  el.addEventListener('mousedown', onPointerDown, { passive: false });
  el.addEventListener('touchstart', onPointerDown, { passive: false });
}

function getXY(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function onPointerDown(e) {
  const cardEl = e.currentTarget;
  if (!cardEl.dataset.source) return;

  const { x, y } = getXY(e);

  drag = {
    ghost: null,
    source: cardEl.dataset.source,
    pile: parseInt(cardEl.dataset.pile),
    cardIndex: parseInt(cardEl.dataset.cardIndex),
    startX: x,
    startY: y,
    isDragging: false,
    originEl: cardEl,
  };

  document.addEventListener('mousemove', onPointerMove, { passive: false });
  document.addEventListener('mouseup', onPointerUp);
  document.addEventListener('touchmove', onPointerMove, { passive: false });
  document.addEventListener('touchend', onPointerUp);
  document.addEventListener('touchcancel', onPointerUp);
}

function onPointerMove(e) {
  if (!drag) return;
  const { x, y } = getXY(e);

  if (!drag.isDragging) {
    const dx = x - drag.startX;
    const dy = y - drag.startY;
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    drag.isDragging = true;
    selection = null; // clear tap selection when dragging starts
    startDragGhost(drag, x, y);
  }

  e.preventDefault();
  moveDragGhost(x, y);
}

function onPointerUp(e) {
  document.removeEventListener('mousemove', onPointerMove);
  document.removeEventListener('mouseup', onPointerUp);
  document.removeEventListener('touchmove', onPointerMove);
  document.removeEventListener('touchend', onPointerUp);
  document.removeEventListener('touchcancel', onPointerUp);

  if (!drag) return;

  if (drag && drag.isDragging) {
    const { x, y } = e.changedTouches ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : { x: e.clientX, y: e.clientY };
    dropCards(x, y);
    removeDragGhost();
    // Suppress the click that follows mouseup
    drag.originEl.addEventListener('click', suppressClick, { capture: true, once: true });
  }
  // If not dragging, the click handler will fire naturally

  drag = null;
}

function suppressClick(e) {
  e.stopImmediatePropagation();
  e.preventDefault();
}

function startDragGhost(d, x, y) {
  const ghost = document.createElement('div');
  ghost.id = 'drag-ghost';
  ghost.style.position = 'fixed';
  ghost.style.zIndex = '500';
  ghost.style.pointerEvents = 'none';
  ghost.style.opacity = '0.92';
  ghost.style.transform = 'rotate(2deg) scale(1.05)';

  // Build ghost cards
  const cards = getDragCards(d);
  const offsets = computeFanOffsets();
  let top = 0;

  cards.forEach((card, i) => {
    const c = makeCardEl(card, true);
    c.style.position = 'absolute';
    c.style.top = top + 'px';
    c.style.left = '0';
    ghost.appendChild(c);
    if (i < cards.length - 1) top += offsets.faceUp;
  });

  ghost.style.width = cardW + 'px';
  ghost.style.height = (top + cardH) + 'px';

  // Position centered on pointer
  ghost.style.left = (x - cardW / 2) + 'px';
  ghost.style.top = (y - 20) + 'px';

  document.body.appendChild(ghost);
  drag.ghost = ghost;
  drag.offsetX = cardW / 2;
  drag.offsetY = 20;

  // Hide original cards
  hideSourceCards(d);
}

function moveDragGhost(x, y) {
  if (!drag || !drag.ghost) return;
  drag.ghost.style.left = (x - drag.offsetX) + 'px';
  drag.ghost.style.top = (y - drag.offsetY) + 'px';
}

function removeDragGhost() {
  if (drag && drag.ghost) {
    drag.ghost.remove();
    drag.ghost = null;
  }
}

function getDragCards(d) {
  if (d.source === 'waste') return [game.waste[game.waste.length - 1]];
  if (d.source === 'foundation') return [game.foundations[d.pile][game.foundations[d.pile].length - 1]];
  if (d.source === 'tableau') return game.tableau[d.pile].slice(d.cardIndex);
  return [];
}

function hideSourceCards(d) {
  if (d.source === 'tableau') {
    const container = document.querySelector('.tableau-pile[data-pile="' + d.pile + '"]');
    const cardEls = container.querySelectorAll('.card');
    for (let i = d.cardIndex; i < cardEls.length; i++) {
      cardEls[i].style.visibility = 'hidden';
    }
  } else if (d.source === 'waste') {
    const wasteEl = document.getElementById('waste');
    const c = wasteEl.querySelector('.card');
    if (c) c.style.visibility = 'hidden';
  } else if (d.source === 'foundation') {
    const foundEl = document.querySelector('.foundation[data-pile="' + d.pile + '"]');
    if (foundEl) { const c = foundEl.querySelector('.card'); if (c) c.style.visibility = 'hidden'; }
  }
}

function dropCards(x, y) {
  if (!drag) return;
  startTimer();

  const target = findDropTarget(x, y);
  let moved = false;

  if (target) {
    const from = {
      source: drag.source,
      pile: drag.pile,
      cardIndex: drag.cardIndex,
    };

    if (target.type === 'tableau') {
      if (from.source === 'waste') moved = moveWasteToTableau(target.pile);
      else if (from.source === 'tableau') moved = moveTableauToTableau(from.pile, from.cardIndex, target.pile);
      else if (from.source === 'foundation') moved = moveFoundationToTableau(from.pile, target.pile);
    } else if (target.type === 'foundation') {
      if (from.source === 'waste') moved = moveWasteToFoundation(target.pile);
      else if (from.source === 'tableau') moved = moveTableauToFoundation(from.pile, target.pile);
    }
  }

  if (moved && checkWin()) {
    saveGame();
    render();
    showWin();
    return;
  }

  saveGame();
  render();
}

function findDropTarget(x, y) {
  // Check foundations
  const foundEls = document.querySelectorAll('.foundation');
  for (let i = 0; i < foundEls.length; i++) {
    const rect = foundEls[i].getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { type: 'foundation', pile: i };
    }
  }

  // Check tableau piles (use the full column width, generous height)
  const pileEls = document.querySelectorAll('.tableau-pile');
  for (let i = 0; i < pileEls.length; i++) {
    const rect = pileEls[i].getBoundingClientRect();
    // Extend the hit area down to the bottom of the screen for empty/short piles
    const bottom = Math.max(rect.bottom, rect.top + cardH);
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= bottom) {
      return { type: 'tableau', pile: i };
    }
  }

  return null;
}

// ── Resize handling ────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 100);
});

// ── Stats System ───────────────────────────────
const STATS_KEY = 'solitaire_stats';

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { totalGames: 0, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, fastestWins: [] };
}

function saveStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {}
}

function recordWin(moves, seconds) {
  const stats = loadStats();
  stats.totalGames++;
  stats.wins++;
  stats.currentStreak++;
  if (stats.currentStreak > stats.bestStreak) stats.bestStreak = stats.currentStreak;
  // Track top 5 fastest wins
  stats.fastestWins.push({ moves, seconds, date: new Date().toLocaleDateString() });
  stats.fastestWins.sort((a, b) => a.seconds - b.seconds);
  stats.fastestWins = stats.fastestWins.slice(0, 5);
  saveStats(stats);
}

function recordLoss() {
  const stats = loadStats();
  stats.totalGames++;
  stats.losses++;
  stats.currentStreak = 0;
  saveStats(stats);
}

function renderStatsPanel() {
  const stats = loadStats();
  const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
  const body = document.getElementById('stats-body');

  let html = '<div class="stat-row"><span class="stat-label">Games Played</span><span class="stat-value">' + stats.totalGames + '</span></div>';
  html += '<div class="stat-row"><span class="stat-label">Wins</span><span class="stat-value">' + stats.wins + '</span></div>';
  html += '<div class="stat-row"><span class="stat-label">Win Rate</span><span class="stat-value">' + winRate + '%</span></div>';
  html += '<div class="stat-row"><span class="stat-label">Current Streak</span><span class="stat-value">' + stats.currentStreak + '</span></div>';
  html += '<div class="stat-row"><span class="stat-label">Best Streak</span><span class="stat-value">' + stats.bestStreak + '</span></div>';

  if (stats.fastestWins.length > 0) {
    html += '<div class="fastest-title">Fastest Wins</div>';
    stats.fastestWins.forEach(w => {
      html += '<div class="fastest-entry"><span>' + formatTime(w.seconds) + ' \u00b7 ' + w.moves + ' moves</span><span>' + w.date + '</span></div>';
    });
  }

  body.innerHTML = html;
}

function showStats() {
  renderStatsPanel();
  document.getElementById('stats-overlay').classList.remove('hidden');
}

function hideStats() {
  document.getElementById('stats-overlay').classList.add('hidden');
}

function resetStats() {
  if (confirm('Reset all statistics?')) {
    localStorage.removeItem(STATS_KEY);
    renderStatsPanel();
  }
}

// ── Settings / Theme Picker ──────────────────────
function renderThemePicker() {
  const picker = document.getElementById('theme-picker');
  const themes = CardRenderer.getThemes();
  const current = CardRenderer.getTheme();
  picker.innerHTML = themes.map(t => {
    const sel = t.id === current ? ' selected' : '';
    const c1 = t.colors.hearts;
    const c2 = t.colors.clubs;
    return `<div class="theme-option${sel}" data-theme="${t.id}">
      <div class="theme-label">${t.label}</div>
      <div class="theme-swatches">
        <div class="theme-swatch" style="background:${c1}"></div>
        <div class="theme-swatch" style="background:${c2}"></div>
      </div>
    </div>`;
  }).join('');

  picker.querySelectorAll('.theme-option').forEach(el => {
    el.onclick = () => {
      CardRenderer.setTheme(el.dataset.theme);
      renderThemePicker();
      render();
    };
  });
}

function showSettings() {
  renderThemePicker();
  document.getElementById('settings-overlay').classList.remove('hidden');
}

function hideSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
}

// ── Boot ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  registerSW();

  document.getElementById('new-game-btn').onclick = () => {
    // If game is in progress (cards dealt, not won), record a loss
    const inProgress = game.tableau.some(p => p.length > 0) || game.waste.length > 0 || game.stock.length > 0;
    const alreadyWon = checkWin();
    if (inProgress && !alreadyWon && game.moveCount > 0) {
      if (!confirm('Abandon this game and start fresh?')) return;
      recordLoss();
    }
    newGame();
  };
  document.getElementById('hint-btn').onclick = showHint;
  document.getElementById('stats-btn').onclick = showStats;
  document.getElementById('stats-close').onclick = hideStats;
  document.getElementById('stats-reset').onclick = resetStats;
  document.getElementById('settings-btn').onclick = showSettings;
  document.getElementById('settings-close').onclick = hideSettings;
  document.getElementById('win-new-game').onclick = () => {
    stopCascadeAnimation();
    document.getElementById('win-overlay').classList.add('hidden');
    newGame();
  };

  // Load royal card images, then start the game
  CardRenderer.init().then(() => {
    if (!loadGame()) {
      newGame();
    } else {
      render();
    }
  });
});

