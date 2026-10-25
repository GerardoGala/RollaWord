// =========================================================================
// ROLLAWORD DISPLAY & CASCADING RULE ENGINE
// Handles scoring outputs and Invalid Contamination Cascading logic
// =========================================================================

/**
 * Applies the Invalid Contamination Cascading rules to all discovered words.
 * If a word is invalid, all its tiles are contaminated, causing any crossing
 * or intersecting words to also become invalid.
 */
function applyInvalidContaminationCascading(words) {
  const contaminatedTileIds = new Set();
  let contaminationExpanded = true;

  // --- STEP 1: Seed contamination from initial dictionary-invalid words ---
  words.forEach(wordObj => {
    if (!wordObj.isValid) {
      wordObj.tiles.forEach(tile => {
        contaminatedTileIds.add(tile.id);
      });
    }
  });

  // --- STEP 2: Run cascading contamination loop until state stabilizes ---
  while (contaminationExpanded) {
    contaminationExpanded = false;

    words.forEach(wordObj => {
      // If a word is currently marked valid but uses a contaminated tile...
      if (wordObj.isValid) {
        const hasContaminatedTile = wordObj.tiles.some(tile => contaminatedTileIds.has(tile.id));

        if (hasContaminatedTile) {
          // Trigger Invalid Contamination Cascading on this word
          wordObj.isValid = false;
          wordObj.score = 0;
          wordObj.baseScore = 0;
          wordObj.multiplier = 1;

          // Contaminate all other letters in this newly broken word
          wordObj.tiles.forEach(tile => {
            if (!contaminatedTileIds.has(tile.id)) {
              contaminatedTileIds.add(tile.id);
              contaminationExpanded = true; // Loop again to catch new intersections
            }
          });
        }
      }
    });
  }
}

/**
 * Displays valid and invalid word scores in the sidebar panel
 * and draws corresponding visual lines on the game board.
 */
function displayWordScores(words, scoreArea) {
  let grandBaseTotal = 0;
  const validDiceIds = new Set();

  // Execute the cascading rule engine before rendering any scores
  applyInvalidContaminationCascading(words);

  words.forEach(wordObj => {
    if (!wordObj.isValid) {
      const invalidDiv = document.createElement("div");
      invalidDiv.style.color = "var(--text-muted, #a1a1aa)";
      invalidDiv.style.textDecoration = "line-through";
      invalidDiv.textContent = `${wordObj.text} = 0 (invalid)`;
      scoreArea.appendChild(invalidDiv);

      // Draw a black visual line on the board across the invalid word
      if (typeof drawVisualStrikethrough === "function") {
        drawVisualStrikethrough(wordObj.tiles, "black", 1);
      }
      return;
    }

    wordObj.tiles.forEach(tile => {
      validDiceIds.add(tile.id);
    });

    grandBaseTotal += wordObj.score;

    if (wordObj.multiplier > 1 && typeof drawVisualStrikethrough === "function") {
      drawVisualStrikethrough(
        wordObj.tiles,
        wordObj.tiles[0].color.toLowerCase(),
        wordObj.multiplier
      );
    }

    const lineDiv = document.createElement("div");
    if (wordObj.multiplier > 1) {
      lineDiv.textContent =
        `${wordObj.text} = ${wordObj.baseScore} x ${wordObj.multiplier} = ${wordObj.score}`;
    } else {
      lineDiv.textContent = `${wordObj.text} = ${wordObj.baseScore}`;
    }

    scoreArea.appendChild(lineDiv);
  });

  return {
    grandBaseTotal,
    validDiceIds
  };
}
