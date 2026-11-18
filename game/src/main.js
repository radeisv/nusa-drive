import * as THREE from 'three';
import { SAVE_KEY, STORY, TUNING } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld, dist2D } from './world.js';
import {
  createPedestrian,
  createVehicle,
  knockPedestrianDown,
  resolveCarCollisions,
  stepPedestrian,
  stepPlayerCar,
  stepTrafficCar,
  updateVehicleMesh,
} from './vehicles.js';
import { createPlayer, damagePlayer, stepPlayerOnFoot, tryPunch, tryShoot } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { stageShot, SHOT_NAMES } from './shots.js';

const STEP = 1 / 60;
const TRAFFIC_COUNT = 28;
const PED_COUNT = 26;
const MISSION_COUNT = 4;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, { lowFx: params.has('lowfx') });
const scene = renderer.scene;
const rng = createRandom(seed);
const world = buildWorld(scene, rng);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();
const player = createPlayer(scene);
const police = createPolice(scene, world, rng);

const game = {
  scene, renderer, world, input, audio, hud, player, police,
  vehicles: [], peds: [], missions: null, time: 0,
  clockMinutes: TUNING.clockStartMinutes, cash: STORY.startingCash,
  playerCar: null, playerInCar: false, lastGunshotAt: -999, shotDrive: false, screen: 'title',
  fx: {
    spawnSparks: (x, z) => renderer.spawnSparks(x, z),
    addSkid: (x, z, heading) => renderer.addSkid(x, z, heading),
    spawnSmoke: (x, z) => renderer.spawnSmoke(x, z),
    update: (dt) => renderer.updateEffects(dt),
  },
  playerPosition() {
    if (game.playerInCar && game.playerCar) return { x: game.playerCar.x, z: game.playerCar.z };
    return { x: player.x, z: player.z };
  },
  playerSpeed() {
    if (game.playerInCar && game.playerCar) return Math.abs(game.playerCar.speed);
    return input.isDown('KeyW') || input.isDown('KeyA') || input.isDown('KeyS') || input.isDown('KeyD') ? 6 : 0;
  },
  addCash(amount) { game.cash += amount; },
  _lastCrimeAt: {},
  addCrime(points, reason) {
    const now = game.time;
    if (now - (game._lastCrimeAt[reason] || -999) < 2) return;
    game._lastCrimeAt[reason] = now;
    police.addCrime(points, reason);
  },
  damagePlayer(amount) { damagePlayer(player, amount, game); },
  onBusted() { endRun('busted'); },
  onWasted() { endRun('wasted'); },
  saveGame,
  loadGame,
};
game.missions = createMissions(game);

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'taxi', 'pickup', 'sports'];
for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
  const segIndex = Math.floor(rng.next() * world.segments.length);
  const seg = world.segments[segIndex];
  const s = rng.range(0, seg.length);
  const t = s / seg.length;
  const car = createVehicle(scene, rng.pick(TRAFFIC_TYPES), seg.x1 + (seg.x2 - seg.x1) * t, seg.z1 + (seg.z2 - seg.z1) * t, 0, {
    driver: 'traffic', seg: segIndex, segDir: rng.chance(0.5) ? 1 : -1, s, cruiseSpeed: rng.range(10, 16),
  });
  game.vehicles.push(car);
}
const PARKED = [
  { type: 'sedan', at: world.landmarks.parkedCar },
  { type: 'sports', at: world.landmarks.showroomCar, color: 0xf040ff },
  { type: 'taxi', at: { x: -60, z: 120 } },
  { type: 'pickup', at: { x: 200, z: -120 } },
  { type: 'sedan', at: { x: -180, z: 60 } },
];
for (const spot of PARKED) {
  game.vehicles.push(createVehicle(scene, spot.type, spot.at.x, spot.at.z, rng.range(0, Math.PI * 2), { driver: 'none', color: spot.color }));
}
for (let i = 0; i < PED_COUNT; i += 1) {
  const seg = world.segments[Math.floor(rng.next() * world.segments.length)];
  const s = rng.range(0, seg.length);
  const t = s / seg.length;
  game.peds.push(createPedestrian(scene, rng, world, seg.x1 + (seg.x2 - seg.x1) * t, seg.z1 + (seg.z2 - seg.z1) * t));
}

function nearestEnterableCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.vehicles) {
    if (car.driver === 'police' || car.wrecked) continue;
    const d = dist2D(player.x, player.z, car.x, car.z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

function enterCar(car) {
  if (car.driver === 'traffic') {
    game.addCrime(25, 'car theft');
    hud.toast('You stole the car! The driver ran off.');
  } else {
    game.addCrime(15, 'car theft');
    hud.toast(`You took the ${car.spec.name}.`);
  }
  car.driver = 'player';
  car.isPlayerCar = true;
  game.playerCar = car;
  game.playerInCar = true;
  player.mesh.visible = false;
  audio.ensure();
  audio.startMusic();
}

function exitCar() {
  const car = game.playerCar;
  if (!car) return;
  if (Math.abs(car.speed) > 3) {
    hud.toast('Slow down before getting out.');
    return;
  }
  car.driver = 'none';
  car.isPlayerCar = false;
  car.speed = 0;
  player.x = car.x + Math.cos(car.heading) * 3;
  player.z = car.z - Math.sin(car.heading) * 3;
  player.y = 0;
  player.vy = 0;
  player.mesh.visible = true;
  player.heading = car.heading;
  game.playerCar = null;
  game.playerInCar = false;
  audio.setEngine(0, false);
}

function toggleCar() {
  if (game.playerInCar) {
    exitCar();
    return;
  }
  const car = nearestEnterableCar(4.5);
  if (car) enterCar(car);
  else hud.toast('No car close enough — walk up to one and press F.');
}

function stepGame(dt, inputSource) {
  game.time += dt;
  game.clockMinutes += TUNING.clockMinutesPerSec * dt;
  const radioKey = inputSource.wasPressed('KeyQ');
  const mapKey = inputSource.wasPressed('KeyM');
  if (radioKey) hud.nextStation();
  if (mapKey) hud.toggleMap(game);
  if (inputSource.wasPressed('Digit1')) {
    player.armed = 'fists';
    player.pistolMesh.visible = false;
  }
  if (inputSource.wasPressed('Digit2')) {
    player.armed = 'pistol';
    player.pistolMesh.visible = true;
  }
  if (inputSource.wasPressed('KeyF')) toggleCar();
  const interactPressed = inputSource.wasPressed('KeyE');
  if (inputSource.takeClick() && !game.playerInCar) {
    if (player.armed === 'pistol') tryShoot(player, renderer.camera, game);
    else tryPunch(player, game);
  }
  if (game.playerInCar && game.playerCar) {
    if (!game.playerCar.wrecked) stepPlayerCar(game.playerCar, inputSource, dt, game);
    player.x = game.playerCar.x;
    player.z = game.playerCar.z;
    for (const ped of game.peds) {
      if (ped.state !== 'down' && Math.abs(game.playerCar.speed) > 5
        && dist2D(ped.x, ped.z, game.playerCar.x, game.playerCar.z) < 2.2) {
        knockPedestrianDown(ped);
        game.addCrime(40, 'hit pedestrian');
        audio.impact(0.5);
        renderer.spawnSparks(ped.x, ped.z);
      }
    }
  } else {
    stepPlayerOnFoot(player, inputSource, dt, game);
  }
  for (const car of game.vehicles) {
    if (car.driver === 'traffic') stepTrafficCar(car, dt, game);
    if (car.driver !== 'police') updateVehicleMesh(car, dt, game.time);
  }
  resolveCarCollisions(game.vehicles, game);
  for (const ped of game.peds) stepPedestrian(ped, dt, game);
  police.update(dt, game);
  game.missions.update(dt, interactPressed);
  game.fx.update(dt);
  inputSource.endFrame();
}

function resetRunState() {
  game.cash = STORY.startingCash;
  game.clockMinutes = TUNING.clockStartMinutes;
  game.time = 0;
  player.health = TUNING.playerMaxHealth;
  player.x = world.landmarks.playerSpawn.x;
  player.z = world.landmarks.playerSpawn.z;
  player.y = 0;
  player.vy = 0;
  player.armed = 'fists';
  player.pistolMesh.visible = false;
  player.mesh.visible = true;
  if (game.playerCar) {
    game.playerCar.driver = 'none';
    game.playerCar.isPlayerCar = false;
    game.playerCar = null;
    game.playerInCar = false;
  }
  police.clearWanted(game);
  game.missions.index = 0;
  game.missions.stepIndex = 0;
  game.missions.completedCount = 0;
  game.missions.storyDone = false;
  game.missions.state = 'idle';
  game.missions.taxi = { state: 'idle', fare: 0, pickup: null, dropoff: null, cooldown: 0 };
  game.missions.trial = { ringIndex: -1, timer: 0, active: false };
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash,
      clockMinutes: game.clockMinutes,
      health: player.health,
      x: player.x,
      z: player.z,
      missionIndex: game.missions.index,
      stepIndex: game.missions.stepIndex,
      completedCount: game.missions.completedCount,
      storyDone: game.missions.storyDone,
    }));
    return true;
  } catch {
    return false;
  }
}

