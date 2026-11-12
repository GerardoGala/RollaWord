const wordInput = document.getElementById('word-input');
const grid = document.getElementById('grid');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const defineBtn = document.getElementById('define-btn');
const definitionEl = document.getElementById('definition');

// ⚙️ GLOBAL THEME & ANIMATION CONFIGURATIONS (Tweak these values!)
const MAX_SYNONYMS = 9;            // 9 = a full 3 x 3 block under the text box
const ANIMATION_DURATION = '0.5s'; // How long the flight lasts (Must include 's' for seconds)
const STAGGER_DELAY = 35;          // Milliseconds between each button launch ripple
const START_DELAY = 20;            // Initial baseline delay before movement starts (in ms)

// 🧭 HISTORY: every word you search or tap, in order, with a pointer to where you are now
let history = [];
let historyIndex = -1;
let requestId = 0; // lets us ignore slow replies that arrive after a newer search

wordInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && this.value.trim() !== '') {
        fetchSynonyms(this.value.trim());
    }
});

prevBtn.addEventListener('click', function () {
    if (historyIndex > 0) {
        historyIndex--;
        showHistoryWord();
    }
});

nextBtn.addEventListener('click', function () {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        showHistoryWord();
    }
});

// Show the word at the current history position (does not add a new history entry)
function showHistoryWord() {
    var word = history[historyIndex];
    wordInput.value = word;
    updateNavButtons();
    fetchSynonyms(word, false);
}

function updateNavButtons() {
    prevBtn.disabled = historyIndex <= 0;
    nextBtn.disabled = historyIndex >= history.length - 1;
}

function addToHistory(word) {
    // A new word always goes to the end (bottom) of the stack and nothing is thrown away,
    // unless it is the same word that is already last
    if (history[history.length - 1] !== word) {
        history.push(word);
    }
    historyIndex = history.length - 1;
    updateNavButtons();
}

function fetchSynonyms(word, record) {
    if (record !== false) {
        addToHistory(word);
    }

    clearCanvas();
    definitionEl.hidden = true; // the old definition belongs to the previous word
    var thisRequest = ++requestId;

    // Safe Base64 string for: "https://api.datamuse.com/words?rel_syn="
    var securePath = atob("aHR0cHM6Ly9hcGkuZGF0YW11c2UuY29tL3dvcmRzP3JlbF9zeW49");
    var apiUrl = securePath + encodeURIComponent(word);

    fetch(apiUrl)
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (thisRequest !== requestId) {
                return; // a newer search has started; drop this result
            }

            // Keep only single-word synonyms (skip anything containing a space)
            var allSynonyms = data
                .map(function (item) { return item.word; })
                .filter(function (w) { return w.indexOf(' ') === -1; });

            if (allSynonyms.length === 0) {
                alert("No synonyms found for that word. Try another!");
                return;
            }

            generateGrid(allSynonyms.slice(0, MAX_SYNONYMS));
        })
        .catch(function (err) { console.error("Error fetching data:", err); });
}

function generateGrid(synonyms) {
    defineBtn.disabled = false; // there is now a center word with synonyms, so it can be defined
    // PASS 1: drop the buttons into the grid so the browser lays them out in their cells
    const buttons = synonyms.map(function (synonym) {
        var synButton = document.createElement('button');
        synButton.className = 'syn';
        synButton.innerText = synonym;

        synButton.addEventListener('click', function () {
            wordInput.value = synonym;
            fetchSynonyms(synonym);
        });

        grid.appendChild(synButton);
        return synButton;
    });

    // PASS 2: slide each button out from the text box into its cell.
    // Each button starts shrunk and shifted onto the text box, then animates back to (0, 0).
    const inputRect = wordInput.getBoundingClientRect();
    const inputX = inputRect.left + inputRect.width / 2;
    const inputY = inputRect.top + inputRect.height / 2;

    buttons.forEach(function (synButton) {
        const r = synButton.getBoundingClientRect();
        const dx = inputX - (r.left + r.width / 2);
        const dy = inputY - (r.top + r.height / 2);

        synButton.style.transition = 'none';
        synButton.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(0)';
        synButton.style.opacity = '0';
    });

    grid.offsetWidth; // force a reflow so the starting position is applied before animating

    buttons.forEach(function (synButton, index) {
        setTimeout(function () {
            synButton.style.transition =
                'transform ' + ANIMATION_DURATION + ' cubic-bezier(0.25, 1, 0.5, 1), ' +
                'opacity ' + ANIMATION_DURATION + ' ease-out';
            synButton.style.transform = 'translate(0, 0) scale(1)';
            synButton.style.opacity = '1';
        }, START_DELAY + (index * STAGGER_DELAY));
    });
}

function clearCanvas() {
    document.querySelectorAll('.syn').forEach(function (button) {
        button.remove();
    });
}

// -----------------------------------------------------------------------
// Tap "Define" to learn what the center word means (freedictionaryapi.com,
// which serves English Wiktionary data). One word at a time, only when the
// player asks. The game itself never depends on it.
// -----------------------------------------------------------------------
const DEFINITION_URL = "https://freedictionaryapi.com/api/v1/entries/en/";
const definitionCache = new Map();
let latestDefinitionRequest = 0;

defineBtn.addEventListener('click', function () {
    // Define whatever is in the text box right now (the center word)
    lookUpWord(wordInput.value.trim());
});

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

async function lookUpWord(word) {
    if (!word) {
        showDefinition("", ["Type a word first, then tap Define."], true);
        return;
    }

    const key = word.toLowerCase();
    if (definitionCache.has(key)) {
        const c = definitionCache.get(key);
        showDefinition(word, c.lines, c.problem, c.sourceUrl);
        return;
    }

    const requestNumber = ++latestDefinitionRequest;
    showDefinition(word, ["Looking up the meaning..."], false);

    const result = await fetchDefinition(word);
    let lines, problem = true, sourceUrl = null;

    if (result.lines) {
        lines = result.lines; problem = false; sourceUrl = result.sourceUrl;
        definitionCache.set(key, { lines: lines, problem: false, sourceUrl: sourceUrl });
    } else if (result.notFound) {
        lines = ["No definition found for this word. It may be too rare or too specialized for a general dictionary."];
        definitionCache.set(key, { lines: lines, problem: true, sourceUrl: null });
    } else if (result.status === 429) {
        lines = ["The dictionary is busy right now. Please wait a little and tap Define again."];
    } else {
        lines = ["Couldn't reach the dictionary right now. Check your connection and tap Define again."];
    }
    if (requestNumber === latestDefinitionRequest) showDefinition(word, lines, problem, sourceUrl); // ignore stale replies
}
