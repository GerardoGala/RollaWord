// =========================================================================
// ROLLASAIL - BROWSER-SIDE TRAY GENERATOR (used by FREE PLAY on sail.html)
//
// Load this file BEFORE rollaword.js:   <script src="js/sailgen.js"></script>
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
// The word lists are embedded below, so nothing has to be fetched and the
// generator can answer instantly (Free Play calls it synchronously).
// =========================================================================
(function () {
  'use strict';

  const ROWS = 6, COLS = 8, TILES = 8;
  const ALLOW_8_LETTER_TERMS = true;   // an 8-letter term makes the whole tray one word; set false to skip those
  const COLORS = ['red', 'blue'];

  const WORDS = ["a", "aboard", "about", "above", "abreast", "across", "adrift", "aft", "after", "against", "aground", "ahead", "aloft", "along", "although", "amid", "amidst", "among", "an", "and", "around", "as", "astern", "at", "atop", "balance", "beach", "beam", "bear", "bearing", "beat", "beating", "because", "before", "behind", "belly", "below", "beneath", "beside", "between", "beyond", "bilge", "block", "board", "boat", "boom", "bow", "bowline", "breeze", "bridge", "bulkhead", "buoy", "but", "by", "cabin", "capsize", "chart", "chock", "cleat", "clew", "cockpit", "coil", "course", "crew", "current", "deck", "dinghy", "dock", "dolly", "down", "downhaul", "downwind", "draft", "drag", "draught", "during", "ease", "except", "fathom", "fender", "flood", "foil", "for", "force", "forepeak", "forward", "fouled", "from", "galley", "gangway", "gear", "genoa", "gunwale", "gust", "gybe", "gybing", "hatch", "heading", "heads", "headway", "heel", "helm", "hike", "hiking", "how", "hull", "if", "in", "inboard", "inside", "into", "jenny", "jetty", "jibe", "jibing", "keel", "knot", "landing", "latitude", "launch", "lee", "leech", "leeward", "leeway", "lest", "lift", "like", "line", "log", "luff", "luffing", "lull", "mainsail", "mark", "mast", "midship", "mooring", "near", "nor", "of", "off", "on", "once", "onto", "or", "out", "outboard", "outhaul", "outside", "over", "past", "pearling", "per", "pier", "pilotage", "planing", "port", "reach", "reaching", "recovery", "regatta", "rigging", "rudder", "safety", "sail", "sailboat", "sailing", "sailor", "scuppers", "secure", "set", "sheet", "shift", "shore", "since", "slack", "so", "sounding", "spar", "speed", "squall", "steer", "steering", "stem", "stern", "sternway", "stow", "tack", "tacking", "telltale", "than", "that", "the", "though", "through", "till", "tiller", "to", "topsides", "toward", "towards", "transom", "traveler", "trim", "trimming", "turtle", "twist", "under", "underway", "unless", "until", "up", "upon", "upwind", "vang", "via", "wake", "watch", "water", "wave", "way", "when", "whenever", "where", "whereas", "wherever", "whether", "while", "wind", "windward", "with", "within", "without", "yet"];   // every valid word (sailing terms + prepositions, articles, conjunctions)
  const TERMS = ["aboard", "abreast", "adrift", "aft", "aground", "ahead", "aloft", "astern", "beam", "bearing", "beat", "beating", "below", "bilge", "block", "boat", "boom", "bow", "bowline", "bridge", "bulkhead", "buoy", "cabin", "capsize", "chart", "chock", "cleat", "clew", "cockpit", "coil", "course", "crew", "current", "deck", "dinghy", "dock", "dolly", "downhaul", "downwind", "draft", "draught", "fathom", "fender", "flood", "foil", "forepeak", "forward", "fouled", "galley", "gangway", "gear", "genoa", "gunwale", "gust", "gybe", "gybing", "hatch", "heading", "heads", "headway", "heel", "helm", "hike", "hiking", "hull", "inboard", "jenny", "jetty", "jibe", "jibing", "keel", "knot", "landing", "latitude", "launch", "lee", "leech", "leeward", "leeway", "line", "log", "luff", "luffing", "lull", "mainsail", "mast", "midship", "mooring", "outboard", "outhaul", "pearling", "pier", "pilotage", "planing", "port", "reach", "reaching", "regatta", "rigging", "rudder", "sail", "sailboat", "sailing", "sailor", "scuppers", "secure", "set", "sheet", "slack", "sounding", "spar", "squall", "stem", "stern", "sternway", "stow", "tack", "tacking", "telltale", "tiller", "topsides", "transom", "traveler", "trim", "trimming", "turtle", "underway", "upwind", "vang", "wake", "watch", "way", "wind", "windward"];   // the sailing terms

  const dictionary = new Set(WORDS);
  const sailingSet = new Set(TERMS);
  const fillWords = WORDS.filter(w => w.length >= 2 && w.length <= TILES);
  const startTerms = TERMS.filter(w => ALLOW_8_LETTER_TERMS || w.length < TILES);
  let lastTerm = '';

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
      if (typeof saveSolutionForSolutionPage === 'function') saveSolutionForSolutionPage(window.lastSailSolution);
      return shuffle(letters).map(l => ({ l: l.toUpperCase(), c: pick(COLORS) }));
    }
    throw new Error('RollaSail: could not build a tray');
  }

  window.generateSailPayload = generateSailPayload;

  // Scoring settings for RollaSail (read by rollawordbonus.js)
  window.SAIL_TERMS = sailingSet;                      // lowercase sailing terms; a word in this set scores x5
  window.SAIL_TERM_MULTIPLIER = 5;
  window.COLOR_MULTIPLIERS = { RED: 2, BLUE: 3 };      // RollaSail: all-red word x2, all-blue word x3
})();
