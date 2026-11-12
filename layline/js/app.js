// app.js
import { initMap, updateWindControl, updateILCAControl } from './map.js';
import { fetchWind, startWindShiftEngine } from './wind.js'; 
import { updateILCA } from './ilcaUpdateILCA.js';
import { applyControls } from './ilcaApplyControls.js';

let map;
let launched = false;
let masterIntervalId = null;

async function loadConfig() {
  // Ensure the global simulation container object is initialized first
  window.globalSimulationData = window.globalSimulationData || {};

  // ============================================================================
  // ⏰ THE SINGLE MASTER SLOW MOTION VARIABLE
  // ============================================================================
  // Change this number to throttle the entire simulation system clock speed:
  // 1 = Normal speed (1-second steps)
  // 2 = Twice as slow (2-second intervals)
  // 3 = Three times as slow (3-second intervals)
  window.globalSimulationData.slowMotionFactor = 1; 

  map = initMap();

  // Fetch wind immediately so overlays show something
  await updateWindFromAPI();

  // Show initial status immediately
  updateWindControl(map);
  updateILCAControl();

  // --- Unified master loop (adjusted for slow motion) ---
  let tick = 0;
  masterIntervalId = setInterval(async () => {
    tick++;

    // Update ILCA physics if launched
    if (launched) {
      
      // ⏱️ TIMER STEP: Numerical seconds counter increments cleanly here
      window.globalSimulationData.ILCA.timer++;

      // --- Capsize Halting Check & Autopsy Diagnostic ---
      if (window.globalSimulationData.ILCA.capsized) {
        console.warn("Simulation frozen due to capsize.");
        
        // 1. Freeze the master loop clock immediately
        launched = false; 
        if (masterIntervalId) {
          clearInterval(masterIntervalId);
          masterIntervalId = null;
        }

        // 2. Safely halt the wind shift engine too so numbers stop jittering
        if (typeof stopWindShiftEngine === 'function') {
          stopWindShiftEngine();
        }

        // 3. Hide the temporary shaking warning bar
        const warningDiv = document.getElementById("heelWarningContainer");
        if (warningDiv) {
          warningDiv.style.display = "none";
        }

        // 4. Extract telemetry and reason code
        const failureReasonCode = window.globalSimulationData.ILCA.capsizeReason || "leeward_heel";
        const finalTime = window.globalSimulationData.ILCA.timer || 0;
        
        // Translate the code into a clear, helpful lesson
        let autopsyMessage = "";
        if (failureReasonCode === "death_roll") {
          autopsyMessage = "<strong>Death Roll Capsize (To Windward):</strong> You let the boat roll to windward! This happens downwind if your vang is too loose, or upwind if you catch a massive header and fail to hike or sheet out to balance the boat.";
        } else if (failureReasonCode === "over_sheeted" || failureReasonCode === "leeward_heel") {
          autopsyMessage = "<strong>Leeward Capsize (Over-Sheeted):</strong> The wind overpowered your sail! Your mainsheet was sheeted in too tight for this wind speed, or you didn't hike out hard enough to counter the massive heeling force.";
        } else {
          autopsyMessage = "<strong>Hull Over-Heeled:</strong> The boat exceeded its maximum stability threshold of 45 degrees and flipped over.";
        }

        // 5. Inject and display the Capsize Autopsy Panel overlay directly onto the screen
        let autopsyDiv = document.getElementById("capsizeAutopsyPanel");
        if (!autopsyDiv) {
          autopsyDiv = document.createElement("div");
          autopsyDiv.id = "capsizeAutopsyPanel";
          const controlsParent = document.getElementById("controlsDiv") || document.body;
          controlsParent.appendChild(autopsyDiv);
        }

        autopsyDiv.style.display = "block";
        autopsyDiv.style.background = "#fef2f2"; 
        autopsyDiv.style.border = "2px solid #ef4444";
        autopsyDiv.style.borderRadius = "8px";
        autopsyDiv.style.padding = "16px";
        autopsyDiv.style.marginTop = "8px";
        autopsyDiv.style.fontFamily = "sans-serif";
        autopsyDiv.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.1)";
        
        autopsyDiv.innerHTML = `
          <div style="color: #991b1b; font-size: 14px; margin-bottom: 8px;">
            ⚠️ <strong>CAPSIZE ANALYSIS</strong> (Physics Frozen)
          </div>
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #7f1d1d; line-height: 1.4;">
            ${autopsyMessage}
          </p>
          <div style="font-size: 11px; color: #475569; margin-bottom: 12px; background: #fff; padding: 6px; border-radius: 4px; border: 1px solid #fee2e2;">
            ⏳ Survival Time: <strong>${finalTime}s</strong> | Final Heel: <strong>${Math.round(window.globalSimulationData.ILCA.heelAngle || 45)}°</strong>
          </div>
          <div style="display: flex; gap: 6px;">
            <button onclick="window.location.reload()" style="flex: 1; padding: 8px; font-weight: bold; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">🔄 Try Again</button>
            <a href="index.html" style="flex: 1; text-align: center; padding: 8px; font-weight: bold; background: white; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px; text-decoration: none; font-size: 11px;">🏡 Main Menu</a>
          </div>
        `;
        return;
      }

      // ============================================================================
      // 🛠️ SEQUENTIAL PERFORMANCE COUPLING PASS
      // ============================================================================
      const windSpeed = Number(window.globalSimulationData.windSpeed) || 0;
      const windDir = window.globalSimulationData.windDirection;
      const heading = window.globalSimulationData.ILCA.heading;

      // 1. Calculate and sync active Point of Sail text strings
      const pointOfSail = getPointOfSail(windDir, heading);
      window.globalSimulationData.ILCA.pointOfSail = pointOfSail;  
      
      const controls = window.globalSimulationData.ILCA;

      // Explicitly bridge global property updates from your HTML button triggers
      controls.boomAngle = parseFloat(window.globalSimulationData.ILCA.boomAngle) || 0.0;

      // 2. Compute what the maximum potential speed is for your exact current setup targets
      const targetPotentialSpeed = applyControls(pointOfSail, windSpeed, controls); 
      
      // 3. Fetch boat's running velocity tracker
      let currentSpeed = parseFloat(window.globalSimulationData.ILCA.speed);
      if (isNaN(currentSpeed)) {
        currentSpeed = 0.0;
      }

      // 4. SMOOTH KINETIC MOMENTUM INTERPOLATION (The Acceleration Wave)
      if (currentSpeed < targetPotentialSpeed) {
        // ACCELERATION: Boat gathers speed gradually over time
        currentSpeed += (targetPotentialSpeed - currentSpeed) * 0.20;
      } else if (currentSpeed > targetPotentialSpeed) {
        // DECELERATION: Sudden penalties or over-sheeting slides velocity down smoothly
        currentSpeed -= (currentSpeed - targetPotentialSpeed) * 0.35;
      }

      // Lock tracking noise cleanly at dead stops
      if (currentSpeed < 0.05) currentSpeed = 0.0;

      // 5. Commit the calculated velocity shift to global variables
      window.globalSimulationData.ILCA.speed = currentSpeed;

      // 6. Execute map tracking displacement steps using the freshly calculated speed
      updateILCA(map);
    }

    // Refresh overlays
    updateWindControl(map);
    updateILCAControl();
   
    // --- Dynamic Cockpit Warning UI Management ---
    const ilcaData = window.globalSimulationData?.ILCA;
    const warningDiv = document.getElementById("heelWarningContainer");
    const heelDegSpan = document.getElementById("uiHeelDegrees");

    if (warningDiv && ilcaData) {
      if (ilcaData.heelAngle >= 30 && !ilcaData.capsized && launched) {
        warningDiv.style.display = "block";
        if (heelDegSpan) {
          heelDegSpan.textContent = Math.round(ilcaData.heelAngle);
        }
        
        if (ilcaData.heelAngle >= 38) {
          warningDiv.classList.add("danger-shake");
          warningDiv.style.background = "#fca5a5"; 
        } else {
          warningDiv.classList.remove("danger-shake");
          warningDiv.style.background = "#fee2e2"; 
        }
      } else {
        warningDiv.style.display = "none";
        warningDiv.classList.remove("danger-shake");
      }
    }
  }, 1000 * (window.globalSimulationData.slowMotionFactor || 1)); 
}

