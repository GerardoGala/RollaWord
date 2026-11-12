// =========================================================================
// ROLLASAIL - BROWSER-SIDE TRAY GENERATOR (used by FREE PLAY on RollaSail)
//
// Load this file BEFORE rollaword.js:   <script src="/rollasail/js/sailgen.js"></script>
// It defines  window.generateSailPayload()  which returns 8 tiles in the same
// format as dailychallenge.json:  [ { l: "K", c: "red" }, ... ]
//
// Same algorithm as the Daily Challenge:
//   1. pick a random sailing term
//   2. add crossing words from the word list until exactly 8 tiles are used
//   3. shuffle the 8 letters and color each tile red or blue at random
// The tray is built from a real, valid 6x8 board, so all 8 tiles can always be played.
// The board it was built from is kept in  window.lastSailSolution  (for a solution page).
//
// -------------------------------------------------------------------------
// THE WORD LISTS ARE PLAIN TEXT FILES. You never edit this script to add a word.
//
//   sailing-terms.txt        sailing terms; a word here scores x5
//   sailing-dictionary.txt   every valid word (sailing terms + small words
//                            like "the", "and", "aboard")
//
// Both files live in the SAME FOLDER AS THIS SCRIPT (sailgen.js), wherever that is.
//
// One word per line, letters a-z only. Capitals are fine. Blank lines are ignored,
// and a line starting with # is a comment.
//
// To add a sailing term:  add it to sailing-terms.txt, and also to
// sailing-dictionary.txt (that file is the list of words players may type).
// To add an ordinary valid word:  add it to sailing-dictionary.txt only.
// If you forget the dictionary, open the browser console: it lists the terms
// that are missing from sailing-dictionary.txt.
// -------------------------------------------------------------------------
// Because the lists are downloaded, the generator is ready a moment after the
// page loads. window.sailWordsReady is a promise that resolves when it is.
// =========================================================================
(function () {
  'use strict';

  // ---- settings ----
  // The text files are looked for next to this script, so they work from any folder or server.
  // (document.currentScript is this script's own address while it loads.)
  const BASE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src)
    ? document.currentScript.src.replace(/[^\/]*$/, '')
    : '/rollasail/js/';
  const TERMS_URL = BASE + 'sailing-terms.txt';
  const DICTIONARY_URL = BASE + 'sailing-dictionary.txt';
  const ALLOW_8_LETTER_TERMS = true;   // an 8-letter term makes the whole tray one word; set false to skip those
  const COLORS = ['red', 'blue'];
  const ROWS = 6, COLS = 8, TILES = 8;

  // ---- word lists (filled in when the text files arrive) ----
  const dictionary = new Set();   // every valid word (sailing terms + small words)
  const sailingSet = new Set();   // the sailing terms (score x5)
  const fillWords = [];           // words that can be placed on the board (2-8 letters)
  const startTerms = [];          // sailing terms that can start a tray
  let ready = false;
  let loadError = null;
  let lastTerm = '';

  // Scoring settings for RollaSail (read by rollawordbonus.js).
  // The Set is created now and filled later, so scripts that grab it early still see the terms.
  window.SAIL_TERMS = sailingSet;                      // lowercase sailing terms; a word in this set scores x5
  window.SAIL_TERM_MULTIPLIER = 5;

  // ---- reading the text files ----
  function parseWordList(text, source) {
    const words = [];
    text.replace(/^﻿/, '').split(/\r?\n/).forEach(function (line, i) {
      const raw = line.trim();
      if (!raw || raw.charAt(0) === '#') return;           // blank line or comment
      const w = raw.toLowerCase();
      if (!/^[a-z]+$/.test(w)) {
        console.warn('RollaSail: ' + source + ' line ' + (i + 1) + ' ignored (one word per line, letters a-z only): "' + raw + '"');
        return;
      }
      words.push(w);
    });
    return words;
  }

  function loadList(url) {
    return fetch(url, { cache: 'no-cache' })               // always check for a newer copy of the file
      .then(function (res) {
        if (!res.ok) throw new Error(url + ' (HTTP ' + res.status + ')');
        return res.text();
      })
      .then(function (text) { return parseWordList(text, url); });
  }

  window.sailWordsReady = Promise.all([loadList(TERMS_URL), loadList(DICTIONARY_URL)])
    .then(function (lists) {
      const terms = lists[0], words = lists[1];
      const inDictionaryFile = new Set(words);

      terms.forEach(function (t) { sailingSet.add(t); dictionary.add(t); });   // a term is always a valid word
      words.forEach(function (w) { dictionary.add(w); });

      dictionary.forEach(function (w) {
        if (w.length >= 2 && w.length <= TILES) fillWords.push(w);
      });
      sailingSet.forEach(function (t) {
        if (t.length >= 2 && t.length <= TILES && (ALLOW_8_LETTER_TERMS || t.length < TILES)) startTerms.push(t);
      });

      const notInDictionary = terms.filter(function (t) { return !inDictionaryFile.has(t); });
      if (notInDictionary.length) {
        console.warn('RollaSail: these sailing terms are in sailing-terms.txt but not in sailing-dictionary.txt. ' +
                     'Add them there too if players cannot type them: ' + notInDictionary.join(', '));
      }
      const tooLong = terms.filter(function (t) { return t.length > TILES; });
      if (tooLong.length) {
        console.warn('RollaSail: these terms are longer than ' + TILES + ' letters and can never fit the tray: ' + tooLong.join(', '));
      }
      ready = true;
    })
    .catch(function (err) {
      loadError = err;
      console.error('RollaSail: could not load the word lists: ' + err.message);
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

  // build a board around one sailing term, using exactly TILES tiles
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

  function generateSailPayload() {
    if (!ready) {
      throw new Error(loadError
        ? 'RollaSail: the word lists failed to load (' + loadError.message + ')'
        : 'RollaSail: the word lists are still loading, please try again in a moment');
    }
    for (let i = 0; i < 30; i++) {
      let term = pick(startTerms);
      if (term === lastTerm && startTerms.length > 1) term = pick(startTerms);   // avoid the same term twice in a row
      const board = buildBoard(term);
      if (!board) continue;
      lastTerm = term;
      const letters = board.grid.flat().filter(Boolean);
      window.lastSailSolution = {
        term: term.toUpperCase(),
        words: board.runs.map(r => ({
          word: r.word.toUpperCase(), dir: r.dir, row: r.row, col: r.col, sailing: sailingSet.has(r.word)
        })),
        rows: board.grid.map(row => row.map(ch => (ch ? ch.toUpperCase() : '.')).join(''))
      };
      // Same hooks RollaWord's generator uses, so "Show me the Solution" works in Free Play
      window.LAST_SOLUTION = window.lastSailSolution;
      if (typeof document !== 'undefined') {
        const oldBtn = document.getElementById('show-solution-btn');   // a new game removes the old button
        if (oldBtn) oldBtn.remove();
      }
      window.saveSailSolution(window.lastSailSolution);
      if (typeof saveSolutionForSolutionPage === 'function') saveSolutionForSolutionPage(window.lastSailSolution);
      return shuffle(letters).map(l => ({ l: l.toUpperCase(), c: pick(COLORS) }));
    }
    throw new Error('RollaSail: could not build a tray');
  }

  // The solution page (sailSolution.html) reads the saved solution from this key.
  window.saveSailSolution = function (solution) {
    try { localStorage.setItem('rollasail.solution', JSON.stringify(solution)); } catch (e) { /* storage blocked: the solution page just shows a message */ }
  };

  window.generateSailPayload = generateSailPayload;
})();