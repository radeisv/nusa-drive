import * as THREE from 'three';
import { createVehicle } from './vehicles.js';
import { boxPart, mergeParts, xform } from './merge.js';
import { flashTexture, glowTexture } from './textures.js';

export const SHOT_NAMES = ['chase', 'downtown', 'airport', 'title'];

function armMission(missions, index, stepIndex) {
  Object.assign(missions, { index, stepIndex, timer: 0, state: 'active' });
  missions.moveBeacon.call(missions);
}
function placePlayer(game, x, z, heading) {
  const { player } = game;
  player.x = x;
  player.z = z;
  player.y = 0;
  player.heading = heading;
  player.mesh.position.set(x, 0, z);
}
function setView(game, from, to) {
  game.renderer.setShotCamera(new THREE.Vector3(...from), new THREE.Vector3(...to));
}
function parkCar(game, type, x, z, heading, opts) {
  const car = createVehicle(game.scene, type, x, z, heading, opts);
  game.vehicles.push(car);
  return car;
}
function putPlayerInCar(game, type, x, z, heading, speed) {
  const car = parkCar(game, type, x, z, heading, { driver: 'player' });
  Object.assign(car, { isPlayerCar: true, speed });
  Object.assign(game, { playerCar: car, playerInCar: true });
  const { player } = game;
  player.mesh.visible = false;
}
// Marina at golden hour: pink sports car, Raka, palms, sea and sun, no towers.
function stageTitle(game) {
  parkCar(game, 'sports', -260, 288, -Math.PI / 2, { driver: 'none' });
  addPalms(game, [[-272, 282], [-285, 282]]);
  placePlayer(game, -258, 294, Math.PI / 2);
  game.player.armed = 'fists';
  game.player.pistolMesh.visible = false;
  game.player.mesh.visible = true;
  setView(game, [-245, 1.6, 296], [-268, 1.2, 290]);
}
// Night downtown: Raka with pistol, purple car, fountain and CLUB NEON behind.
function stageDowntown(game) {
  const { player, missions } = game;
  game.renderer.setNight(true);
  placePlayer(game, -20, 40, 0);
  player.cameraYaw = 0;
  player.armed = 'pistol';
  player.pistolMesh.visible = true;
  armMission(missions, 2, 0);
  const pedSpots = [
    { segDir: 1, s: 340 }, { segDir: -1, s: 348 }, { segDir: 1, s: 356 },
    { segDir: -1, s: 332 }, { segDir: 1, s: 364 }, { segDir: -1, s: 372 },
  ];
  game.peds.slice(0, 6).forEach((ped, i) => {
    ped.seg = 8;
    ped.segDir = pedSpots[i].segDir;
    ped.s = pedSpots[i].s;
    ped.speed = 1.2;
    ped.state = 'walk';
  });
  parkCar(game, 'sports', -14, 44, 2, { driver: 'none', color: 0x8a3ffc });
  addMuzzleFlash(game);
  setView(game, [-24, 1.3, 34], [-16, 1.3, 44]);
}
// Low three-quarter front: the car races past plane 1 at sunset.
function stageAirport(game) {
  putPlayerInCar(game, 'sports', 700, -35, -Math.PI / 2, 16);
  armMission(game.missions, 3, 1);
  setView(game, [638, 2, -44], [652, 1, -32]);
}
// Head-on pursuit: pink car, cruiser and helicopter bear down at sunset.
function stageChase(game) {
  const { police, missions } = game;
  putPlayerInCar(game, 'sports', 130, 0, -Math.PI / 2, 20);
  for (const other of game.vehicles) {
    if (other.driver === 'traffic' && other.seg === 9) {
      other.seg = 8;
      other.s = 100;
      other.segDir = 1;
      other.speed = 12;
    }
  }
  police.wantedPoints = 75;
  police.stars = 3;
  police.lastCrimeAt = 0;
  const cruiser = createVehicle(game.scene, 'police', 158, 0, -Math.PI / 2, { driver: 'police', cruiseSpeed: 36 });
  cruiser.speed = 34;
  police.cars.push(cruiser);
  game.vehicles.push(cruiser);
  parkCar(game, 'police', 88, -4.5, -Math.PI / 2, { driver: 'none' });
  parkCar(game, 'taxi', 96, 4.5, -Math.PI / 2, { driver: 'none' });
  addHelicopter(game);
  armMission(missions, 3, 1);
  setView(game, [68, 1.6, 0], [75, 1.3, 0]);
}

// Each stage paired with whether its shot drives forward (W held).
const STAGES = {
  title: [stageTitle, false],
  downtown: [stageDowntown, false],
  airport: [stageAirport, true],
  chase: [stageChase, true],
};
export const stageShot = (name, game) => {
  Object.assign(game, { playerInCar: false, playerCar: null });
  const [stage, drive] = STAGES[name] || STAGES.chase;
  game.shotDrive = drive;
  stage(game);
};
function addHelicopter(game) {
  const heli = new THREE.Mesh(mergeParts([
    boxPart(3, 1.4, 6, 0, 0, 0, 0x1c2733),
    boxPart(0.6, 0.6, 5, 0, 0.2, -5, 0x1c2733),
    boxPart(9, 0.08, 0.5, 0, 1, 0, 0x222222),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
  heli.position.set(95, 9, -4);
  heli.rotation.y = Math.PI / 2;
  game.scene.add(heli);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff3333, transparent: true, opacity: 0.9, depthWrite: false }));
  beacon.position.set(95, 11.8, -4);
  beacon.scale.set(2, 2, 1);
  game.scene.add(beacon);
}
function addPalms(game, spots) {
  const trunks = [];
  const fronds = [];
  for (const [x, z] of spots) {
    trunks.push({ geo: new THREE.CylinderGeometry(0.25, 0.4, 7, 6), matrix: xform({ x, y: 3.5, z }), color: 0x6a4a2a });
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * Math.PI * 2;
      const color = k % 2 ? 0x2f8a3e : 0x3a9a4a;
      fronds.push({ geo: new THREE.ConeGeometry(0.85, 4.2, 4), matrix: xform({ x: x - Math.cos(a) * 1.3, y: 7.6, z: z + Math.sin(a) * 1.3, ry: a, rz: 2.25 }), color });
    }
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  game.scene.add(new THREE.Mesh(mergeParts(trunks), material));
  game.scene.add(new THREE.Mesh(mergeParts(fronds), material));
}
function addMuzzleFlash(game) {
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), color: 0xffd88a, transparent: true, opacity: 0.98, depthWrite: false }));
  flash.position.set(-19.5, 1.35, 41.3);
  flash.scale.set(3.6, 3.6, 1);
  game.scene.add(flash);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
  core.position.set(-19.5, 1.35, 41.3);
  core.scale.set(1.2, 1.2, 1);
  game.scene.add(core);
  const flashLight = new THREE.PointLight(0xffb060, 80, 25);
  flashLight.position.set(-18.5, 2.2, 39);
  game.scene.add(flashLight);
}
