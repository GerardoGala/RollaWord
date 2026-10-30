// =========================================================================
// ROLLAWORD BONUS AND CALCULATION ENGINE
// Fully autonomous, zero global flags, self-contained context evaluation
// =========================================================================

// =========================================================================
// 1. SCORE A PARTICULAR ASSIGNMENT OF BLANK LETTERS
// =========================================================================
function scoreAssignment(rawWords, assignments) {
  const words = rawWords.map(wordObj => {
    const letters = wordObj.tiles.map(tile => {
      if (tile.isBlank) {
        return assignments.get(tile.id) || "A";
      }
      return tile.letter;
    });

    const text = letters.join("").toLowerCase();
    const isValid = LOCAL_DICTIONARY.has(text);

    const baseScore = wordObj.tiles.reduce(
      (total, tile) => total + (tile.isBlank ? 0 : tile.score),
      0
    );

    const firstColor = wordObj.tiles[0]?.color || "";

    const sameColor = wordObj.tiles.every(
      tile => tile.color === firstColor
    );

    const activeMultipliers = window.COLOR_MULTIPLIERS || { "BLUE": 2, "RED": 3 };

    const colorMultiplier = sameColor
      ? (activeMultipliers[firstColor] || 1)
      : 1;

    // RollaSail: a sailing term scores x5 whatever its colors; a one-color sailing
    // term earns its color bonus as well (multiplied together).
    // window.SAIL_TERMS only exists on sail.html, so RollaWord is unaffected.
    const isSailingTerm = !!(window.SAIL_TERMS && window.SAIL_TERMS.has(text));
    const multiplier = colorMultiplier * (isSailingTerm ? (window.SAIL_TERM_MULTIPLIER || 5) : 1);

    return {
      ...wordObj,
      text,
      isValid,
      isDisqualified: false,
      baseScore,
      multiplier,
      colorMultiplier,
      sailMultiplier: isSailingTerm ? (window.SAIL_TERM_MULTIPLIER || 5) : 1,
      isSailingTerm,
      score: 0
    };
  });

  // IDENTIFY ALL TILES THAT BELONG TO INVALID WORDS
  const disqualifiedDiceIds = new Set();
  words.forEach(word => {
    if (!word.isValid) {
      word.tiles.forEach(tile => {
        disqualifiedDiceIds.add(tile.id);
      });
    }
  });

  // DISQUALIFY VALID WORDS THAT SHARE TILES WITH INVALID WORDS
  words.forEach(word => {
    const sharesInvalidTile = word.tiles.some(
      tile => disqualifiedDiceIds.has(tile.id)
    );
    word.isDisqualified = word.isValid && sharesInvalidTile;
  });

  // SCORE ONLY VALID, NON-DISQUALIFIED WORDS
  words.forEach(word => {
    if (word.isValid && !word.isDisqualified) {
      word.score = word.baseScore * word.multiplier;
    } else {
      word.score = 0;
    }
  });

  // CALCULATE TOTAL FROM ELIGIBLE WORDS ONLY
  const total = words.reduce((sum, word) => sum + word.score, 0);

  return {
    words,
    total,
    assignments: new Map(assignments)
  };
}

// =========================================================================
// 2. FIND THE HIGHEST-SCORING BLANK-TILE ASSIGNMENT
// =========================================================================
function calculateBestWordScores(rawWords, blankTiles) {
  let bestResult = null;
  const assignments = new Map();

  function searchBlankAssignments(index) {
    if (index >= blankTiles.length) {
      const result = scoreAssignment(rawWords, assignments);
      if (!bestResult || result.total > bestResult.total) {
        bestResult = result;
      }
      return;
    }

    const blank = blankTiles[index];
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (const letter of alphabet) {
      assignments.set(blank.id, letter);
      searchBlankAssignments(index + 1);
    }

    assignments.delete(blank.id);
  }

  searchBlankAssignments(0);

  if (!bestResult) {
    bestResult = scoreAssignment(rawWords, new Map());
  }

  return bestResult;
}

// =========================================================================
// 3. APPLY JACKPOT AND SCORE DISPLAY
// =========================================================================
function applyScoreBonuses(
  bestResult,
  totalDicePlaced,
  validDiceIds,
  grandBaseTotal,
  timeBonus,
  scoreArea
) {
  // 1. DISPLAY THE SUBTOTAL BLOCK WITH A TOP DASHED LINE
  const subtotalDiv = document.createElement("div");
  subtotalDiv.style.fontWeight = "800";
  subtotalDiv.style.marginTop = "10px";
  subtotalDiv.style.paddingTop = "6px";
  subtotalDiv.style.borderTop = "1px dashed var(--text-color, #17181E)";
  subtotalDiv.textContent = `SUBTOTAL = ${grandBaseTotal}`;
  scoreArea.appendChild(subtotalDiv);

  let finalScore = grandBaseTotal;

  // 🛡️ LOCAL ARCHITECTURAL RESET: Evaluate game profile by reading current browser path context
  const isKidsModeFile = window.location.pathname.includes("rollaKid.html");

  // JACKPOT CONDITIONAL: ALL EIGHT PLAYABLE DICE MUST SCORE
  const triggeredJackpot =
    totalDicePlaced === 8 &&
    validDiceIds.size === 8;

  if (triggeredJackpot) {
    let jackpotMultiplier = 1;
    
    if (isKidsModeFile) {
      jackpotMultiplier = 2; // Hardlocked flat reward for kids' environment
    } else {
      jackpotMultiplier = timeBonus > 1 ? timeBonus : 1; // Dynamic clock evaluation for adults
    }
    
    finalScore *= jackpotMultiplier;

    // 2. DISPLAY THE CLEAN 8-DICE REWARD LINE IF TRIGGERED
    if (jackpotMultiplier > 1) {
      const jackpotDiv = document.createElement("div");
      jackpotDiv.textContent = `8 dice reward = x${jackpotMultiplier}`;
      scoreArea.appendChild(jackpotDiv);
    }
  }

  // 3. SEPARATOR LINE BEFORE THE GRAND TOTAL
  const middleLine = document.createElement("div");
  middleLine.style.marginTop = "6px";
  middleLine.style.paddingTop = "6px";
  middleLine.style.borderTop = "1px dashed var(--text-color, #17181E)";
  scoreArea.appendChild(middleLine);

  // 4. DISPLAY THE GRAND TOTAL
  const finalDiv = document.createElement("div");
  finalDiv.classList.add("total-line");
  finalDiv.style.fontWeight = "800";
  finalDiv.textContent = `GRAND TOTAL = ${finalScore}`;
  scoreArea.appendChild(finalDiv);
  
  scoreArea.style.textAlign = "right";

  window.finalScore = finalScore;
}
