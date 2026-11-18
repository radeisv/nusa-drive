export const SAVE_KEY = 'nusa-drive-save-v1';

export const WORLD = {
  cityMin: -320,
  cityMax: 320,
  airportMinX: 560,
  airportMaxX: 920,
  airportMinZ: -220,
  airportMaxZ: 220,
  bridgeMinX: 320,
  bridgeMaxX: 560,
  bridgeZ: 0,
  bridgeHalfWidth: 10,
  roadWidth: 10,
  gridLines: Array.from({ length: 9 }, (_, i) => -240 + i * 60),
  ring: 300,
};

export const TUNING = {
  playerWalkSpeed: 6,
  playerRunSpeed: 10.5,
  playerJumpSpeed: 8.5,
  gravity: 22,
  playerRadius: 0.7,
  carRadius: 2.3,
  wantedPerStar: 25,
  wantedMax: 125,
  wantedDecayPerSec: 2,
  wantedGraceSec: 10,
  bustDistance: 2.6,
  bustHoldSec: 1.5,
  playerMaxHealth: 100,
  carMaxHealth: 100,
  mission1TimeSec: 200,
  timeTrialSec: 90,
  clockStartMinutes: 18 * 60 + 40, // golden hour, 18:40 — Miami-Vice sunset
  clockMinutesPerSec: 0.25,
};

export const CAR_TYPES = {
  sedan: { name: 'Sedan', topSpeed: 34, accel: 16, grip: 2.6, color: 0x4a6fa5 },
  taxi: { name: 'Taxi', topSpeed: 32, accel: 15, grip: 2.6, color: 0xf2b705 },
  pickup: { name: 'Pickup', topSpeed: 30, accel: 13, grip: 2.2, color: 0x7a4a2b },
  sports: { name: 'Sports', topSpeed: 46, accel: 24, grip: 3.4, color: 0xf040ff },
  police: { name: 'Police', topSpeed: 40, accel: 20, grip: 3.0, color: 0x1c2733 },
};

export const COLORS = {
  skyTop: 0x5a2a72, // sunset: purple-pink zenith
  skyHorizon: 0xff9e5e, // orange horizon
  skyBand: 0xff5a8a, // pink band low in the sky
  sun: 0xffd9a0,
  sea: 0x4a2a5e, // sunset sea: deep purple
  sand: 0xe8c890,
  grass: 0x557a3e,
  asphalt: 0x2a2d33,
  sidewalk: 0xa89a88,
  buildingGlass: 0xffb060,
};

export const STORY = {
  playerName: 'Raka',
  fixerName: 'Mira',
  cityName: 'Nusa Drive',
  hideoutName: 'Garage 7',
  startingCash: 120,
};
