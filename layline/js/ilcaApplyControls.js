// ilcaApplyControls.js
import { calculateHeelAndCapsize } from './ilcaCapsize.js';
import { getWindTier, SCENARIO_TARGETS } from './ilcaTargets.js';

/**
 * Calculates smooth linear reduction multipliers based on distance to targets.
 */
function getTrimMultiplier(currentValue, targetValue, penaltyWeight = 0.4) {
  const deviation = Math.abs(currentValue - targetValue);
  return Math.max(0.5, 1.05 - (deviation * penaltyWeight));
}

/**
 * Calculates a range multiplier so any boom angle inside the manual's specified 
 * windows yields peak efficiency, penalized smoothly outside it.
 * 🛠️ FIXED MAIN SHEET LOOPHOLE: Dropping drive to 0 if completely out of trim!
 */
function getBoomRangeMultiplier(currentAngle, minAngle, maxAngle) {
  let deviation = 0;
  if (currentAngle < minAngle) {
    deviation = minAngle - currentAngle;
  } else if (currentAngle > maxAngle) {
    deviation = currentAngle - maxAngle;
  }
  
  // ⛵ TRUE SAILING PHYSICS: If the boom angle is more than 15 degrees out
  // from the optimal target window, the sail completely stalls or loses all drive.
  if (deviation > 15) {
    return 0.0; // The boat stops dead in the water!
  }
  
  // Smooth linear penalty for minor imperfections (0 to 15 degrees off target)
  return 1.05 - (deviation * 0.03);
}

export function applyControls(pointOfSail, windSpeed, controls) {
  // --- SPECIAL CASE: IN IRONS & MOMENTUM DECAY ---
  if (pointOfSail && pointOfSail.includes("In Irons")) {
    const isStalled = pointOfSail.includes("Stalled") || (controls.speed || 0) <= 0.1;

    if (isStalled) {
      controls.heelingForceMultiplier = 0.0;
      let currentClinometer = controls.clinometer || 0;
      controls.clinometer = currentClinometer + (0 - currentClinometer) * 0.6;
      return 0.0; 
    } else {
      controls.heelingForceMultiplier = 0.2; 
      let currentClinometer = controls.clinometer || 0;
      controls.clinometer = currentClinometer * 0.85; 
      return (controls.speed || 0.5) / windSpeed;
    }
  }

  // Group reaching vectors under one conceptual manual header
  let lookupHeading = pointOfSail;
  if (pointOfSail.includes("Reach")) {
    lookupHeading = "Reaching";
  }

  // Define global base efficiencies based on direction heading
  let baseFactor = 0.3; // Default floor
  
  if (pointOfSail === "Close Hauled") {
    baseFactor = 0.32; // 15 kn wind * 0.32 = ~4.8 knots upwind top speed!
  }
  if (pointOfSail === "Close Reach" || pointOfSail === "Broad Reach") {
    baseFactor = 0.45; // Fast reaching lanes (~6.7 knots)
  }
  if (pointOfSail === "Beam Reach") {
    baseFactor = 0.52; // Pure peak beam tracking (~7.8 knots)
  }
  if (pointOfSail === "Running") {
    baseFactor = 0.38; // Running dead downwind (~5.7 knots)
  }

  // --- FIXED: ROUNDED DECIMAL & SAFE FALLBACK TARGETS ---
  const roundedWindSpeed = Math.round(windSpeed || 0);
  const windTier = getWindTier(roundedWindSpeed) || "Moderate"; 
  
  const safeHeading = SCENARIO_TARGETS[lookupHeading] ? lookupHeading : "Close Hauled";
  const targets = SCENARIO_TARGETS[safeHeading][windTier] || SCENARIO_TARGETS[safeHeading]["Moderate"]; 

  let modifier = 1.0;

  // --- INTERFACE TRANSLATION LAYER ---
  const v = controls.vang;            
  const d = controls.downhaul;        
  const o = controls.outhaul;         
  const db = controls.daggerboard;    

  let numericBoomAngle = parseFloat(controls.boomAngle);
  if (isNaN(numericBoomAngle)) {
    numericBoomAngle = 0.0;
  }

  // --- 1. BOOM ANGLE PENALTY (Now features strict stall out logic) ---
  modifier *= getBoomRangeMultiplier(numericBoomAngle, targets.minBoom, targets.maxBoom);

  // --- 2. SAIL RIG CONTROLS PENALTIES ---
  modifier *= (v === targets.vang) ? 1.0 : 0.85;
  modifier *= (d === targets.downhaul) ? 1.0 : 0.85;
  modifier *= (o === targets.outhaul) ? 1.0 : 0.85;

  // --- 3. SAILOR POSITION MATCHING ---
  if (controls.sailorPosition === targets.sailor) {
    modifier *= 1.08; 
  } else if (controls.sailorPosition === "Mid Center") {
    modifier *= 0.98;
  } else {
    modifier *= 0.88;
  }

  // --- 4. DAGGERBOARD PERFORMANCE & LEEWAY TRACKING ---
  if (db === targets.daggerboard) {
    modifier *= 1.05; 
  } else {
    modifier *= 0.90; 
  }

  if (lookupHeading === "Close Hauled") {
    if (db === "Down") controls.leeway = 2.0;
    else if (db === "Center") controls.leeway = 15.0;
    else controls.leeway = 35.0; 
  } else if (lookupHeading === "Reaching") {
    if (db === "Center") controls.leeway = 3.0;
    else controls.leeway = 11.0; 
  } else {
    if (db === "Up") controls.leeway = 1.0;
    else if (db === "Center") controls.leeway = 3.0;
    else controls.leeway = 5.0; 
  }

  // --- 5. HEEL SPILLING LOGIC ---
  if (numericBoomAngle > targets.maxBoom) {
    const easeDeg = numericBoomAngle - targets.maxBoom;
    controls.heelingForceMultiplier = Math.max(0.0, 1.0 - (easeDeg / 45.0));
  } else {
    controls.heelingForceMultiplier = 1.0;
  }

  // --- FINAL Physics PASS LINK ---
  const isCapsized = calculateHeelAndCapsize(pointOfSail, windSpeed, controls);
  if (isCapsized) {
    return 0.0;
  }

  const finalSpeedFactor = baseFactor * modifier;
  return Math.min(windSpeed * finalSpeedFactor, 12);
}