function loadGame() {
  let data = null;
  try {
    data = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
  } catch {
    data = null;
  }
  if (!data) return false;
  game.cash = data.cash ?? STORY.startingCash;
  game.clockMinutes = data.clockMinutes ?? TUNING.clockStartMinutes;
  player.health = data.health ?? TUNING.playerMaxHealth;
  player.x = data.x ?? world.landmarks.playerSpawn.x;
  player.z = data.z ?? world.landmarks.playerSpawn.z;
  game.missions.completedCount = data.completedCount ?? 0;
  game.missions.storyDone = !!data.storyDone;
  if (game.missions.storyDone) {
    game.missions.state = 'done';
    game.missions.index = MISSION_COUNT;
  } else {
    game.missions.startMission(data.missionIndex ?? 0);
    const mission = game.missions.currentMission();
    game.missions.stepIndex = Math.min(data.stepIndex ?? 0, (mission ? mission.steps.length : 1) - 1);
    if (mission && mission.timeLimit > 0) game.missions.timer = mission.timeLimit;
    game.missions.moveBeacon();
  }
  return true;
}

function startRun(fromSave) {
  audio.ensure();
  audio.startMusic();
  audio.click();
  if (!(fromSave && loadGame())) {
    resetRunState();
    game.missions.startMission(0);
  }
  game.screen = 'play';
  hud.setScreen(null);
  input.requestPointerLock();
}

function endRun(kind) {
  if (game.screen === 'over') return;
  game.screen = 'over';
  input.exitPointerLock();
  audio.setEngine(0, false);
  audio.setSiren(false);
  audio.busted();
  const kept = Math.floor(game.cash * 0.8);
  if (kind === 'busted') hud.setOver('BUSTED', `The Nusa Drive police caught Raka. Bail took the rest — you kept $${kept}.`);
  else hud.setOver('WASTED', `Raka is down. The island keeps turning. You kept $${kept}.`);
  game.cash = kept;
  hud.setScreen('over');
}

function respawn() {
  audio.click();
  player.health = TUNING.playerMaxHealth;
  player.x = world.landmarks.playerSpawn.x;
  player.z = world.landmarks.playerSpawn.z;
  player.y = 0;
  player.vy = 0;
  if (game.playerCar) {
    game.playerCar.driver = 'none';
    game.playerCar.isPlayerCar = false;
    game.playerCar = null;
    game.playerInCar = false;
  }
  player.mesh.visible = true;
  police.clearWanted(game);
  const mission = game.missions.currentMission();
  if (mission && mission.timeLimit > 0) game.missions.timer = mission.timeLimit;
  game.screen = 'play';
  hud.setScreen(null);
  saveGame();
}