// --- Clean, flat helper to sync the wind state ---
async function updateWindFromAPI() {
  try {
    const windData = await fetchWind(); 
    if (windData) {
      window.globalSimulationData.windDirection = Number(windData.direction);
      window.globalSimulationData.windSpeed = Number(windData.speed);
    }
  } catch (err) {
    console.error("Wind fetch failed:", err);
  }
}

// Launch simulation
export function launchSimulation() {
  launched = true;
  fetchWind();

  // Reset core simulation variables back to fresh upright conditions
  window.globalSimulationData.ILCA.capsized = false;
  window.globalSimulationData.ILCA.heelAngle = 0;

  window.globalSimulationData.ILCA.heading = 45;
  window.globalSimulationData.ILCA.speed = 0; // Starts safely dead-in-the-water
  window.globalSimulationData.ILCA.timer = 0;

  // The shift engine now starts exactly when the user clicks 'Start Simulation'!
  startWindShiftEngine();
}

// Stop simulation
export function stopSimulation() {
  launched = false;
  if (masterIntervalId) {
    clearInterval(masterIntervalId);
    masterIntervalId = null;
  }
}

window.launchSimulation = launchSimulation;
window.stopSimulation = stopSimulation;

loadConfig();

function getPointOfSail(windDir, heading) {
  let rel = Math.abs(heading - windDir) % 360;
  if (rel > 180) rel = 360 - rel; 

// 🛠️ BALANCED INTERSECT: Synced tightly with your narrowed 30° steering parameters
if (rel <= 30)  return "In Irons";
if (rel <= 60)  return "Close Hauled";
if (rel <= 80)  return "Close Reach";
if (rel <= 100) return "Beam Reach";
if (rel <= 150) return "Broad Reach";
return "Running";}