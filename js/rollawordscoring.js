// =========================================================================
// ROLLAWORD SCORING ENGINE
// Board analysis, word discovery, and score display
// =========================================================================

async function processEndgameScoring(timeBonus = 0) {
  const gridContainer = document.getElementById("game-board");
  await dictionaryLoadingPromise;

  if (!dictionaryReady) {
    console.error(
      "Scoring cancelled: dictionary is unavailable.",
      dictionaryError
    );
    return;
  }

  // Disable further dice movement.
  document.querySelectorAll(".die").forEach(die => {
    die.draggable = false;
  });

  gridContainer.querySelectorAll(".grid-cell").forEach(cell => {
    cell.classList.remove("drag-over");
  });

  const scoreArea = document.getElementById("score-output-area");
  scoreArea.innerHTML = "<div>Checking words...</div>";

  const playableRows = 6;

  // BUILD THE COMPLETE BOARD.
  const boardMatrix = Array.from(
    { length: playableRows },
    () => Array(GRID_COLS).fill(null)
  );

  let totalDicePlaced = 0;

  document.querySelectorAll(".grid-cell").forEach(cell => {
    const row = Number.parseInt(cell.dataset.row, 10);
    const col = Number.parseInt(cell.dataset.col, 10);
    const die = cell.querySelector(".die");

    if (
      !die ||
      row < 0 ||
      row >= playableRows ||
      col < 0 ||
      col >= GRID_COLS
    ) {
      return;
    }

    const originalLetter = (die.dataset.letter || "").toUpperCase();
    const isBlank = originalLetter === "*";
    if (!boardMatrix[row]) {
      console.error("Row outside boardMatrix:", {
        row,
        col,
        GRID_ROWS,
        GRID_COLS,
        boardMatrixRows: boardMatrix.length,
        cell: cell
      });
      return;
    }

    boardMatrix[row][col] = {
      id: die.id,
      letter: originalLetter,
      color: (die.dataset.color || "").toUpperCase(),
      score: isBlank ? 0 : (SCRABBLE_SCORE_MAP[originalLetter] || 0),
      isBlank,
      element: cell,
      dieElement: die
    };

    totalDicePlaced++;
  });

  // FIND HORIZONTAL WORDS IN PLAYABLE ROWS.
  const rawWords = [];

  for (let r = 0; r < playableRows; r++) {
    let run = [];

    for (let c = 0; c < GRID_COLS; c++) {
      if (boardMatrix[r][c]) {
        run.push({
          r,
          c,
          ...boardMatrix[r][c]
        });
      } else {
        if (run.length >= 2) {
          rawWords.push({
            tiles: run,
            direction: "horizontal"
          });
        }
        run = [];
      }
    }

    if (run.length >= 2) {
      rawWords.push({
        tiles: run,
        direction: "horizontal"
          });
        }
  }

  // FIND VERTICAL WORDS IN PLAYABLE ROWS.
  for (let c = 0; c < GRID_COLS; c++) {
    let run = [];

    for (let r = 0; r < playableRows; r++) {
      if (boardMatrix[r][c]) {
        run.push({
          r,
          c,
          ...boardMatrix[r][c]
        });
      } else {
        if (run.length >= 2) {
          rawWords.push({
            tiles: run,
            direction: "vertical"
          });
        }
        run = [];
      }
    }

    if (run.length >= 2) {
      rawWords.push({
        tiles: run,
        direction: "vertical"
      });
    }
  }

  // IDENTIFY BLANK TILES.
  const blankTiles = [];
  const seenBlankIds = new Set();

  rawWords.forEach(word => {
    word.tiles.forEach(tile => {
      if (tile.isBlank && !seenBlankIds.has(tile.id)) {
        seenBlankIds.add(tile.id);
        blankTiles.push(tile);
      }
    });
  });

  // CHECK THE MOAT RULE BEFORE SCORING.
  if (!hasSingleIsland(boardMatrix)) {
    scoreArea.innerHTML = "";
    alert("Invalid game. Only one island is allowed.");
    return;
  }

  // CALCULATE THE BEST WORD SCORES.
  const bestResult = calculateBestWordScores(rawWords, blankTiles);

  // DISPLAY THE SELECTED LETTERS ON BLANK TILES.
  blankTiles.forEach(tile => {
    const chosenLetter = bestResult.assignments.get(tile.id) || "A";
    tile.dieElement.dataset.assignedLetter = chosenLetter;

    let letterSpan = tile.dieElement.querySelector("span");
    if (!letterSpan) {
      letterSpan = document.createElement("span");
      tile.dieElement.prepend(letterSpan);
    }
    letterSpan.textContent = chosenLetter;

    const valueBadge = tile.dieElement.querySelector(".die-value");
    if (valueBadge) {
      valueBadge.textContent = "0";
    }
  });

  // DISPLAY WORD SCORES (Calls the separate display module engine).
  gridContainer
    .querySelectorAll(".word-strike-line")
    .forEach(line => line.remove());

  scoreArea.innerHTML = "";

  const scoreTotals = displayWordScores(bestResult.words, scoreArea);

  // APPLY JACKPOT AND TIME BONUS.
  applyScoreBonuses(
    bestResult,
    totalDicePlaced,
    scoreTotals.validDiceIds,
    scoreTotals.grandBaseTotal,
    timeBonus,
    scoreArea
  );

  console.log("RollaWord scoring complete.");
  if (typeof window.showSolutionButton === 'function') window.showSolutionButton();
  if (window.isDailyChallengeMode && typeof window.processChallengeEndgame === 'function') {
    window.processChallengeEndgame(window.finalScore);
  }
}
