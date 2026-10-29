// =========================================================================
// ROLLAWORD - INDEPENDENT COMMON CORE CONTROLLER
// =========================================================================
let isDailyChallengeMode = false; // Tracks active game mode context

const GRID_ROWS = 6;
const GRID_COLS = 8;
const INITIAL_TIME_SECONDS = 180;

const isKidsMode = window.location.pathname.includes('id');

const gameTitleElement = document.getElementById("game-title");
// =========================================================================
// PHASE 1 & 2: INSTANT GRID INITIALIZATION
// =========================================================================
const gameBoard = document.getElementById("game-board");
const diceTray = document.getElementById("dice-tray");

if (!gameBoard || !diceTray) {
  throw new Error("RollaWord requires #game-board and #dice-tray containers.");
}

// Build the standard 6x8 playing matrix layout
for (let r = 0; r < GRID_ROWS; r++) {
  for (let c = 0; c < GRID_COLS; c++) {
    const cell = document.createElement("div");
    cell.classList.add("grid-cell");
    cell.dataset.row = r;
    cell.dataset.col = c;
    attachLayoutDragListeners(cell);
    gameBoard.appendChild(cell);
  }
}

// Build the 1x8 tray container lane layout
for (let c = 0; c < GRID_COLS; c++) {
  const cell = document.createElement("div");
  cell.classList.add("grid-cell", "tray-cell");
  
  // 🧠 THE ANTI-NAN FIX: Change "tray" to "-1"
  cell.dataset.row = "-1"; 
  cell.dataset.col = c;
  
  attachLayoutDragListeners(cell);
  diceTray.appendChild(cell);
}

// Dragging is now handled by pointer events (see POINTER-BASED DRAG AND DROP below).
// Kept as an empty function only so any other script that still calls it keeps working.
function attachLayoutDragListeners(cell) {}



// =========================================================================
// POINTER-BASED DRAG AND DROP  (mouse, touch and pen all behave the same)
// - A tile follows the pointer immediately (no long-press needed on phones).
// - On touch screens the tile is held above the finger so it stays visible.
// - It lands in the empty cell that is under the tile; otherwise it goes back.
// - A tap without movement does nothing.
// The real tile stays in its original cell (faded) while a look-alike copy of
// it floats above the page, so no board/tray CSS (overflow, transforms,
// z-index, an "is-dragging" rule...) can hide the copy, and all cell-based
// CSS and scoring code keep working.
//
// Troubleshooting: open the game with ?dnddebug at the end of the address
// (for example https://www.rollaword.com/?dnddebug) to show a status line
// at the bottom of the screen while dragging.
// =========================================================================
const DRAG_START_DISTANCE = 4;      // pixels of movement before a press counts as a drag
const TOUCH_LIFT_FACTOR = 0.9;      // on touch, the tile floats this many tile-heights above the finger
const DND_DEBUG = /[?&]dnddebug/.test(window.location.search);
let activeDrag = null;
let dndDebugBox = null;

function dndLog(text) {
  if (!DND_DEBUG) return;
  if (!dndDebugBox) {
    dndDebugBox = document.createElement("pre");
    dndDebugBox.style.cssText = "position:fixed;left:0;right:0;bottom:0;margin:0;padding:4px;" +
      "font:11px monospace;background:rgba(0,0,0,.85);color:#0f0;z-index:2147483647;" +
      "pointer-events:none;white-space:pre-wrap";
    document.body.appendChild(dndDebugBox);
  }
  dndDebugBox.textContent = text;
}

function describeDrag(label, e, d) {
  const g = d && d.ghost;
  const r = g ? g.getBoundingClientRect() : null;
  const cs = g ? getComputedStyle(g) : null;
  const top = document.elementsFromPoint(e.clientX, e.clientY).slice(0, 3)
    .map(el => el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "")).join(" > ");
  dndLog(label + " " + e.pointerType + " moving=" + (d ? d.moving : "-") +
    "\nghost=" + (g ? (document.body.contains(g) ? "in-page" : "DETACHED") : "none") +
    (r ? " rect=" + Math.round(r.left) + "," + Math.round(r.top) + " " + Math.round(r.width) + "x" + Math.round(r.height) : "") +
    (cs ? " vis=" + cs.visibility + " op=" + cs.opacity + " disp=" + cs.display + " pos=" + cs.position : "") +
    "\npointer=" + Math.round(e.clientX) + "," + Math.round(e.clientY) + " under: " + top);
}

// Look-alike copy of a tile with its computed styles written inline, so it looks
// the same even when it lives outside the board (where cell-scoped CSS rules no
// longer apply). Logical twins of the physical properties (inset-*, *-block-*,
// *-inline-*) are skipped because some browsers let them override top/left/width.
function snapshotTile(source) {
  const copy = source.cloneNode(false);
  const computed = getComputedStyle(source);
  for (const prop of computed) {
    if (/(^|-)(block|inline)(-|$)/.test(prop)) continue;
    copy.style.setProperty(prop, computed.getPropertyValue(prop), "important");   // beats !important rules in the page CSS
  }
  copy.style.setProperty("animation", "none", "important");
  copy.style.setProperty("transition", "none", "important");
  copy.removeAttribute("id");
  source.childNodes.forEach(child => {
    copy.appendChild(child.nodeType === 1 ? snapshotTile(child) : child.cloneNode(true));
  });
  return copy;
}

