// ilcaHandleControls.js
import { computeBearing } from "./ilcaUtils.js";

export function handleControls(windDir, windSpeed) {
  const ilca = window.globalSimulationData.ILCA;
  let currentHeading = ilca.heading;
  
  // ==========================================================================
  // 🛠️ EDITABLE NO-GO ZONE CONFIGURATION
  // ==========================================================================
  // Lowered to 30 to narrow the no-go cone to a 330° through 30° window.
  // This lets your boat sail much closer into the wind lines while beating.
  const NO_GO_ZONE_DEGREES = 30; 

  // --- TRACK OLD TACK STATE ---
  // Calculate which tack we are on BEFORE the steering maneuver
  const relativeAngleBefore = ((currentHeading - windDir + 540) % 360) - 180; 
  const isStarboardTackBefore = relativeAngleBefore >= 0;

  // A crisp 3-degree adjustment step prevents over-steering near the buoys
  const STEERING_STEP = 3; 

  switch (ilca.maneuver) {
    case "tack": {
      // ⛵ 🛠️ FIXED UPWIND SNAP ENHANCEMENT:
      // Instantly calculates the clean upwind target lanes (45° or 315° relative to wind) 
      // depending on whichever direction you are swinging from, bypassing stalls.
      if (isStarboardTackBefore) {
        // Crossing from Starboard to Port Tack -> Snap perfectly to Port Close Hauled (315° or -45° off wind)
        ilca.heading = (windDir - 45 + 360) % 360; 
      } else {
        // Crossing from Port to Starboard Tack -> Snap perfectly to Starboard Close Hauled (45° off wind)
        ilca.heading = (windDir + 45) % 360;
      }
      break;
    }

    case "turn-port": {
      // Calculate a standard 45-degree turn left
      let targetHeading = (currentHeading - 45 + 360) % 360;
      
      // Check if this left turn would land the bow inside the "In Irons" no-go zone.
      const relativeAngleAfter = ((targetHeading - windDir + 540) % 360) - 180;
      
      if (Math.abs(relativeAngleAfter) < NO_GO_ZONE_DEGREES) {
        // Snap perfectly to the opposite upwind Close Hauled tack relative to the wind
        ilca.heading = (windDir - 45 + 360) % 360;
      } else {
        ilca.heading = targetHeading;
      }
      break;
    }

    case "turn-starboard": {
      // Calculate a standard 45-degree turn right
      let targetHeading = (currentHeading + 45 + 360) % 360;
      
      // Check if this right turn would land the bow inside the "In Irons" no-go zone.
      const relativeAngleAfter = ((targetHeading - windDir + 540) % 360) - 180;
      
      if (Math.abs(relativeAngleAfter) < NO_GO_ZONE_DEGREES) {
        // Snap perfectly to the opposite upwind Close Hauled tack relative to the wind
        ilca.heading = (windDir + 45) % 360;
      } else {
        ilca.heading = targetHeading;
      }
      break;
    }

    case "head-up":
      // ⛵ Head Up always steers the bow CLOSER to the wind axis
      if (isStarboardTackBefore) {
        ilca.heading = (currentHeading - STEERING_STEP + 360) % 360; // Turn left
      } else {
        ilca.heading = (currentHeading + STEERING_STEP + 360) % 360; // Turn right
      }
      break;

    case "bear-away": {
      // Check if the boat is currently trapped inside the "In Irons" zone
      if (Math.abs(relativeAngleBefore) < NO_GO_ZONE_DEGREES) {
        // ⛵ IN IRONS ESCAPE VALVE: Force the boat's heading directly out to a working Close Hauled upwind alignment
        if (isStarboardTackBefore) {
          ilca.heading = (windDir + 45) % 360; 
        } else {
          ilca.heading = (windDir - 45 + 360) % 360; 
        }
      } else {
        // ⛵ NORMAL OPERATION: Execute standard, smooth 3-degree adjustments when sailing freely
        if (isStarboardTackBefore) {
          ilca.heading = (currentHeading + STEERING_STEP + 360) % 360; // Turn right
        } else {
          ilca.heading = (currentHeading - STEERING_STEP + 360) % 360; // Turn left
        }
      }
      break;
    }
  }


  // --- TACK PENALTY EVALUATION LAYER ---
  // Calculate which tack we are on AFTER the steering maneuver completed
  const relativeAngleFinal = ((ilca.heading - windDir + 540) % 360) - 180;
  const isStarboardTackAfter = relativeAngleFinal >= 0;

  // If the tack state switched (e.g. Starboard to Port or Port to Starboard)
  if (isStarboardTackBefore !== isStarboardTackAfter) {
    
    // We must check if the crossing happened in front of the wind (a Tack) or behind it (a Jibe).
    // If the absolute average angle to the wind is less than 90°, it means the bow crossed the wind axis.
    const avgRelativeAngle = Math.abs((relativeAngleBefore + relativeAngleFinal) / 2);
    
    if (avgRelativeAngle < 90) {
      // ⛵ CRITICAL TACK PENALTY: Damping momentum as the sail passes through the eye of the wind.
      // Drops current speed by 35% instantly to simulate flapping sails and hull drag.
      const oldSpeed = ilca.speed || 0;
      ilca.speed = oldSpeed * 0.65;
    }
  }


  // Clear the maneuver state so it doesn't loop infinitely 
  ilca.maneuver = null; 

  // ==========================================================================
  // ⛵ KINETIC MOMENTUM & "IN IRONS" DRAG LAYER
  // ==========================================================================
  // Calculate final relative angle to the wind (0° = dead into the wind)
  let angleToWind = Math.abs(((ilca.heading - windDir + 540) % 360) - 180);

  if (angleToWind < NO_GO_ZONE_DEGREES) {
    // 🛑 WE ARE PHYSICALLY POINTING IN THE NO-GO ZONE
    let currentSpeed = ilca.speed || 0;

    if (currentSpeed > 0.1) {
      // COASTING MOMENTUM: Let the boat glide through on its kinetic energy!
      ilca.speed = currentSpeed * 0.85;
      ilca.pointOfSail = "In Irons (Coasting)";
    } else {
      // MOMENTUM DEPLETED: The boat is officially dead in the water trapped in irons
      ilca.speed = 0;
      ilca.pointOfSail = "IN IRONS (Stalled)";
    }
    console.log("pointOfSail", ilca.pointOfSail);
  } 
} 

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
