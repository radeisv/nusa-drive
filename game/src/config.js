export const SAVE_KEY = 'nusa-drive-save-v1';

export const STORY = { playerName: 'Raka', fixerName: 'Mira', cityName: 'Nusa Drive', hideoutName: 'Garage 7', startingCash: 120 };

const gridLines = [];
for (let i = 0; i < 9; i += 1) gridLines.push(-240 + i * 60);

export const WORLD = {
  cityMin: -320, cityMax: 320, bridgeMinX: 320, bridgeMaxX: 560,
  bridgeZ: 0, bridgeHalfWidth: 10, roadWidth: 10, ring: 300,
  airportMinX: 560, airportMaxX: 920, airportMinZ: -220, airportMaxZ: 220,
  gridLines,
};

export const TUNING = {
  playerWalkSpeed: 6, playerRunSpeed: 10.5, playerJumpSpeed: 8.5, gravity: 22,
  playerRadius: 0.7, carRadius: 2.3, playerMaxHealth: 100, carMaxHealth: 100,
  wantedPerStar: 25, wantedMax: 125, wantedDecayPerSec: 2, wantedGraceSec: 10,
  bustDistance: 2.6, bustHoldSec: 1.5, mission1TimeSec: 200, timeTrialSec: 90,
  clockStartMinutes: 18 * 60 + 40, clockMinutesPerSec: 0.25,
};

function car(name, topSpeed, accel, grip, color) { return { name, topSpeed, accel, grip, color }; }

export const CAR_TYPES = {
  sedan: car('Sedan', 34, 16, 2.6, 0x4a6fa5),
  taxi: car('Taxi', 32, 15, 2.6, 0xf2b705),
  pickup: car('Pickup', 30, 13, 2.2, 0x7a4a2b),
  sports: car('Sports', 46, 24, 3.4, 0xf040ff),
  police: car('Police', 40, 20, 3.0, 0x1c2733),
};

export const COLORS = {
  skyTop: 0x5a2a72, skyBand: 0xff5a8a, skyHorizon: 0xff9e5e, sun: 0xffd9a0,
  sea: 0x4a2a5e, sand: 0xe8c890, grass: 0x557a3e, asphalt: 0x2a2d33,
  sidewalk: 0xa89a88, buildingGlass: 0xffb060,
};