function floatGhost(d) {
  const ghost = snapshotTile(d.die);
  const force = (name, value) => ghost.style.setProperty(name, value, "important");
  force("position", "fixed");
  force("left", d.rect.left + "px");
  force("top", d.rect.top + "px");
  force("right", "auto");
  force("bottom", "auto");
  force("width", d.rect.width + "px");
  force("height", d.rect.height + "px");
  force("margin", "0");
  force("z-index", "2147483647");
  force("pointer-events", "none");
  force("opacity", "1");
  force("visibility", "visible");
  force("will-change", "transform");
  force("box-shadow", "0 6px 14px rgba(0,0,0,0.35)");
  force("transform", "translate(0px, 0px)");
  ghost.classList.add("drag-ghost");
  document.body.appendChild(ghost);
  return ghost;
}

function cellUnderPoint(x, y) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.classList && el.classList.contains("grid-cell")) return el;
  }
  return null;
}

function setDropHighlight(cell) {
  const d = activeDrag;
  const next = cell && !cell.hasChildNodes() ? cell : null;
  if (d.hover && d.hover !== next) d.hover.classList.remove("drag-over");
  if (next) next.classList.add("drag-over");
  d.hover = next;
}

function tileCenter(d, e) {
  return {
    x: d.rect.left + d.rect.width / 2 + (e.clientX - d.startX),
    y: d.rect.top + d.rect.height / 2 + (e.clientY - d.startY) - d.lift
  };
}

function beginDieDrag(e) {
  if (activeDrag) return;                                        // one tile at a time
  if (gameEnded) return;                                         // no dragging after Done or when time is up
  if (e.pointerType === "mouse" && e.button !== 0) return;       // left button only
  const die = e.currentTarget;
  const rect = die.getBoundingClientRect();
  activeDrag = {
    die,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    rect,
    lift: e.pointerType === "touch" ? rect.height * TOUCH_LIFT_FACTOR : 0,
    moving: false,
    hover: null,
    ghost: null
  };
  try { die.setPointerCapture(e.pointerId); } catch (err) { /* not essential: listeners are on window */ }
  // Listen on window, not on the tile, so the drag keeps working even if the tile is hidden or re-styled
  window.addEventListener("pointermove", moveDieDrag);
  window.addEventListener("pointerup", endDieDrag);
  window.addEventListener("pointercancel", endDieDrag);
  e.preventDefault();
  describeDrag("down", e, activeDrag);
}

function moveDieDrag(e) {
  const d = activeDrag;
  if (!d || e.pointerId !== d.pointerId) return;
  const dx = e.clientX - d.startX;
  const dy = e.clientY - d.startY;

  if (!d.moving) {
    if (Math.hypot(dx, dy) < DRAG_START_DISTANCE) return;
    d.moving = true;
    d.ghost = floatGhost(d);                    // copy first, before the real tile is faded
    d.die.style.opacity = "0.35";               // the real tile stays behind as a faded placeholder
    d.die.classList.add("drag-source");
    document.querySelectorAll(".grid-cell").forEach(c => { if (!c.hasChildNodes()) c.classList.add("valid-drop-target"); });
  }

  d.ghost.style.setProperty("transform", "translate(" + dx + "px, " + (dy - d.lift) + "px) scale(1.1)", "important");
  const center = tileCenter(d, e);
  setDropHighlight(cellUnderPoint(center.x, center.y));
  describeDrag("move", e, d);
}

function endDieDrag(e) {
  const d = activeDrag;
  if (!d || e.pointerId !== d.pointerId) return;
  const die = d.die;

  window.removeEventListener("pointermove", moveDieDrag);
  window.removeEventListener("pointerup", endDieDrag);
  window.removeEventListener("pointercancel", endDieDrag);
  try { if (die.hasPointerCapture(d.pointerId)) die.releasePointerCapture(d.pointerId); } catch (err) { /* ignore */ }

  let target = null;
  if (d.moving && e.type === "pointerup" && !gameEnded) {       // if the game ended mid-drag, the tile goes back
    const center = tileCenter(d, e);
    const cell = cellUnderPoint(center.x, center.y);
    if (cell && !cell.hasChildNodes()) target = cell;
  }
  describeDrag(e.type + (target ? " -> cell " + target.dataset.row + "," + target.dataset.col : " -> back"), e, d);

  // Remove the floating copy, restore the real tile, then move it if it has somewhere to go
  if (d.ghost) d.ghost.remove();
  die.style.opacity = "";
  die.classList.remove("drag-source");
  document.querySelectorAll(".grid-cell").forEach(c => c.classList.remove("valid-drop-target", "drag-over"));
  activeDrag = null;

  if (target) {
    target.appendChild(die);
    if (typeof checkWords === "function") checkWords();
  }
}



