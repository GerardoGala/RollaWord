# RollaWord / RollaSail - Developer's Guide

Business rules and how the code implements them. Keep this file in the project
folder but OUT of the deployed site (anything deployed is public).

Last reviewed: 2026-11-03.
Status key: **[confirmed]** = read in the source; **[to confirm]** = inferred or not yet seen.

---

## 1. Two games, one engine

| | RollaWord | RollaSail |
|---|---|---|
| URL | `rollaword.com/` | `rollaword.com/rollasail/` |
| Page | `/index.html` | `/rollasail/index.html` |
| Word list | `js/small.txt` | `js/sailing-dictionary.txt` |
| Free Play rack | `window.generateLetterPayload()` (rollawordadult.js) | `window.generateSailPayload()` (sailgen.js) |
| Daily puzzle file | `/js/dailychallenge.json`, keys `YYYYMMDD` | `/js/sailchallenge.json`, keys `MMDD` (repeats yearly) |
| Extra scoring | none | sailing term = x5 |

Both pages load the same scripts. The only extra script on the sail page is
`sailgen.js`.

## 2. How the code knows which game is running

1. `rollaword.js`: `IS_SAIL = location.pathname.toLowerCase().includes('sail')`.
   Controls: Free Play generator, challenge file name, date-key format. **[confirmed]**
2. `rollaworddictionary.js`: its own inline copy of the same path test, to choose
   the word list. **[confirmed]**
3. `sailgen.js` (loaded only by the sail page) sets globals read by the scoring
   code: `window.SAIL_TERMS` (Set of lowercase terms), `window.SAIL_TERM_MULTIPLIER` (5).
   `rollawordbonus.js` applies x5 only if `SAIL_TERMS` exists and contains the word. **[confirmed]**
4. Kids mode: `rollaword.js` `isKidsMode = pathname.includes('id')` (loose test,
   see section 11); `rollawordisland.js` / `rollawordbonus.js` test for `rollaKid.html`. **[confirmed]**

Rule: never add a new game-specific check in yet another file. Prefer a global
set by the game's own page or generator (as in item 3).

## 3. Script load order (index.html, bottom of body)

1. `/js/sailgen.js` (sail page only)
2. `/js/rollawordbonus.js`
3. `/js/rollawordisland.js`
4. `/js/rollaworddisplay.js`
5. `/js/rollawordscoring.js`
6. `/js/rollaworddictionary.js` (starts loading the word list immediately)
7. `/js/rollawordadult.js` (defines `SCRABBLE_SCORE_MAP`, rack generator)
8. `/js/rollaword.js` (builds the grid, drag and drop, game engine)
9. `/js/rollawordleaderboard.js` (ES module, Firestore)

`sailgen.js` must stay before the others, because it sets scoring globals.

## 4. Business rules

### Board and tiles
- Board: 6 rows x 8 columns. Tray: 8 tiles in a separate row (`data-row="-1"`).
- A rack is always 8 tiles, each red or blue. A tile may be a blank (`*`, 0 points)
  in RollaWord. **[confirmed]**
- Letter values (Scrabble): `SCRABBLE_SCORE_MAP` in `rollawordadult.js`.
- Timer: 180 seconds (`INITIAL_TIME_SECONDS`). Kids mode has no timer.

### Words
- A word is any run of 2+ tiles, across or down (`rollawordscoring.js`).
- A word is valid if it is in `LOCAL_DICTIONARY` (the loaded word list).
- Blanks: the engine tries all 26 letters for every blank and keeps the assignment
  with the highest total (`calculateBestWordScores`). A blank scores 0 base points.

### Word score
```
word score = base score x colorMultiplier x sailMultiplier
base score       = sum of tile values (blanks count 0)
colorMultiplier  = all tiles one color ? (BLUE x2, RED x3) : x1
sailMultiplier   = RollaSail only, word is in SAIL_TERMS ? x5 : x1
```
- Blue x2 and red x3 are the SAME in both games (decided 2026-11-03).
  Defaults live in `rollaworddictionary.js` (`window.COLOR_MULTIPLIERS`) with a
  second fallback in `rollawordbonus.js`. Do NOT override them in `sailgen.js`.
