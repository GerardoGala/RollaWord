window.globalSimulationData = {
  stage: 1,

  // --- Wind state ---
  windDirection: 11,
  windSpeed: 0,   


// Base coordinates (The Starting / Leeward Gate Area)
leewardMarkLat: 13.670464,
leewardMarkLon: 121.401286,

// 🏁 LEG 1 TARGET: Now 150 meters due North of Leeward (Reduced by 100m)
windwardMarkLat: 13.671812,
windwardMarkLon: 121.401286,

  



    // 🎯 The Leaflet marker instance reference
  activeMarker: null, 

  // --- UPDATED FOR 5-LEG OLYMPIC COURSE SYSTEM ---
  // 0 = Leg 1: To Windward (Beat)
  // 1 = Leg 2: To Gybe (Beam Reach)
  // 3 = Leg 4: To Leeward (Final Dead Downwind Run Finish)
  currentLeg: 0,                                 

  // Rounded trackers increment each time a mark threshold is successfully crossed
  windwardMarkRounded: 0,  // Reaches 1 on Leg 1
  gybeMarkRounded: 0,      // Reaches 1 on Leg 2
  leewardMarkRounded: 0,   // Reaches 1 on Leg 3, the finish!
  raceFinished: false,

  // 🟢 NEW: Holds references to your physical Leaflet map markers
  // Map initialization scripts should store markers here: window.globalSimulationData.markers.windward = myMarker;
  markers: {
    windward: null,
    gybe: null,
    leeward: null
  },

  // --- ILCA state ---
  ILCA: {
    maneuver: null,
    pointOfSail: "",
    heading: 45,
    speed: 0,
    sailorPosition: "Hike Hard", //beating upwind at 15 knots of wind
    boomAngle: 15,                 //beating upwind at 15 knots of wind
    daggerboard: "Down",          //beating upwind at 15 knots of wind
    vang: "Max",                  //beating upwind at 15 knots of wind
    downhaul: "Max Luff",         //beating upwind at 15 knots of wind
    outhaul: "Base",              //beating upwind at 15 knots of wind
/*
    sailorPosition: "Aft Center", //sailing downwind at 15 knots of wind
    boomAngle: 90,             //sailing downwind at 15 knots of wind
    daggerboard: "Center",       //sailing downwind at 15 knots of wind
    vang: "Center",               //sailing downwind at 15 knots of wind
    downhaul: "OFF",            //sailing downwind at 15 knots of wind
    outhaul: "Full",              //sailing downwind at 15 knots of wind
*/

    lat: 13.670464,   // 👈 USED IN LEARN.HTML: The live, moving latitude of the boat
    lon: 121.401286,
    timer: 0,
    distanceToBuoy: 0,
    bearingToBuoy: 0,
    distanceToRC: 0,
    bearingToRC: 0,
    vmg: 0,
    clinometer: 0,
    slowMotionFactor: 3,
    targetLat: 0,         // 👈 USED IN LEARN.HTML: Set by map.js as the crossing threshold
    targetLon: 0,
    distanceToLayline: 0,
    isWindShiftingActive: 0,
    tackTimingStatus: "UNDERSTOOD"
  }
};
