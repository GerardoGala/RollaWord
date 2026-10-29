// =========================================================================
// ROLLAWORD - INDEPENDENT COMMON CORE CONTROLLER
// =========================================================================
let isDailyChallengeMode = false; // Tracks active game mode context

const GRID_ROWS = 6;
const GRID_COLS = 8;
const INITIAL_TIME_SECONDS = 180;

const gameTitleElement = document.getElementById("game-title");

// =========================================================================
// PHASE 1: IMMEDIATE DRAW-GRID SYSTEM (Safely waits for HTML elements)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const gameBoard = document.getElementById("game-board");
  const diceTray = document.getElementById("dice-tray");

  if (!gameBoard || !diceTray) {
    console.error("RollaWord requires #game-board and #dice-tray containers.");
    return;
  }

  // 🎨 DRAWS THE GRID ON LOAD: Instant layout rendering for speed validation
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

  // 🎨 DRAWS THE TRAY ON LOAD: Instantly visible container lane
  for (let c = 0; c < GRID_COLS; c++) {
    const cell = document.createElement("div");
    cell.classList.add("grid-cell", "tray-cell");
    
    // 🧠 THE ANTI-NAN FIX: Change "tray" to "-1"
    cell.dataset.row = "-1"; 
    cell.dataset.col = c;
    
    attachLayoutDragListeners(cell);
    diceTray.appendChild(cell);
  }
  
  console.log("Grid successfully drawn on page ready state!");
});

function attachLayoutDragListeners(cell) {}
