// =========================================================================
// ROLLACITY - BROWSER-SIDE TRAY GENERATOR (used by FREE PLAY on RollaCity)
//
// Load this file BEFORE rollaword.js:   <script src="/rollacity/js/citygen.js"></script>
// It defines  window.generateCityPayload()  which returns 8 tiles in the same
// format as dailychallenge.json:  [ { l: "K", c: "red" }, ... ]
//
// Same algorithm as RollaSail's generator:
//   1. pick a random country or capital
//   2. add a crossing word from the word list so that exactly 8 tiles are used
//   3. shuffle the 8 letters and color each tile red or blue at random
// The tray is built from a real, valid 6x8 board, so all 8 tiles can always be played.
// The board it was built from is kept in  window.lastCitySolution  (for a solution page).
//
// -------------------------------------------------------------------------
// THE WORD LIST IS ONE FILE:  city-data.csv   (in the SAME FOLDER AS THIS SCRIPT)
//
// It is the single source of truth. The game reads it, and howToCity.html
// shows it to the players. You never edit this script to change a word.
// Edit the CSV in Excel / Sheets and save it as "CSV UTF-8".
//
//   Column                 What the game does with it
//   ---------------------  ------------------------------------------------
//   Country                (shown on the how-to page only)
//   Capital(s)             (shown on the how-to page only)
//   Type for country       a valid word. Letters A-Z only, at most 8 letters
//   Type for capital(s)    valid words, separated by "; "
//   Also accepted          more valid words, separated by "; "
//   Note                   (shown on the how-to page only)
//
// Keep the header row exactly as it is. Blank lines are ignored.
// If a word is longer than 8 letters or has other characters, the browser
// console lists it and the game ignores it.
// -------------------------------------------------------------------------
// WHY SO FEW SHAPES: every word is at least 4 letters, so the only boards that use
// exactly 8 tiles are
//     * one 8-letter name on its own (the 8-tile word bonus), or
//     * a 4-letter name crossing a 5-letter name.
// SINGLE_WORD_CHANCE below says how often the first kind is dealt.
// -------------------------------------------------------------------------
// Because the list is downloaded, the generator is ready a moment after the
// page loads. window.cityWordsReady is a promise that resolves when it is.
// =========================================================================
(function () {
  'use strict';

  // ---- settings ----
  // The CSV is looked for next to this script, so it works from any folder or server.
  const BASE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src)
    ? document.currentScript.src.replace(/[^\/]*$/, '')
    : '/rollacity/js/';
  const DATA_URL = BASE + 'city-data.csv';
  const SINGLE_WORD_CHANCE = 0.15;   // 0 = never one 8-letter name alone, 1 = always
  const COLORS = ['red', 'blue'];
  const ROWS = 6, COLS = 8, TILES = 8;

  // ---- word list (filled in when the CSV arrives) ----
  const dictionary = new Set();   // every valid word, lowercase
  const kindOf = new Map();       // word -> 'country' | 'capital' | 'alternate'
  const fillWords = [];           // words that can be placed on the board
  const eightLetterTerms = [];    // 8-letter words: a whole tray on their own
  const crossTerms = [];          // 4/5-letter words that have a crossing partner
  let ready = false;
  let loadError = null;
  let lastTerm = '';

  // The Set is created now and filled later, so scripts that grab it early still see the words.
  window.CITY_WORDS = dictionary;   // lowercase valid words (for the dictionary check)

  // ---- reading the CSV ----
  function parseCSV(text) {                        // handles quoted fields and commas inside them
    const out = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') out.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); out.push(row); }
    return out;
  }

  function addWord(raw, kind, where) {
    const w = String(raw || '').trim().toLowerCase();
    if (!w) return;
    if (!/^[a-z]+$/.test(w)) { console.warn('RollaCity: ' + where + ' ignored (letters A-Z only): "' + raw + '"'); return; }
    if (w.length > TILES) { console.warn('RollaCity: ' + where + ' ignored (longer than ' + TILES + ' letters): "' + raw + '"'); return; }
    dictionary.add(w);
    if (!kindOf.has(w) || kind === 'country') kindOf.set(w, kind);   // a name that is both is called a country
  }

  function loadData() {
    return fetch(DATA_URL, { cache: 'no-cache' })            // always check for a newer copy of the file
      .then(function (res) {
        if (!res.ok) throw new Error(DATA_URL + ' (HTTP ' + res.status + ')');
        return res.text();
      })
      .then(function (text) {
        const rows = parseCSV(text.replace(/^﻿/, ''));
        const head = rows.shift() || [];
        const col = function (name) {
          const i = head.map(function (h) { return h.trim(); }).indexOf(name);
          if (i < 0) throw new Error('city-data.csv has no "' + name + '" column');
          return i;
        };
        const iCountry = col('Type for country'), iCaps = col('Type for capital(s)'), iAlso = col('Also accepted');
        rows.forEach(function (r, n) {
          const where = 'city-data.csv row ' + (n + 2);
          addWord(r[iCountry], 'country', where);
          (r[iCaps] || '').split(';').forEach(function (w) { addWord(w, 'capital', where); });
          (r[iAlso] || '').split(';').forEach(function (w) { addWord(w, 'alternate', where); });
        });
        if (!dictionary.size) throw new Error('city-data.csv has no words');
      });
  }

  window.cityWordsReady = loadData()
    .then(function () {
      dictionary.forEach(function (w) { if (w.length >= 2) fillWords.push(w); });
      dictionary.forEach(function (w) {
        if (w.length === TILES) eightLetterTerms.push(w);
        else {
          // a start word can only finish a tray if some other word crosses it and adds the right number of tiles
          const need = TILES - w.length + 1;      // length of the crossing word that fills the tray exactly
          const partner = fillWords.some(function (o) {
            return o.length === need && o !== w && o.split('').some(function (ch) { return w.indexOf(ch) >= 0; });
          });
          if (partner) crossTerms.push(w);
        }
      });
      if (!eightLetterTerms.length && !crossTerms.length) throw new Error('no word in city-data.csv can start a tray');
      ready = true;
    })
    .catch(function (err) {
      loadError = err;
      console.error('RollaCity: could not load the word list: ' + err.message);
    });

  // ---- helpers ----
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const emptyGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(''));

  // every run of 2+ letters, across and down
  function getRuns(grid) {
    const runs = [];
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        if (!grid[r][c]) { c++; continue; }
        const s = c; let word = '';
        while (c < COLS && grid[r][c]) { word += grid[r][c]; c++; }
        if (word.length >= 2) runs.push({ word, dir: 'H', row: r, col: s });
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        if (!grid[r][c]) { r++; continue; }
        const s = r; let word = '';
        while (r < ROWS && grid[r][c]) { word += grid[r][c]; r++; }
        if (word.length >= 2) runs.push({ word, dir: 'V', row: s, col: c });
      }
    }
    return runs;
  }
  const allRunsValid = grid => getRuns(grid).every(run => dictionary.has(run.word));

  // try to lay a word on the board; returns { g, newCount } or null
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

  // build a board around one start word, using exactly TILES tiles
  function buildBoard(term) {
    for (let attempt = 0; attempt < 400; attempt++) {
      let grid = emptyGrid();
      const row = Math.floor(Math.random() * ROWS);
      const col = Math.floor(Math.random() * (COLS - term.length + 1));
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
      const runs = getRuns(grid);
      if (!runs.some(run => run.word === term && run.dir === 'H' && run.row === row && run.col === col)) continue;
      return { grid, runs };
    }
    return null;
  }

  function chooseTerm() {
    const wantSingle = eightLetterTerms.length && (!crossTerms.length || Math.random() < SINGLE_WORD_CHANCE);
    const pool = wantSingle ? eightLetterTerms : crossTerms;
    let term = pick(pool);
    if (term === lastTerm && pool.length > 1) term = pick(pool);   // avoid the same word twice in a row
    return term;
  }

  function generateCityPayload() {
    if (!ready) {
      throw new Error(loadError
        ? 'RollaCity: the word list failed to load (' + loadError.message + ')'
        : 'RollaCity: the word list is still loading, please try again in a moment');
    }
    for (let i = 0; i < 30; i++) {
      const term = chooseTerm();
      const board = buildBoard(term);
      if (!board) continue;
      lastTerm = term;
      const letters = board.grid.flat().filter(Boolean);
      window.lastCitySolution = {
        term: term.toUpperCase(),
        words: board.runs.map(r => ({
          word: r.word.toUpperCase(), dir: r.dir, row: r.row, col: r.col, kind: kindOf.get(r.word) || 'country'
        })),
        rows: board.grid.map(row => row.map(ch => (ch ? ch.toUpperCase() : '.')).join(''))
      };
      // Same hooks RollaWord's generator uses, so "Show me the Solution" works in Free Play
      window.LAST_SOLUTION = window.lastCitySolution;
      if (typeof document !== 'undefined') {
        const oldBtn = document.getElementById('show-solution-btn');   // a new game removes the old button
        if (oldBtn) oldBtn.remove();
      }
      if (typeof saveSolutionForSolutionPage === 'function') saveSolutionForSolutionPage(window.lastCitySolution);
      return shuffle(letters).map(l => ({ l: l.toUpperCase(), c: pick(COLORS) }));
    }
    throw new Error('RollaCity: could not build a tray');
  }

  window.generateCityPayload = generateCityPayload;
})();
