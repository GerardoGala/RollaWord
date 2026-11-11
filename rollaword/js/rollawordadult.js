// =========================================================================
// ROLLAWORD ADULT SEGMENT - PLAYABLE RACK GENERATOR
// Builds a small valid crossword first, then hands its 8 tiles to the
// player, so every rack can always be played out completely.
// Needs rollaword-dictionary.js (LOCAL_DICTIONARY / dictionaryReady).
// =========================================================================

window.SCRABBLE_SCORE_MAP = {
  "A": 1, "E": 1, "I": 1, "O": 1, "U": 1, "L": 1, "N": 1, "R": 1, "S": 1, "T": 1,
  "D": 2, "G": 2, "B": 3, "C": 3, "M": 3, "P": 3, "F": 4, "H": 4, "V": 4, "W": 4, "Y": 4,
  "K": 5, "J": 8, "X": 8, "Q": 10, "Z": 10, "*": 0
};

const GEN_ROWS = 6;
const GEN_COLS = 8;
const RACK_SIZE = 8;

// Real Scrabble tile counts: a rack never holds more of a letter than the set has.
const TILE_LIMITS = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1
};
const MAX_BLANKS = 2;

// The four hardest letters only appear when the first roll picks them,
// never sneaking in through the filler words.
const HARD_LETTERS = "QZJX";

const die = n => 1 + Math.floor(Math.random() * n);
const pick = list => list[Math.floor(Math.random() * list.length)];

// -------------------------------------------------------------------------
// Word index: wordIndex[length][letter] = words of that length containing it
// -------------------------------------------------------------------------
let wordIndex = null;

function getWordIndex() {
  if (wordIndex && wordIndex.source === LOCAL_DICTIONARY) return wordIndex;

  const index = { source: LOCAL_DICTIONARY };
  for (let len = 2; len <= RACK_SIZE; len++) index[len] = { all: [] };

  for (const raw of LOCAL_DICTIONARY) {
    if (raw.length < 2 || raw.length > RACK_SIZE || !/^[a-z]+$/.test(raw)) continue;
    const word = raw.toUpperCase();
    const bucket = index[word.length];
    bucket.all.push(word);
    for (const ch of new Set(word)) {
      if (!bucket[ch]) bucket[ch] = [];
      bucket[ch].push(word);
    }
  }
  wordIndex = index;
  return index;
}

// -------------------------------------------------------------------------
// Step 1: the cascade roll (hardest letters first)
// -------------------------------------------------------------------------
function rollStartingGroup() {
  if (die(13) === 1) {                       // QZ--
    const r = die(4);
    if (r === 1) return { letter: "Q", startsWith: true, blanks: 0 };
    if (r === 2) return { letter: "Z", blanks: 0 };
    return { letter: null, blanks: r === 3 ? 1 : 2 };
  }
  if (die(8) === 1) return { letter: die(2) === 1 ? "J" : "X", blanks: 0 };
  if (die(5) === 1) return { letter: "K", blanks: 0 };
  if (die(4) === 1) return { letter: pick(["F", "H", "V", "W", "Y"]), blanks: 0 };
  if (die(3) === 1) return { letter: pick(["B", "C", "M", "P"]), blanks: 0 };
  if (die(2) === 1) return { letter: pick(["D", "G"]), blanks: 0 };
  return { letter: null, blanks: 0 };        // common 1-point letters only
}

// -------------------------------------------------------------------------
// Grid helpers
// -------------------------------------------------------------------------
const inBounds = (r, c) => r >= 0 && r < GEN_ROWS && c >= 0 && c < GEN_COLS;

function newGrid() {
  return Array.from({ length: GEN_ROWS }, () => Array(GEN_COLS).fill(null));
}

function listTiles(grid) {
  const tiles = [];
  for (let r = 0; r < GEN_ROWS; r++) {
    for (let c = 0; c < GEN_COLS; c++) {
      if (grid[r][c]) tiles.push({ r, c, ch: grid[r][c].ch });
    }
  }
  return tiles;
}