- The x5 applies whatever the colors are; a one-color sailing term gets both.
- Example: all-red BOW = (3+1+4) x 3 x 5 = 120. All-blue BOW = 8 x 2 x 5 = 80.

### Invalid words (contamination)
- An invalid word scores 0 and gets a black strike line.
- Any VALID word that shares a tile with an invalid word is also scored 0.
- It does not chain further (a word that is only disqualified does not
  disqualify its own neighbours). Implemented in `rollaworddisplay.js`
  (`applyInvalidContaminationCascading`); `rollawordbonus.js` has a second copy
  of the same rule. Keep both identical.

### Moat rule
- All placed tiles must form ONE island (up/down/left/right, no diagonals).
  Otherwise the game is rejected with an alert and no score (`rollawordisland.js`).

### Totals and jackpot
- SUBTOTAL = sum of all valid word scores.
- 8-dice jackpot: all 8 tiles placed AND all 8 in valid, non-contaminated words.
  Then GRAND TOTAL = SUBTOTAL x seconds left on the clock (only if more than 1).
  Kids file: flat x2. (`applyScoreBonuses`, rollawordbonus.js)
- Final score is stored in `window.finalScore`.

## 5. Rack generation

**RollaWord Free Play** (`rollawordadult.js`): rolls a "starting group" by a
cascade of dice (hard letters Q/Z/J/X first, then K, F/H/V/W/Y, B/C/M/P, D/G),
builds a small valid crossword of 8 tiles around it, then hands those 8 tiles to
the player shuffled with random colors. Real Scrabble tile counts are respected
(`TILE_LIMITS`), max 2 blanks. Falls back to plain dice if no board can be built.

**RollaSail Free Play** (`sailgen.js`): picks a random sailing term, adds
crossing words from the word list until 8 tiles are used, shuffles, colors each
tile red/blue at random. Every rack is therefore fully playable.

Both save the answer to `localStorage["rollaword.solution"]` for `solution.html`.

## 6. Daily Challenge

- `startChallengeEngine()` in `rollaword.js` fetches the puzzle file and uses
  today's key (the player's local date).
- RollaWord: `/js/dailychallenge.json`, `YYYYMMDD`. Current file covers
  **2026-10-18 to 2027-10-17 (365 days)**. **It must be regenerated before 2027-10-18.**
  [confirmed from the file; how it is generated is **to confirm**]
- RollaSail: `/js/sailchallenge.json`, `MMDD`, 366 days (includes 0229), so it
  never expires. Generated by `generateSailChallenge.js`:
  `node generateSailChallenge.js [seed]` -> writes `sailchallenge.json` and
  `sailsolutions.json` next to the script. **[confirmed]**
- Tile format in both files: `{ "l": "K", "c": "red" }` (the engine accepts
  `L`/`C` or `l`/`c`).
- Daily mode does not show the "Show me the Solution" button.

## 7. Leaderboard (Firestore)

`rollawordleaderboard.js` (ES module):
- After a Daily Challenge game with score > 0, it reads today's top 10 from the
  Firestore collection `rollaword_leaderboard` (`date == YYYYMMDD`, score desc).
- If the score qualifies, it opens `enterName.html` as a popup, checks the name
  against existing names (warns once if it exists), then adds a document:
  `{ name, date, score, playerId }` and goes to `leaderboard.html`.
- `playerId` is a random id in `localStorage["rollaword.playerId"]`, used to
  mark "(you)" and tell apart players with the same name.
- Free Play is never ranked.
- Database security is controlled by `firestore.rules` (not reviewed here;
  **to confirm**).

## 8. localStorage / sessionStorage keys

Both games share one origin, so they share storage.

| Key | Written by | Used by | Note |
|---|---|---|---|
| `rollaword.solution` | rollawordadult.js, sailgen.js (via `saveSolutionForSolutionPage`) | solution.js | Last game played (either game) wins. |
| `rollaword.playerId` | rollawordleaderboard.js | leaderboard | Same id for both games. |
| `sessionStorage.currentScore` | rollawordleaderboard.js | enterName.html | |

