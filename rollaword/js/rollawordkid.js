// =========================================================================
// ROLLAWORD KID SEGMENT - REVERSE-ENGINEERED ANAGRAM GENERATOR
// =========================================================================

// Kid score mapping completely flattens point values to zero/basic 1-point tiles
window.SCRABBLE_SCORE_MAP = {
  "A": 1, "E": 1, "I": 1, "O": 1, "U": 1, "L": 1, "N": 1, "R": 1, "S": 1, "T": 1,
  "D": 1, "G": 1, "B": 1, "C": 1, "M": 1, "P": 1, "F": 1, "H": 1, "V": 1, "W": 1, "Y": 1,
  "K": 1, "J": 1, "X": 1, "Q": 1, "Z": 1, "*": 0
};

/**
 * Reverse-engineers an 8-character payload out of simple children vocabulary words
 */
window.generateLetterPayload = function() {
  const simpleWords = ["CAT", "DOG", "BED", "NET", "BAT", "RAT", "HAT", "SIT", "RUN", "SUN", "RED", "FUN", "BOY", "MAP", "BOX", "TOY"];
  
  let letterPool = [];
  let wordFound = false;

  while (!wordFound) {
    let w1 = simpleWords[Math.floor(Math.random() * simpleWords.length)];
    let w2 = simpleWords[Math.floor(Math.random() * simpleWords.length)];
    
    letterPool = (w1 + w2).split('');
    
    // Pad out remaining fields with easy vowel/consonant hooks to complete tray layout width
    while (letterPool.length < 8) {
      letterPool.push(["A", "E", "T", "S", "O"][Math.floor(Math.random() * 5)]);
    }
    
    if (letterPool.length === 8) {
      wordFound = true;
    }
  }

  // Returns identical layout structure payload mapping
  return letterPool.map((letter, idx) => {
    let assignedColor = (idx % 2 === 0) ? "BLUE" : "RED";
    return { L: letter, C: assignedColor };
  });
};

console.log("🧒 [RollaWord Segment] Child Data Generation Layer Online.");
