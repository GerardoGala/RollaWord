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

function attachLayoutDragListeners(cell) {
  cell.addEventListener("dragover", e => {
    e.preventDefault();
    const target = e.target.closest(".grid-cell");
    if (target && !target.hasChildNodes()) target.classList.add("drag-over");
  });
  
  cell.addEventListener("dragleave", e => {
    const target = e.target.closest(".grid-cell");
    if (target) target.classList.remove("drag-over");
  });
  
  // 🏁 Corrected Drop Listener for clean boardMatrix alignment
  cell.addEventListener("drop", e => {
    e.preventDefault();
    
    const targetCell = e.currentTarget;
    if (!targetCell || targetCell.hasChildNodes()) return;
    
    targetCell.classList.remove("drag-over");
    
    const dieId = e.dataTransfer.getData("text/plain");
    const dieElement = document.getElementById(dieId);
    
    if (dieElement) {
      targetCell.appendChild(dieElement);
      
      if (typeof checkWords === 'function') {
        checkWords();
      }
    }
  });
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
    dieElement.draggable = true;
    dieElement.dataset.letter = chosenFace.L;
    dieElement.dataset.color = chosenFace.C;

    const letterSpan = document.createElement("span");
    letterSpan.textContent = chosenFace.L === "*" ? "" : chosenFace.L;
    dieElement.appendChild(letterSpan);

    const valueBadge = document.createElement("span");
    valueBadge.classList.add("die-value");
    valueBadge.textContent = window.SCRABBLE_SCORE_MAP[chosenFace.L] || 0;
    dieElement.appendChild(valueBadge);

    dieElement.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", e.currentTarget.id);
      e.currentTarget.classList.add("is-dragging");
      document.querySelectorAll('.grid-cell').forEach(c => { if(!c.hasChildNodes()) c.classList.add('valid-drop-target'); });
    });

    dieElement.addEventListener("dragend", e => {
      e.currentTarget.classList.remove("is-dragging");
      document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('valid-drop-target', 'drag-over'));
    });

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