## 9. Folder map

```
/ (ROLLAWORD)
  index.html            RollaWord game
  howTo.html            RollaWord rules
  enterName.html, leaderboard.html, solution.html
  css/  js/  dynamic/  bible/
  rollasail/
    index.html          RollaSail game
    howToSail.html      RollaSail rules
    sailDictionary.html
    enterName.html, leaderboard.html, solution.html   (copies, see section 10)
    js/ sailgen.js, sailing-dictionary.txt
    sailsolutions.json
```

## 10. Duplicated files (maintained with a diff tool)

Decision (2026-11-03): keep two sets of HTML pages and compare with Beyond
Compare, instead of adding more JS to share them. They are duplicated because
several scripts use relative links (`solution.html`, `enterName.html`,
`leaderboard.html`, `js/sailing-dictionary.txt`), which resolve inside
`/rollasail/` on the sail page.

Allowed to differ between root and `rollasail/` copies:
- Title, headings, branding text (RollaWord / RollaSail), back-button target.
- `<script src="/js/sailgen.js">` (sail `index.html` only).
- howTo vs howToSail: Sailing Term Bonus bullet, Word List bullet, "on the word
  list" wording, one sentence in How to Play. Color multipliers must be IDENTICAL
  (Blue x2, Red x3).

Anything else that differs is probably an accident. Check it.

## 11. Known issues and things to confirm

1. **Moat rule skips the bottom board row.** `hasSingleIsland` uses
   `GRID_ROWS - 1` (5 rows) but the board has 6 rows, and the tray is now a
   separate row. Tiles in row 5 are ignored, so a loose group there is not
   detected, and a bridge through row 5 could look like two islands.
   The comment ("last row contains unused dice") is out of date. **[confirmed, not fixed]**
2. **Sail Daily Challenge scores may land in the RollaWord leaderboard.** The
   leaderboard code has no game field: same collection, same `YYYYMMDD` date, same
   name check. Unless the sail pages load a different copy of the module, both
   games' scores are mixed on one list. **[to confirm: which leaderboard JS the
   sail pages load]**
3. **The sail word list lives in three places** that must stay in sync:
   `sailing-dictionary.txt` (validates words in the game, and is the word list
   for `generateSailChallenge.js`), the `WORDS` / `TERMS` arrays embedded in
   `sailgen.js` (Free Play racks and the x5 terms), and `sailing-terms.json`
   (the term list for the daily generator). A word missing from one place gives
   wrong scores or unplayable racks.
4. **Relative paths still in the code**: `js/sailing-dictionary.txt` and
   `js/small.txt` (rollaworddictionary.js), `solution.html` (rollawordadult.js),
   `enterName.html` and `leaderboard.html` (rollawordleaderboard.js),
   `rollaWord.html` (solution.js). They work only because the sail copies exist.
   Deleting a copy breaks the sail game.
5. **`sailsolutions.json` holds every day's answers** and is publicly fetchable if
   it sits in the deployed folder. The game does not appear to load it. Keep it
   outside the deployed site. **[to confirm it is unused]**
6. `isKidsMode = pathname.includes('id')` matches any path containing "id" (for
   example a future `/guide/`). Today no path matches by accident.
7. Stale comments mention `sail.html` (now `/rollasail/`).
8. Cache: after changing a `.js` or `.json` file, hard-reload (Ctrl+Shift+R).

## 12. Rules for future changes

- Use root-relative paths (`/js/...`, `/css/...`) for everything shared.
- Scoring numbers are set in ONE place each: color multipliers in
  `rollaworddictionary.js`, the x5 in `sailgen.js`. Update the matching How To page
  and this guide in the same change.
- Changing the word list? Update all copies in section 11, item 3.
- Regenerate `dailychallenge.json` before 2027-10-18.
- New game-specific behaviour: set a global from the game's own page or generator,
  instead of adding another path test.

## 13. Not yet reviewed

`index.html` (root and sail, beyond the script list), `enterName.html`,
`leaderboard.html`, `solution.html`, the CSS files, `small.txt`,
`firestore.rules`, `admin.*`, and how `dailychallenge.json` is produced.