// Every run of 2+ tiles, across and down, must be a dictionary word.
function boardIsValid(grid) {
  const check = (line) => {
    let run = "";
    for (let i = 0; i <= line.length; i++) {
      const cell = i < line.length ? line[i] : null;
      if (cell) { run += cell.ch; continue; }
      if (run.length >= 2 && !LOCAL_DICTIONARY.has(run.toLowerCase())) return false;
      run = "";
    }
    return true;
  };
  for (let r = 0; r < GEN_ROWS; r++) if (!check(grid[r])) return false;
  for (let c = 0; c < GEN_COLS; c++) if (!check(grid.map(row => row[c]))) return false;
  return true;
}

function rackWithinLimits(grid) {
  const counts = {};
  let blanks = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (!cell) continue;
      if (cell.blank) { blanks++; continue; }
      counts[cell.ch] = (counts[cell.ch] || 0) + 1;
      if (counts[cell.ch] > TILE_LIMITS[cell.ch]) return false;
    }
  }
  return blanks <= MAX_BLANKS;
}

// Returns the new tiles a word would add, or null if it can't go there.
function tryPlace(grid, word, r0, c0, dr, dc, maxNew) {
  const rEnd = r0 + dr * (word.length - 1);
  const cEnd = c0 + dc * (word.length - 1);
  if (!inBounds(r0, c0) || !inBounds(rEnd, cEnd)) return null;

  // The cells just before and after must be empty so the run is exactly this word.
  if (inBounds(r0 - dr, c0 - dc) && grid[r0 - dr][c0 - dc]) return null;
  if (inBounds(rEnd + dr, cEnd + dc) && grid[rEnd + dr][cEnd + dc]) return null;

  const added = [];
  for (let i = 0; i < word.length; i++) {
    const r = r0 + dr * i;
    const c = c0 + dc * i;
    const cell = grid[r][c];
    if (cell) {
      if (cell.ch !== word[i]) return null;
    } else {
      if (HARD_LETTERS.includes(word[i])) return null;
      added.push({ r, c, ch: word[i] });
    }
  }
  if (added.length === 0 || added.length === word.length || added.length > maxNew) return null;
  return added;
}

// -------------------------------------------------------------------------
// Steps 2 and 3: first word, then crossing words until there are 8 tiles
// -------------------------------------------------------------------------
function firstWordOk(word, group) {
  let hard = 0;
  for (const ch of word) if (HARD_LETTERS.includes(ch)) hard++;
  const wantsHard = group.letter && HARD_LETTERS.includes(group.letter);
  if (wantsHard ? hard !== 1 : hard !== 0) return false;
  if (group.startsWith && word[0] !== group.letter) return false;
  return true;
}