// =========================================================================
// GAME CONTROL ENGINE HOOKS & SHARED UTILITIES
// =========================================================================
let timeRemaining = INITIAL_TIME_SECONDS;
let gameEnded = true;
let countdownTicker = null;
const timerDisplay = document.getElementById("timer-display");

/**
 * Shared layout rendering pipeline used by both game modes.
 */
function renderDicePayload(payload) {
  // Flush stale nodes
  document.querySelectorAll('.grid-cell').forEach(cell => cell.innerHTML = '');

  // Unified rendering cycle
  payload.forEach((rawFace, index) => {
    const chosenFace = {
      L: rawFace.L || rawFace.l,
      C: rawFace.C || rawFace.c
    };

    const dieElement = document.createElement("div");
    dieElement.classList.add("die", chosenFace.C.toLowerCase());
    dieElement.id = `die-${index}`;
    // Pointer-based dragging: touch-action:none stops the page scrolling while a tile is dragged
    dieElement.style.touchAction = "none";
    dieElement.style.userSelect = "none";
    dieElement.style.webkitUserSelect = "none";
    dieElement.style.webkitTouchCallout = "none";
    dieElement.style.cursor = "grab";
    dieElement.dataset.letter = chosenFace.L;
    dieElement.dataset.color = chosenFace.C;

    const letterSpan = document.createElement("span");
    letterSpan.textContent = chosenFace.L === "*" ? "" : chosenFace.L;
    dieElement.appendChild(letterSpan);

    const valueBadge = document.createElement("span");
    valueBadge.classList.add("die-value");
    valueBadge.textContent = window.SCRABBLE_SCORE_MAP[chosenFace.L] || 0;
    dieElement.appendChild(valueBadge);

    dieElement.addEventListener("pointerdown", beginDieDrag);
    dieElement.addEventListener("contextmenu", e => e.preventDefault());   // no long-press menu on phones

    const targetTrayCell = diceTray.querySelector(`.grid-cell[data-col="${index}"]`);
    if (targetTrayCell) targetTrayCell.appendChild(dieElement);
  });
}

/**
 * Shared clock ticking manager.
 */
function startCountdownTimer() {
  clearInterval(countdownTicker);
  if (!isKidsMode) {
    countdownTicker = setInterval(() => {
      if (timeRemaining <= 0) { clearTimeoutEngine(); return; }
      timeRemaining--;
      const mins = Math.floor(timeRemaining / 60);
      const secs = timeRemaining % 60;
      if (timerDisplay) timerDisplay.textContent = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }, 1000);
  } else {
    const outputBox = document.getElementById("score-output-area");
    if (outputBox) outputBox.innerHTML = "<div style='color: #16a34a;'>Find your hidden words! You can do it! ✨</div>";
  }
}

/**
 * 🚀 Mode 1: FREE PLAY Engine Initiation
 */
function startGameEngine() {
  // CLEAR OLD STRIKE-THROUGH LINES
  document.querySelectorAll(".word-strike-line").forEach(line => line.remove());

  isDailyChallengeMode = false;
  gameEnded = false;
  timeRemaining = INITIAL_TIME_SECONDS;
  
  const verifiedRollResult = window.generateLetterPayload();
  renderDicePayload(verifiedRollResult);
  startCountdownTimer();
}

/**
 * 📅 Mode 2: DAILY CHALLENGE Engine Initiation
 */
function startChallengeEngine() {
  // CLEAR OLD STRIKE-THROUGH LINES
  document.querySelectorAll(".word-strike-line").forEach(line => line.remove());

  console.log("isDailyChallengeMode in rollaword.js - startChallengeEngine:", window.isDailyChallengeMode);
  isDailyChallengeMode = true; 
  gameEnded = false;
  timeRemaining = INITIAL_TIME_SECONDS;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayKey = `${year}${month}${day}`;

  fetch('js/dailychallenge.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load challenge file: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      const dailyLetters = data[todayKey];
      
      if (!dailyLetters || !Array.isArray(dailyLetters)) {
        alert(`No puzzle data found in challenge schema for today (${todayKey}).`);
        clearTimeoutEngine();
        return;
      }

      renderDicePayload(dailyLetters);
      startCountdownTimer();
    })
    .catch(error => {
      console.error("Daily Challenge initialization exception error:", error);
      alert("Could not load today's Daily Challenge tray setup. Please verify your data source path mapping.");
      clearTimeoutEngine();
    });
}

function clearTimeoutEngine() {
  if (gameEnded) return;
  gameEnded = true;
  clearInterval(countdownTicker);
  if (typeof processEndgameScoring === 'function') {
    processEndgameScoring(timeRemaining);
  }
}