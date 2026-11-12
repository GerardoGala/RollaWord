// ilcaTrackRaceLegs.js
import { stopSimulation } from './app.js';

/**
 * Monitors the boat's position and triggers the finish line gate 
 * the exact moment the boat crosses the 900m horizontal finish line.
 */
export function trackRaceLegs(map) {
  // 🚫 SKIP IF THE PAGE IS "LEARN"
  if (window.location.pathname.includes('learn')) {
    return; // Exit the function immediately and do nothing
  }

  const ilca = window.globalSimulationData.ILCA;
  const windwardLat = window.globalSimulationData.windwardMarkLat;

  // ==========================================================================
  // 🛠️ DEBUGGING SPEED WARP COEFFECIENT
  // ==========================================================================
  // Set this to true to warp the boat straight up the course for quick testing.
  // Set to false to let the student sail at standard slow-motion speed.
  const ENABLE_SPEED_WARP = false; 
  
  if (ENABLE_SPEED_WARP && !window.globalSimulationData.raceFinished) {
    // Artificial warp step: aggressively pushes the latitude north by about 10-15 meters per tick!
    ilca.lat += 0.00015; 
  }

  // 🏁 FINISH LINE GATE CROSSING CHECK
  // Since the finish line is positioned due North on a flat horizontal axis,
  // crossing it means the boat's latitude has reached or passed the windward mark baseline.
  if (ilca.lat >= windwardLat) {
    
    // 1. Extract final timing telemetry score from global storage
    const finalRaceTimeSeconds = ilca.timer || 0;
    
    // 2. Freeze the simulation states instantly to lock variables
    window.globalSimulationData.raceFinished = true;
    ilca.speed = 0;

    console.log(`🏁 SUCCESS! Finish line crossed at ${finalRaceTimeSeconds} seconds.`);

    // 3. Halt the master clock loop intervals and background wind shifts safely
    stopSimulation();

    // 4. Route the student cleanly to the finish layout screen with URL tracking arguments
    window.location.href = `finish.html?time=${finalRaceTimeSeconds}&reason=completed`;
  }
}
