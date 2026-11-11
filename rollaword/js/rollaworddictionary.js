// =========================================================================
// ROLLAWORD DICTIONARY
// Local dictionary + scoring constants
// =========================================================================

//  Safe global assignment wrapper. Reuses it if already declared elsewhere!
window.COLOR_MULTIPLIERS = window.COLOR_MULTIPLIERS || {
  // Put your original multiplier mappings right here:
  "BLUE": 2,
  "RED": 3
};


// Keep this local shortcut right below it so your existing dictionary code continues to function
const ALL_DICE_JACKPOT_MULTIPLIER = window.ALL_DICE_JACKPOT_MULTIPLIER;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let LOCAL_DICTIONARY = new Set();
let dictionaryReady = false;
let dictionaryError = null;

async function loadLocalDictionary() {
  try {
    // RollaCity (countries and capitals): its words come from city-data.csv, which citygen.js
    // reads. Wait for that, then use the same list for checking words.
    if (window.location.pathname.toLowerCase().includes("city")) {
      await window.cityWordsReady;
      if (!window.CITY_WORDS || window.CITY_WORDS.size === 0) {
        throw new Error("Could not load the RollaCity word list (city-data.csv)");
      }
      LOCAL_DICTIONARY = window.CITY_WORDS;
      dictionaryReady = true;
      console.log(`RollaCity dictionary loaded: ${LOCAL_DICTIONARY.size} words.`);
      return;
    }

    // RollAnimal (animal names): its words come from animal-data.csv, which animalgen.js
    // reads. Wait for that, then use the same list for checking words.
    if (window.location.pathname.toLowerCase().includes("animal")) {
      await window.animalWordsReady;
      if (!window.ANIMAL_WORDS || window.ANIMAL_WORDS.size === 0) {
        throw new Error("Could not load the RollAnimal word list (animal-data.csv)");
      }
      LOCAL_DICTIONARY = window.ANIMAL_WORDS;
      dictionaryReady = true;
      console.log(`RollAnimal dictionary loaded: ${LOCAL_DICTIONARY.size} words.`);
      return;
    }

    // RollaPlant (plant names): its words come from plant-data.csv, which plantgen.js reads.
    if (window.location.pathname.toLowerCase().includes("plant")) {
      await window.plantWordsReady;
      if (!window.PLANT_WORDS || window.PLANT_WORDS.size === 0) {
        throw new Error("Could not load the RollaPlant word list (plant-data.csv)");
      }
      LOCAL_DICTIONARY = window.PLANT_WORDS;
      dictionaryReady = true;
      console.log(`RollaPlant dictionary loaded: ${LOCAL_DICTIONARY.size} words.`);
      return;
    }

    // RollaSail (sail.html) uses its own, much smaller word list.
    const isSailPage = window.location.pathname.toLowerCase().includes("sail");
    const response = await fetch(
      isSailPage ? "js/sailing-dictionary.txt" : "js/small.txt"
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: Could not load the word list`
      );
    }

    const contents = await response.text();

    LOCAL_DICTIONARY = new Set(
      contents
        .split(/\s+/)
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0)
    );

    dictionaryReady = true;

    console.log(
      `RollaWord dictionary loaded: ${LOCAL_DICTIONARY.size} words.`
    );

  } catch (error) {
    dictionaryError = error;
    dictionaryReady = false;

    console.error("RollaWord dictionary loading failed:", error);

    const scoreArea = document.getElementById("score-output-area");

    if (scoreArea) {
      scoreArea.textContent =
        "Dictionary failed to load. Please refresh the game and try again.";
    }
  }
}

const dictionaryLoadingPromise = loadLocalDictionary();