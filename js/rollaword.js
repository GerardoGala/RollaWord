// =========================================================================
// ROLLAWORD - BARE-MINIMUM SPEED CONTROLLER (Targeting 95+ Score)
// =========================================================================
let isDailyChallengeMode = false; 
let gameEnded = true;
let timeRemaining = 180;
let countdownTicker = null;

const GRID_ROWS = 6;
const GRID_COLS = 8;
const INITIAL_TIME_SECONDS = 180;

const isKidsMode = window.location.pathname.includes('id');
const gameTitleElement = document.getElementById("game-title");
const timerDisplay = document.getElementById("timer-display");

// =========================================================================
// INSTANT LAYOUT DRAW (Kept because it runs fast without logic)
// =========================================================================
const gameBoard = document.getElementById("game-board");
const diceTray = document.getElementById("dice-tray");

if (gameBoard && diceTray) {
  // Draw the 6x8 board matrix layout
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = document.createElement("div");
      cell.classList.add("grid-cell");
      cell.dataset.row = r;
      cell.dataset.col = c;
      gameBoard.appendChild(cell);
    }
  }

  // Draw the 1x8 dice tray layout
  for (let c = 0; c < GRID_COLS; c++) {
    const cell = document.createElement("div");
    cell.classList.add("grid-cell", "tray-cell");
    cell.dataset.row = "-1"; 
    cell.dataset.col = c;
    diceTray.appendChild(cell);
  }
}

// =========================================================================
// EMPTY SHELL HOOKS (Kept only so boot.js doesn't crash on click)
// =========================================================================
function startGameEngine() {
  console.log("FREE PLAY Clicked! Core engines are currently stripped for testing.");
}

function startChallengeEngine() {
  console.log("DAILY CHALLENGE Clicked! Core engines are currently stripped for testing.");
}
