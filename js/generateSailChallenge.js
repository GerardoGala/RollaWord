#!/usr/bin/env node
// RollaSail daily challenge generator
//
// Usage:  node generateSailChallenge.js [seed=2]      (always writes 366 puzzles keyed MMDD, so they repeat every year)
//
// Reads (from the same folder as this script):
//   sailing-dictionary.txt   every valid word, one per line (sailing words + prepositions, articles, conjunctions)
//   sailing-terms.json       the sailing terms (the list used for step 1)
//
// Writes (same folder):
//   sailchallenge.json       { "YYYYMMDD": [ {"l":"K","c":"red"}, ... 8 tiles ... ], ... }   same format as dailychallenge.json
//   sailsolutions.json       { "YYYYMMDD": { term, words:[...], rows:[...] }, ... }          one valid solution per day
//
// Algorithm:
//   1. Pick a sailing term (shuffled bag: every term is used once before any repeats).
//   2. Place it on the 6x8 board, then keep adding words from the collection that cross
//      what is already on the board until exactly 8 tiles are used.
//   3. The 8 letters become the tray, each tile randomly red or blue, in shuffled order.
// Because the rack is built from a real, valid board, every rack can use all 8 tiles.

const fs = require('fs');
const path = require('path');

const ROWS = 6, COLS = 8, TILES = 8;
const COLORS = ['red', 'blue'];

// The Daily Challenge repeats every year, so puzzles are keyed by month and day only ("MMDD", e.g. "1030").
// 366 days (the days of a leap year) so February 29 has a puzzle too.
const days = 366;
const seed = parseInt(process.argv[2] || '2', 10);

// ---------- seeded random numbers (same seed = same puzzles) ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(seed);
const pick = arr => arr[Math.floor(rng() * arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- word lists ----------
const dir = __dirname;
const dictionary = new Set(
  fs.readFileSync(path.join(dir, 'sailing-dictionary.txt'), 'utf8')
    .split('\n').map(s => s.trim().toLowerCase()).filter(Boolean)
);
const sailingTerms = JSON.parse(fs.readFileSync(path.join(dir, 'sailing-terms.json'), 'utf8'))
  .terms.map(t => t.word.toLowerCase())
  .filter(w => w.length >= 3 && w.length <= TILES && dictionary.has(w));
const sailingSet = new Set(sailingTerms);
const fillWords = [...dictionary].filter(w => w.length >= 2 && w.length <= TILES);

// ---------- board helpers ----------
const emptyGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(''));

// every run of 2+ letters, across and down
function getRuns(grid) {
  const runs = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (!grid[r][c]) { c++; continue; }
      let s = c, word = '';
      while (c < COLS && grid[r][c]) { word += grid[r][c]; c++; }
      if (word.length >= 2) runs.push({ word, dir: 'H', row: r, col: s });
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (!grid[r][c]) { r++; continue; }
      let s = r, word = '';
      while (r < ROWS && grid[r][c]) { word += grid[r][c]; r++; }
      if (word.length >= 2) runs.push({ word, dir: 'V', row: s, col: c });
    }
  }
  return runs;
}
const allRunsValid = grid => getRuns(grid).every(run => dictionary.has(run.word));

// try to lay `w` on the board; returns { g, newCount } or null
function tryPlace(grid, w, d, r, c) {
  const dr = d === 'V' ? 1 : 0, dc = d === 'H' ? 1 : 0;
  if (r + dr * (w.length - 1) >= ROWS || c + dc * (w.length - 1) >= COLS) return null;
  const g = grid.map(row => row.slice());
  let newCount = 0, overlap = 0;
  for (let i = 0; i < w.length; i++) {
    const rr = r + dr * i, cc = c + dc * i;
    if (g[rr][cc] === '') { g[rr][cc] = w[i]; newCount++; }
    else if (g[rr][cc] === w[i]) overlap++;
    else return null;
  }
  if (newCount === 0 || overlap === 0) return null;
  return { g, newCount };
}

// ---------- build one board around a sailing term ----------
function buildBoard(term) {
  for (let attempt = 0; attempt < 400; attempt++) {
    let grid = emptyGrid();
    const row = Math.floor(rng() * ROWS);
    const col = Math.floor(rng() * (COLS - term.length + 1));
    for (let i = 0; i < term.length; i++) grid[row][col + i] = term[i];

    let remaining = TILES - term.length;
    const used = new Set([term]);

    while (remaining > 0) {
      let placed = false;
      for (const w of shuffle(fillWords)) {
        if (used.has(w)) continue;
        const options = [];
        for (const d of ['H', 'V']) {
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const tp = tryPlace(grid, w, d, r, c);
              if (tp && tp.newCount <= remaining && allRunsValid(tp.g)) options.push(tp);
            }
          }
        }
        if (options.length) {
          const choice = pick(options);
          grid = choice.g;
          remaining -= choice.newCount;
          used.add(w);
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }

    if (remaining !== 0) continue;
    // the sailing term must still stand as its own word on the finished board
    const runs = getRuns(grid);
    if (!runs.some(run => run.word === term && run.dir === 'H' && run.row === row && run.col === col)) continue;
    return { grid, runs };
  }
  return null;
}

// ---------- generate all days ----------
function dateKey(i) {
  const dt = new Date(Date.UTC(2028, 0, 1 + i));   // 2028 is a leap year: Jan 1 ... Dec 31, including Feb 29
  return `${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
}

let bag = [];
function nextTerm() {
  if (bag.length === 0) bag = shuffle(sailingTerms);
  return bag.pop();
}

const challenge = {};
const solutions = {};
const seenRacks = new Set();

for (let i = 0; i < days; i++) {
  let result = null, term = null;
  for (let tries = 0; tries < 50 && !result; tries++) {
    term = nextTerm();
    for (let k = 0; k < 6 && !result; k++) {
      const board = buildBoard(term);
      if (!board) break;
      const letters = board.grid.flat().filter(Boolean);
      const sig = letters.slice().sort().join('');
      if (seenRacks.has(sig)) continue;
      seenRacks.add(sig);
      result = { board, letters };
    }
  }
  if (!result) throw new Error('Could not build a puzzle for day ' + i);

  const key = dateKey(i);
  challenge[key] = shuffle(result.letters).map(l => ({ l: l.toUpperCase(), c: pick(COLORS) }));
  solutions[key] = {
    term: term.toUpperCase(),
    words: result.board.runs.map(r => ({
      word: r.word.toUpperCase(), dir: r.dir, row: r.row, col: r.col, sailing: sailingSet.has(r.word)
    })),
    rows: result.board.grid.map(row => row.map(ch => (ch ? ch.toUpperCase() : '.')).join(''))
  };
}

fs.writeFileSync(path.join(dir, 'sailchallenge.json'), JSON.stringify(challenge, null, 1));
fs.writeFileSync(path.join(dir, 'sailsolutions.json'), JSON.stringify(solutions, null, 1));
console.log(`Wrote ${days} days (0101 to 1231): sailchallenge.json and sailsolutions.json`);
console.log(`Sailing terms: ${sailingTerms.length}, fill words: ${fillWords.length}`);
