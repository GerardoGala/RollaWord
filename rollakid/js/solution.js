// =========================================================================
// ROLLAWORD SOLUTION PAGE
// Fills the grid in solution.html with the 8-dice solution of the last
// Free Play game. The game saves it under localStorage "rollaword.solution"
// (see saveSolutionForSolutionPage in rollaword-adult.js).
//
// Saved format: { rows: [6 strings of 8 chars], savedAt: <ms> }
//   A-Z = tile, a-z = blank standing for that letter, "." = empty cell
// =========================================================================

(function () {
  const STORAGE_KEY = "rollaword.solution";

  const gridEl = document.getElementById("solution-grid");
  const statusEl = document.getElementById("status");
  const wordsBox = document.getElementById("word-section");
  const wordsEl = document.getElementById("words");
  const legendEl = document.getElementById("legend");
  const backBtn = document.getElementById("back");

  function showStatus(text) {
    statusEl.textContent = text;
    statusEl.hidden = false;
  }

  function loadSolution() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.error("Solution page: cannot read localStorage:", e);
      return { error: "This browser is blocking saved data, so the solution can't be shown." };
    }
    if (!raw) {
      return { error: "No solution saved yet. Play a Free Play game first, then open this page again." };
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("Solution page: saved solution is not valid JSON:", raw);
      return { error: "The saved solution is damaged. Play a new Free Play game." };
    }
    const rows = data && data.rows;
    const ok = Array.isArray(rows) && rows.length > 0 &&
      rows.every(r => typeof r === "string" && r.length === rows[0].length && /^[A-Za-z.]+$/.test(r));
    if (!ok) {
      console.error("Solution page: unexpected saved format:", data);
      return { error: "The saved solution has an unexpected format. Play a new Free Play game." };
    }
    return { rows, savedAt: data.savedAt };
  }

  function drawGrid(rows) {
    const cols = rows[0].length;
    gridEl.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    gridEl.innerHTML = "";
    let hasBlank = false;

    rows.forEach(function (row) {
      for (const ch of row) {
        const cell = document.createElement("div");
        cell.className = "cell";
        if (ch !== ".") {
          const tile = document.createElement("div");
          tile.className = "tile";
          if (ch === ch.toLowerCase()) {
            tile.classList.add("blank");
            hasBlank = true;
          }
          tile.textContent = ch.toUpperCase();
          cell.appendChild(tile);
        }
        gridEl.appendChild(cell);
      }
    });
    legendEl.hidden = !hasBlank;
  }

  // Every run of 2+ tiles, across and down, is a word of the solution.
  function listWords(rows) {
    const grid = rows.map(r => r.toUpperCase());
    const found = [];
    const collect = line => line.split(".").forEach(run => { if (run.length >= 2) found.push(run); });
    grid.forEach(collect);
    for (let c = 0; c < grid[0].length; c++) collect(grid.map(r => r[c]).join(""));

    wordsEl.innerHTML = "";
    found.forEach(function (word) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = word;
      btn.addEventListener("click", function () { lookUpWord(word, btn); });
      li.appendChild(btn);
      wordsEl.appendChild(li);
    });
    wordsBox.hidden = found.length === 0;
    document.getElementById("credit").hidden = found.length === 0;   // data-source credit
  }

  // -----------------------------------------------------------------------
  // Tap a word to learn what it means (freedictionaryapi.com, which serves
  // English Wiktionary data). One word at a time, only when the player asks.
  // The game itself never depends on it.
  // -----------------------------------------------------------------------
  const DEFINITION_URL = "https://freedictionaryapi.com/api/v1/entries/en/";
  const definitionEl = document.getElementById("definition");
  const definitionCache = new Map();
  let latestRequest = 0;

  function showDefinition(word, lines, isProblem, sourceUrl) {
    definitionEl.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = word;
    definitionEl.appendChild(title);
    lines.forEach(function (text) {
      const p = document.createElement("p");
      p.textContent = text;
      definitionEl.appendChild(p);
    });
    if (sourceUrl && /^https:\/\//.test(sourceUrl)) {      // credit Wiktionary (CC BY-SA 4.0)
      const p = document.createElement("p");
      p.className = "source";
      const a = document.createElement("a");
      a.href = sourceUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Wiktionary";
      p.append("Source: ", a, " (CC BY-SA 4.0)");
      definitionEl.appendChild(p);
    }
    definitionEl.classList.toggle("problem", !!isProblem);
    definitionEl.hidden = false;
  }

  // Turns the API reply into a few short readable lines.
  function summarize(data) {
    const lines = [];
    const entries = (data && data.entries) || [];
    entries.forEach(function (entry) {
      if (lines.length >= 4) return;
      const pron = (entry.pronunciations || []).find(p => p && p.text);
      const senses = (entry.senses || []).filter(s => s && s.definition).slice(0, 2);
      senses.forEach(function (sense, i) {
        if (lines.length >= 4) return;
        const label = entry.partOfSpeech ? entry.partOfSpeech + ": " : "";
        const prefix = i === 0 && pron ? pron.text + "  " : "";
        lines.push(prefix + label + sense.definition);
      });
    });
    return lines;
  }

  // Returns { lines, sourceUrl } when found, or { notFound: true } / { status } / { failed: true }.
  async function fetchDefinition(word) {
    try {
      const response = await fetch(DEFINITION_URL + encodeURIComponent(word.toLowerCase()));
      if (response.status === 404) return { notFound: true };
      if (!response.ok) return { status: response.status };
      const data = await response.json();
      const lines = summarize(data);
      if (!lines.length) return { notFound: true };
      return { lines: lines, sourceUrl: data.source && data.source.url };
    } catch (e) {
      console.warn("Dictionary lookup failed for " + word + ":", e);
      return { failed: true };
    }
  }

  async function lookUpWord(word, button) {
    wordsEl.querySelectorAll("button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");

    if (definitionCache.has(word)) {
      const c = definitionCache.get(word);
      showDefinition(word, c.lines, c.problem, c.sourceUrl);
      return;
    }

    const requestId = ++latestRequest;
    showDefinition(word, ["Looking up the meaning..."], false);

    const result = await fetchDefinition(word);
    let lines, problem = true, sourceUrl = null;

    if (result.lines) {
      lines = result.lines; problem = false; sourceUrl = result.sourceUrl;
      definitionCache.set(word, { lines: lines, problem: false, sourceUrl: sourceUrl });
    } else if (result.notFound) {
      lines = ["No definition found for this word. It can still be a valid Scrabble word. Many valid words are too rare or too short for a general dictionary."];
      definitionCache.set(word, { lines: lines, problem: true, sourceUrl: null });
    } else if (result.status === 429) {
      lines = ["The dictionary is busy right now. Please wait a little and tap the word again."];
    } else {
      lines = ["Couldn't reach the dictionary right now. Check your connection and tap the word again."];
    }
    if (requestId === latestRequest) showDefinition(word, lines, problem, sourceUrl); // ignore stale replies
  }

  const result = loadSolution();
  if (result.error) {
    showStatus(result.error);
  } else {
    drawGrid(result.rows);
    listWords(result.rows);
    if (result.savedAt) {
      showStatus("From your last Free Play game, played at " +
        new Date(result.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".");
    }
  }

  // Back to Game: close this tab if the game opened it, otherwise go back.
  backBtn.addEventListener("click", function () {
    window.close();
    setTimeout(function () {
      if (document.referrer) location.href = document.referrer;
      else if (history.length > 1) history.back();
      else location.href = "rollaWord.html";
    }, 200);
  });
})();
