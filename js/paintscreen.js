// =========================================================================
// ROLLAWORD - PAINTSCREEN  (part 1 of 2 of the old rollaword.js)
// Draws the empty game screen: the 6x8 board and the 1x8 tray. Nothing else.
// Small on purpose, so the first paint is fast. Load this one FIRST.
//
// Part 2 (afterpaintscreen.js) holds everything else. Together the two files
// are exactly the old rollaword.js, in this order. To get the old behaviour
// back, load both, in order, where rollaword.js used to load.
// =========================================================================
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



