// =========================================================================
// ROLLAWORD MOAT RULE
// All placed dice must form one connected island.
// The last row is excluded because it contains unused dice.
// Horizontal and vertical connections count; diagonal connections do not.
// =========================================================================

function hasSingleIsland(boardMatrix) {
  // -------------------------------------------------------------------------
  // KID MODE BYPASS: If calling from rollaKid.html, skip the island check.
  // -------------------------------------------------------------------------
  if (window.location.pathname.toLowerCase().endsWith('rollakid.html')) {
    console.log("rollaKid.html detected: Island check aborted.");
    return true; 
  }

  const visited = new Set();
  let islandCount = 0;

  // Exclude the last row (unused dice).
  const playableRows = GRID_ROWS - 1;

  for (let r = 0; r < playableRows; r++) {
    for (let c = 0; c < GRID_COLS; c++) {

      if (!boardMatrix[r][c] || visited.has(`${r},${c}`)) {
        continue;
      }

      islandCount++;

      // More than one island means the board is invalid.
      if (islandCount > 1) {
        return false;
      }

      const stack = [[r, c]];

      while (stack.length > 0) {
        const [row, col] = stack.pop();
        const key = `${row},${col}`;

        if (visited.has(key)) {
          continue;
        }

        visited.add(key);

        const neighbors = [
          [row - 1, col],
          [row + 1, col],
          [row, col - 1],
          [row, col + 1]
        ];

        for (const [nr, nc] of neighbors) {
          if (
            nr >= 0 &&
            nr < playableRows &&
            nc >= 0 &&
            nc < GRID_COLS &&
            boardMatrix[nr][nc] &&
            !visited.has(`${nr},${nc}`)
          ) {
            stack.push([nr, nc]);
          }
        }
      }
    }
  }

  // Returns true if there is exactly 1 island, or if the board is empty.
  // (If an empty board should be treated as an invalid submission, change this to: return islandCount === 1;)
  return true; 
}
