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
  // RollaCity (any page whose address contains "city"): tapping a name opens the labelled map instead of a dictionary entry.
  const IS_CITY = /city/i.test(window.location.pathname);

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
    document.getElementById("credit").hidden = IS_CITY || found.length === 0;   // dictionary credit: not used by RollaCity
    if (IS_CITY) { const h = document.querySelector("#word-section .hint"); if (h) h.textContent = "Tap a name to see it on the map."; }
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

  // "plural of oxymel", "past tense of go", ... are no help to a learner on their own.
  // Spot those and return the base word(s) so we can also show what THEY mean.
  const FORM_OF = /^(?:(?:the\s+)?(?:plural|simple past(?: tense)?(?: and past participle)?|past tense|past participle|present participle|gerund|third[- ]person singular(?: simple present(?: indicative)?)?|comparative(?: form)?|superlative(?: form)?|alternative (?:form|spelling)|obsolete (?:form|spelling)|misspelling|eye dialect|(?:\w+ )?form) of)\s+([A-Za-z][A-Za-z'-]*)/i;

  function baseWordsOf(data, word) {
    const bases = [];
    ((data && data.entries) || []).forEach(function (entry) {
      (entry.senses || []).slice(0, 2).forEach(function (sense) {
        const m = sense && sense.definition && FORM_OF.exec(sense.definition.trim());
        if (!m) return;
        const base = m[1].toLowerCase().replace(/[.,;:]+$/, "");
        if (base !== word.toLowerCase() && !bases.includes(base)) bases.push(base);
      });
    });
    return bases.slice(0, 2);
  }

  async function fetchRaw(word) {
    const response = await fetch(DEFINITION_URL + encodeURIComponent(word.toLowerCase()));
    if (response.status === 404) return { notFound: true };
    if (!response.ok) return { status: response.status };
    return { data: await response.json() };
  }

  // Returns { lines, sourceUrl } when found, or { notFound: true } / { status } / { failed: true }.
  // If the word is only a form of another word (plural, past tense...), the base word's
  // meaning is looked up too and appended. If that second lookup fails, the first answer stands.
  async function fetchDefinition(word) {
    try {
      const raw = await fetchRaw(word);
      if (!raw.data) return raw;
      const lines = summarize(raw.data);
      if (!lines.length) return { notFound: true };

      for (const base of baseWordsOf(raw.data, word)) {
        try {
          const baseRaw = await fetchRaw(base);
          if (!baseRaw.data) continue;
          // skip lines that are themselves just "plural of ..." and keep the real meanings
          const baseLines = summarize(baseRaw.data).filter(l => !FORM_OF.test(l.replace(/^.*?:\s*/, ""))).slice(0, 2);
          baseLines.forEach(l => lines.push(base + " \u2192 " + l));
        } catch (e) {
          console.warn("Base-word lookup failed for " + base + ":", e);
        }
      }
      return { lines: lines, sourceUrl: raw.data.source && raw.data.source.url };
    } catch (e) {
      console.warn("Dictionary lookup failed for " + word + ":", e);
      return { failed: true };
    }
  }

  // -----------------------------------------------------------------------
  // RollaCity: the word list is js/city-data.csv (the same file the game and the
  // How To Play page use). A tap shows what the name is and opens clue.html in
  // "names" mode: a map with the country, its capital and its neighbours labelled.
  // -----------------------------------------------------------------------
  function parseCsv(text) {
    const out = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.length > 1 || row[0] !== "") out.push(row); row = []; }
      else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); out.push(row); }
    return out;
  }
  let cityRowsPromise = null;
  function loadCityRows() {
    if (!cityRowsPromise) {
      cityRowsPromise = fetch("js/city-data.csv").then(function (r) { if (!r.ok) throw new Error("csv"); return r.text(); })
        .then(function (t) { const rows = parseCsv(t), h = rows.shift(); return { rows: rows, ix: function (n) { return h.indexOf(n); } }; });
    }
    return cityRowsPromise;
  }
  function cityMatch(data, word) {
    const iC = data.ix("Type for country"), iK = data.ix("Type for capital(s)"), iA = data.ix("Also accepted");
    for (const r of data.rows) {
      if (r[iC] === word) return { row: r, kind: "country" };
      const n = (r[iK] || "").split("; ").indexOf(word);
      if (n >= 0) return { row: r, kind: "capital", n: n };
      if ((r[iA] || "").split("; ").indexOf(word) >= 0) return { row: r, kind: "alternate" };
    }
    return null;
  }

  function openCityMap(word, pos) {
    let modal = document.getElementById("city-map-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "city-map-modal";
      modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "Map");
      modal.style.cssText = "display:none;position:fixed;top:0;right:0;bottom:0;left:0;z-index:10000;background:rgba(0,0,0,.55);align-items:center;justify-content:center;";
      const f = document.createElement("iframe");
      f.id = "city-map-frame"; f.title = "Map";
      f.style.cssText = "border:0;background:#fff;width:100%;max-width:480px;height:100%;max-height:760px;";
      modal.appendChild(f);
      document.body.appendChild(modal);
      modal.addEventListener("click", function (e) { if (e.target === modal) closeCityMap(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCityMap(); });
      window.addEventListener("message", function (e) { if (e.origin === window.location.origin && e.data === "rollacity-close-clue") closeCityMap(); });
    }
    // the position and names travel too, so the map is right even if the word cannot be looked up again over there
    let q = "clue.html?names=1&w=" + encodeURIComponent(word);
    if (pos) q += "&lat=" + encodeURIComponent(pos.lat) + "&lon=" + encodeURIComponent(pos.lon) +
                  "&country=" + encodeURIComponent(pos.country) + "&capital=" + encodeURIComponent(pos.capital);
    document.getElementById("city-map-frame").src = q + "&_=" + Date.now();      // fresh copy, never a cached one
    modal.style.display = "flex";
  }
  function closeCityMap() {
    const modal = document.getElementById("city-map-modal");
    if (!modal) return;
    modal.style.display = "none";
    document.getElementById("city-map-frame").src = "about:blank";
  }

  async function lookUpCity(word, button) {
    wordsEl.querySelectorAll("button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    let m = null;
    try { m = cityMatch(await loadCityRows(), word); }
    catch (e) { showDefinition(word, ["Couldn't load the word list. Check your connection and tap the name again."], true); return; }
    if (!m) { showDefinition(word, ["This name is not in the RollaCity list."], true); return; }

    const data = await loadCityRows();
    const col = n => m.row[data.ix(n)] || "";
    const country = col("Country"), caps = col("Capital(s)").split("; ");
    const lines = [];
    if (m.kind === "country") lines.push("Country. Its capital is " + caps.join(" and ") + ".");
    else if (m.kind === "capital") lines.push("Capital of " + country + ".");
    else lines.push("Another name for a country or capital: " + country + (caps.length ? ", capital " + caps.join(" and ") : "") + ".");
    if (col("Note")) lines.push(col("Note"));
    showDefinition(word, lines, false);

    const n = m.kind === "capital" ? m.n : 0;
    const pos = {
      lat: (col("Latitude(s)").split("; ")[n] || "").trim(), lon: (col("Longitude(s)").split("; ")[n] || "").trim(),
      country: country.replace(/\s*\(.*$/, ""), capital: caps[n] || caps[0] || ""
    };
    const again = document.createElement("button");
    again.type = "button"; again.textContent = "Show on map";
    again.style.cssText = "margin-top:10px;padding:8px 16px;font:inherit;font-weight:700;color:#fff;background:#006abc;border:0;cursor:pointer;";
    again.addEventListener("click", function () { openCityMap(word, pos); });
    definitionEl.appendChild(again);
    openCityMap(word, pos);
  }

  async function lookUpWord(word, button) {
    if (IS_CITY) return lookUpCity(word, button);
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