function wireButton(id, fn) {
  const node = document.getElementById(id);
  if (node) node.addEventListener('click', fn);
}

function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

function runGame() {
  wireButton('btn-new', () => startRun(false));
  wireButton('btn-continue', () => startRun(true));
  wireButton('btn-resume', () => {
    audio.click();
    game.screen = 'play';
    hud.setScreen(null);
    input.requestPointerLock();
  });
  wireButton('btn-save', () => {
    if (saveGame()) hud.toast('Game saved.');
    else hud.toast('Save failed — storage is unavailable.');
  });
  wireButton('btn-title', () => {
    saveGame();
    game.screen = 'title';
    hud.setScreen('title');
  });
  wireButton('btn-respawn', respawn);
  const continueBtn = document.getElementById('btn-continue');
  if (continueBtn && !hasSave()) continueBtn.classList.add('hidden');

  canvas.addEventListener('click', () => {
    if (game.screen === 'play' && !game.playerInCar) input.requestPointerLock();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'pause';
      hud.setScreen('pause');
    }
  });

  hud.setScreen('title');
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const actions = input.takeActions();
    if (game.screen === 'title' && (actions & ACTION_CONFIRM)) startRun(false);
    else if (game.screen === 'over' && (actions & ACTION_CONFIRM)) respawn();
    else if (game.screen === 'play' && (actions & ACTION_PAUSE)) {
      if (!hud.mapOpen()) {
        game.screen = 'pause';
        hud.setScreen('pause');
        input.exitPointerLock();
      } else hud.toggleMap(game);
    } else if (game.screen === 'pause' && (actions & ACTION_PAUSE)) {
      game.screen = 'play';
      hud.setScreen(null);
      input.requestPointerLock();
    }
    if (game.screen === 'play') {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 5) {
        stepGame(STEP, input);
        accumulator -= STEP;
        steps += 1;
      }
      if (steps === 5) accumulator = 0;
    } else {
      input.endFrame();
    }
    if (game.screen === 'title') {
      const angle = now * 0.00002 + 0.6;
      const driftX = Math.sin(angle) * 12;
      const driftZ = Math.cos(angle) * 12;
      renderer.setShotCamera(
        new THREE.Vector3(-260 + driftX, 9, 290 + driftZ),
        new THREE.Vector3(-280, 3, 292),
      );
      game.time += dt;
    } else {
      renderer.setShotCamera(null);
    }
    hud.update(game, dt);
    renderer.updateEnvironment(dt, world);
    renderer.updateCamera(dt, game);
    renderer.render();
  }
  requestAnimationFrame(frame);
}

function runShot(name) {
  const hudEl = document.getElementById('hud');
  if (name === 'title') hudEl.classList.add('hidden');
  else hud.setScreen(null);
  stageShot(name, game);
  const simInput = {
    keys: new Set(),
    isDown: (code) => game.shotDrive && code === 'KeyW',
    wasPressed: () => false,
    takeMouseDelta: () => ({ x: 0, y: 0 }),
    takeClick: () => false,
    takeActions: () => 0,
    endFrame: () => {},
  };
  for (let i = 0; i < 90; i += 1) stepGame(STEP, simInput);
  hud.update(game, 0);
  let frames = 0;
  function shotFrame() {
    renderer.updateCamera(0.016, game);
    renderer.render();
    frames += 1;
    if (frames >= 3) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(shotFrame);
  }
  requestAnimationFrame(shotFrame);
}

window.__nusa = game;

if (shot) runShot(SHOT_NAMES.includes(shot) ? shot : 'chase');
else runGame();