function buildSolution(group) {
  const index = getWordIndex();

  // Step 2: first word, random length 2 to 8, built around the rolled letter
  const lengths = [2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
  let word = null;
  for (const len of lengths) {
    const pool = group.letter ? index[len][group.letter] : index[len].all;
    if (!pool) continue;
    const candidates = pool.filter(w => firstWordOk(w, group));
    if (candidates.length) { word = pick(candidates); break; }
  }
  if (!word) return null;

  const grid = newGrid();
  const row = die(GEN_ROWS) - 1;
  const col = Math.floor(Math.random() * (GEN_COLS - word.length + 1));
  const blankAt = new Set();
  while (blankAt.size < group.blanks) blankAt.add(Math.floor(Math.random() * word.length));
  for (let i = 0; i < word.length; i++) {
    grid[row][col + i] = { ch: word[i], blank: blankAt.has(i) };
  }
  if (!rackWithinLimits(grid) || !boardIsValid(grid)) return null;
  const words = [word];

  // Step 3: lettersLeft = 8 - tiles on the board; add a crossing word of
  // 2 to lettersLeft + 1 letters (the shared letter adds no new tile).
  while (listTiles(grid).length < RACK_SIZE) {
    const lettersLeft = RACK_SIZE - listTiles(grid).length;
    let placed = false;

    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      const pivot = pick(listTiles(grid));
      const hasAcross = (inBounds(pivot.r, pivot.c - 1) && grid[pivot.r][pivot.c - 1]) ||
                        (inBounds(pivot.r, pivot.c + 1) && grid[pivot.r][pivot.c + 1]);
      const hasDown = (inBounds(pivot.r - 1, pivot.c) && grid[pivot.r - 1][pivot.c]) ||
                      (inBounds(pivot.r + 1, pivot.c) && grid[pivot.r + 1][pivot.c]);
      if (hasAcross === hasDown) continue;     // already crossed, or isolated
      const [dr, dc] = hasAcross ? [1, 0] : [0, 1];

      const len = 2 + Math.floor(Math.random() * lettersLeft);
      const pool = index[len][pivot.ch];
      if (!pool || !pool.length) continue;
      const candidate = pick(pool);
      const spots = [];
      for (let i = 0; i < candidate.length; i++) if (candidate[i] === pivot.ch) spots.push(i);
      const i = pick(spots);

      const added = tryPlace(grid, candidate, pivot.r - dr * i, pivot.c - dc * i, dr, dc, lettersLeft);
      if (!added) continue;

      added.forEach(t => { grid[t.r][t.c] = { ch: t.ch, blank: false }; });
      if (boardIsValid(grid) && rackWithinLimits(grid)) {
        placed = true;
        words.push(candidate);
      } else {
        added.forEach(t => { grid[t.r][t.c] = null; });
      }
    }
    if (!placed) return null;
  }
  return { grid, words, rows: gridToRows(grid) };
}

// -------------------------------------------------------------------------
// Rack output: same { L, C } format the engine already renders
// -------------------------------------------------------------------------
// Compact answer key: A-Z = tile, a-z = blank standing for that letter, "." = empty.
// This is also the format to store in dailychallenge.json as "YYYYMMDD_solution".
function gridToRows(grid) {
  return grid.map(row => row.map(cell =>
    !cell ? "." : (cell.blank ? cell.ch.toLowerCase() : cell.ch)
  ).join(""));
}

function gridToRack(grid) {
  const rack = [];
  for (const row of grid) {
    for (const cell of row) {
      if (!cell) continue;
      rack.push({ L: cell.blank ? "*" : cell.ch, C: Math.random() < 0.5 ? "BLUE" : "RED" });
    }
  }
  for (let i = rack.length - 1; i > 0; i--) {          // shuffle
    const j = Math.floor(Math.random() * (i + 1));
    [rack[i], rack[j]] = [rack[j], rack[i]];
  }
  return rack;
}

// -------------------------------------------------------------------------
// Old dice roll, kept only as a safety net if the dictionary isn't loaded
// -------------------------------------------------------------------------
const PHYSICAL_DICE_ROSTER = [
  [ {L:"A", C:"BLUE"}, {L:"E", C:"RED"},  {L:"I", C:"BLUE"}, {L:"A", C:"RED"},  {L:"E", C:"BLUE"}, {L:"I", C:"RED"} ],
  [ {L:"A", C:"RED"},  {L:"E", C:"BLUE"}, {L:"I", C:"RED"},  {L:"A", C:"BLUE"}, {L:"E", C:"RED"},  {L:"I", C:"BLUE"} ],
  [ {L:"O", C:"BLUE"}, {L:"U", C:"RED"},  {L:"O", C:"RED"},  {L:"U", C:"BLUE"}, {L:"O", C:"BLUE"}, {L:"E", C:"RED"} ],
  [ {L:"N", C:"BLUE"}, {L:"R", C:"RED"},  {L:"S", C:"BLUE"}, {L:"T", C:"RED"},  {L:"D", C:"BLUE"}, {L:"G", C:"RED"} ],
  [ {L:"L", C:"RED"},  {L:"N", C:"BLUE"}, {L:"R", C:"RED"},  {L:"S", C:"BLUE"}, {L:"T", C:"RED"},  {L:"G", C:"BLUE"} ],
  [ {L:"B", C:"BLUE"}, {L:"C", C:"RED"},  {L:"M", C:"BLUE"}, {L:"P", C:"RED"},  {L:"F", C:"BLUE"}, {L:"H", C:"RED"} ],
  [ {L:"V", C:"BLUE"}, {L:"W", C:"RED"},  {L:"Y", C:"BLUE"}, {L:"K", C:"RED"},  {L:"J", C:"BLUE"}, {L:"*", C:"RED"} ],
  [ {L:"X", C:"RED"},  {L:"Z", C:"BLUE"}, {L:"Q", C:"RED"},  {L:"M", C:"BLUE"}, {L:"P", C:"RED"},  {L:"*", C:"BLUE"} ]
];

