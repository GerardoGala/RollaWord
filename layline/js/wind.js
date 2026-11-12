// js/wind.

// --- At the very top of wind.js ---

// 1. Check the browser address bar on page load
const isChallenge = window.location.pathname.includes("challenge.html");

// 2. Dynamically set your constraint variable based on the page environment
// If challenge: false (wind shifts dynamically). If learn or practice: true (wind stays static).
const FORCE_STATIC_NORTH = !isChallenge; 

// 3. EXPOSE TO THE WORLD (Optional but highly recommended)
// This lets map.js or app.js read whether wind shifting is currently active
window.globalSimulationData.isWindShiftingActive = isChallenge;

console.log(`[Wind Engine Initialized] Shifting active: ${isChallenge}, Force Static North: ${FORCE_STATIC_NORTH}`);


// Permanent training wind
export let baseWindSpeedMS = 5.14; // 10 knots

const WIND_DIRECTION = 0;

// Background tracking variables for natural shifts
let windShiftIntervalId = null;
let elapsedTime = 0;

/**
 * Start the permanent training wind baseline values (Static at boot).
 */
export function fetchWind() {
    window.globalSimulationData = window.globalSimulationData || {};
    
    // 🎯 INITIAL LESSON PARAMETERS: Locked tightly to 0° at 15 knots at spawn
    window.globalSimulationData.windDirection = WIND_DIRECTION;
    window.globalSimulationData.windSpeed = 15; 
    
    updateWindDisplay();
}

/**
 * Change the wind strength manually if triggered via menus.
 */
export function setWindStrength(strength) {
    if (!window.globalSimulationData) return;

    if (strength === "light") {
        window.globalSimulationData.windSpeed = 5;  // 5 Knots
    } else if (strength === "strong") {
        window.globalSimulationData.windSpeed = 15; // 15 Knots
    }
    updateWindDisplay();
}

/**
 * Active background loop that calculates and injects natural oscillations into the sea breeze.
 */
export function startWindShiftEngine() {
    if (windShiftIntervalId) {
        clearInterval(windShiftIntervalId);
    }

    elapsedTime = 0;

    //const FORCE_STATIC_NORTH = true; 
    
    // Pulls the slow-motion coefficient factor straight from your hardcoded configuration
    const windSlowFactor = window.globalSimulationData?.slowMotionFactor || 1;
    const baseIntervalDelay = 500 * windSlowFactor;

    windShiftIntervalId = setInterval(() => {
        if (!window.globalSimulationData) return;

        // Step elapsed timeline tracking according to the shared global setting multiplier
        elapsedTime += (0.5 * windSlowFactor);

        let finalDirection = WIND_DIRECTION;

        if (FORCE_STATIC_NORTH) {
            finalDirection = WIND_DIRECTION; 
        } else {
            // ============================================================================
            // ⏳ 🛠️ FIXED STEP: 10-SECOND ROCK-SOLID GRACE PERIOD
            // ============================================================================
            // Stretches out the timeline to ensure the wind stays perfectly frozen at 0° 
            // for 10 full simulation seconds, matching your 15-knot upwind target rules.
            const totalGracePeriodSeconds = 10.0;

            if (elapsedTime <= (totalGracePeriodSeconds * windSlowFactor)) {
                finalDirection = WIND_DIRECTION; // Rock-solid wind from 0° North
            } else {
                // 1. RHYTHMIC OSCILLATION (The Marine Shift)
                const wavePeriod = 40.0 * windSlowFactor;
                const shiftMagnitude = 12.0;
                
                // Subtracting the grace period milestone baseline shifts the start 
                // timeline of the sine wave smoothly out past the 10-second mark
                let adjustedTime = elapsedTime - (totalGracePeriodSeconds * windSlowFactor); 
                
                let dynamicDirection = WIND_DIRECTION + 
                    Math.sin((adjustedTime * 2 * Math.PI) / wavePeriod) * shiftMagnitude;

                // 2. LOW-FREQUENCY NOISE (The Needle Jitter)
                const microJitter = (Math.random() - 0.5) * 2.0; 

                finalDirection = (dynamicDirection + microJitter + 360) % 360;
            }
        }

        window.globalSimulationData.windDirection = Math.round(finalDirection);
        updateWindDisplay();
    }, baseIntervalDelay); 
}

/**
 * Clean up the wind engine.
 */
export function stopWindShiftEngine() {
    if (windShiftIntervalId) {
        clearInterval(windShiftIntervalId);
        windShiftIntervalId = null;
    }
}

/**
 * Update the wind display text content layout.
 */
function updateWindDisplay() {
    const windDiv = document.getElementById("windStatus");
    if (windDiv) {
        const windSpeed = window.globalSimulationData.windSpeed;
        const windDirection = window.globalSimulationData.windDirection;
        windDiv.textContent = `🌬️ Wind: ${windSpeed} knots from ${windDirection}°`;
    }
}