// The only link between the game and solution.html: the latest answer key is
// saved under one localStorage key. Passing null clears it (no solution exists).
function saveSolutionForSolutionPage(solution) {
  try {
    if (solution) {
      localStorage.setItem("rollaword.solution", JSON.stringify({
        rows: solution.rows,
        savedAt: Date.now()
      }));
    } else {
      localStorage.removeItem("rollaword.solution");
    }
  } catch (e) {
    console.warn("RollaWord: could not save the solution:", e);
  }
}

function rollPhysicalDice() {
  return PHYSICAL_DICE_ROSTER.map(d => ({ ...d[Math.floor(Math.random() * d.length)] }));
}

// -------------------------------------------------------------------------
// Entry point used by rollaword.js (synchronous, no await needed)
// -------------------------------------------------------------------------
window.generateLetterPayload = function () {
  const oldBtn = document.getElementById("show-solution-btn");   // a new game hides the old button
  if (oldBtn) oldBtn.remove();

  const ready = typeof dictionaryReady !== "undefined" && dictionaryReady &&
                typeof LOCAL_DICTIONARY !== "undefined";

  if (ready) {
    for (let reroll = 0; reroll < 5; reroll++) {
      const group = rollStartingGroup();
      for (let attempt = 0; attempt < 60; attempt++) {
        const solution = buildSolution(group);
        if (solution) {
          window.LAST_SOLUTION = solution;       // hidden answer key, handy for debugging
          saveSolutionForSolutionPage(solution); // lets solution.html (another tab) read it
          return gridToRack(solution.grid);
        }
      }
    }
    console.warn("RollaWord: could not build a playable rack, using plain dice.");
  } else {
    console.warn("RollaWord: dictionary not ready, using plain dice.");
  }
  window.LAST_SOLUTION = null;
  saveSolutionForSolutionPage(null);
  return rollPhysicalDice();
};

// -------------------------------------------------------------------------
// "Show me the Solution" button, added to #score-output-area after scoring.
// Call window.showSolutionButton() as the last step of processEndgameScoring.
// It only appears when this page's generator built the current game's rack
// (so never in Daily Challenge or if the plain dice fallback was used).
// -------------------------------------------------------------------------
window.showSolutionButton = function () {
  const scoreArea = document.getElementById("score-output-area");
  if (!scoreArea || !window.LAST_SOLUTION || window.isDailyChallengeMode) return;

  const old = document.getElementById("show-solution-btn");
  if (old) old.remove();

  const btn = document.createElement("button");
  btn.id = "show-solution-btn";
  btn.type = "button";
  btn.className = "btn";                       // same look and height as the other buttons
  btn.textContent = "Show me the Solution";
  btn.style.cssText = "display:block;width:100%;margin-top:16px;";
  btn.addEventListener("click", () => window.open("solution.html", "_blank"));
  scoreArea.appendChild(btn);
};

console.log("🏆 [RollaWord Segment] Playable Rack Generator Online.");
