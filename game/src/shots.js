import * as THREE from 'three';
import { createVehicle } from './vehicles.js';
import { boxPart, mergeParts, xform } from './merge.js';
import { glowTexture } from './textures.js';

export const SHOT_NAMES = ['chase', 'downtown', 'airport', 'title'];

export function stageShot(name, game) {
  const { world, player, police, missions } = game;
  game.playerInCar = false;
  game.playerCar = null;

  if (name === 'title') {
    // Marina golden hour, west end: pink car, Raka, palms, sea + sun, no towers.
    const car = createVehicle(game.scene, 'sports', -260, 288, -Math.PI / 2, { driver: 'none' });
    game.vehicles.push(car);
    addPalms(game, [[-272, 282], [-285, 282]]);
    player.x = -258;
    player.z = 294;
    player.y = 0;
    player.heading = Math.PI / 2;
    player.armed = 'fists';
    player.pistolMesh.visible = false;
    player.mesh.visible = true;
    player.mesh.position.set(-258, 0, 294);
    game.renderer.setShotCamera(new THREE.Vector3(-245, 1.6, 296), new THREE.Vector3(-268, 1.2, 290));
    game.shotDrive = false;
    return;
  }

  if (name === 'downtown') {
    game.renderer.setNight(true);
    player.x = -20;
    player.z = 40;
    player.y = 0;
    player.heading = 0;
    player.cameraYaw = 0;
    player.armed = 'pistol';
    player.pistolMesh.visible = true;
    player.mesh.position.set(-20, 0, 40);
    missions.index = 2;
    missions.stepIndex = 0;
    missions.timer = 0;
    missions.state = 'active';
    missions.moveBeacon();
    const pedSpots = [
      { segDir: 1, s: 340 },
      { segDir: -1, s: 348 },
      { segDir: 1, s: 356 },
    ];
    game.peds.slice(0, 3).forEach((ped, i) => {
      ped.seg = 8;
      ped.segDir = pedSpots[i].segDir;
      ped.s = pedSpots[i].s;
      ped.speed = 1.2;
      ped.state = 'walk';
    });
    const purple = createVehicle(game.scene, 'sports', -14, 44, 2, { driver: 'none', color: 0x8a3ffc });
    game.vehicles.push(purple);
    addMuzzleFlash(game);
    // Diagonal low view: Raka + purple car, fountain and CLUB NEON behind.
    game.renderer.setShotCamera(new THREE.Vector3(-24, 1.3, 34), new THREE.Vector3(-16, 1.3, 44));
    game.shotDrive = false;
    return;
  }

  if (name === 'airport') {
    const car = spawnPlayerCar(game, 'sports', 700, -35, -Math.PI / 2, 16);
    missions.index = 3;
    missions.stepIndex = 1;
    missions.timer = 0;
    missions.state = 'active';
    missions.moveBeacon();
    // Low 3/4 front: car races past plane 1, fuselage + sunset behind.
    game.renderer.setShotCamera(new THREE.Vector3(638, 2, -44), new THREE.Vector3(652, 1, -32));
    game.shotDrive = true;
    return;
  }

  // Head-on pursuit: pink car + cruiser + heli bear down, sunset behind camera.
  const car = spawnPlayerCar(game, 'sports', 130, 0, -Math.PI / 2, 20);
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
  const cruiser1 = createVehicle(game.scene, 'police', 158, 0, -Math.PI / 2, { driver: 'police', cruiseSpeed: 36 });
  cruiser1.speed = 34;
  police.cars.push(cruiser1);
  game.vehicles.push(cruiser1);
  for (const [x, z, type] of [[88, -4.5, 'police'], [96, 4.5, 'taxi']]) {
    game.vehicles.push(createVehicle(game.scene, type, x, z, -Math.PI / 2, { driver: 'none' }));
  }
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
  missions.index = 3;
  missions.stepIndex = 1;
  missions.timer = 0;
  missions.state = 'active';
  missions.moveBeacon();
  game.renderer.setShotCamera(new THREE.Vector3(68, 1.6, 0), new THREE.Vector3(75, 1.3, 0));
  game.shotDrive = true;
}

function addPalms(game, spots) {
  const trunks = [];
  const fronds = [];
  for (const [x, z] of spots) {
    trunks.push({ geo: new THREE.CylinderGeometry(0.25, 0.4, 7, 6), matrix: xform({ x, y: 3.5, z }), color: 0x6a4a2a });
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * Math.PI * 2;
      fronds.push({ geo: new THREE.ConeGeometry(0.85, 4.2, 4), matrix: xform({ x: x - Math.cos(a) * 1.3, y: 7.6, z: z + Math.sin(a) * 1.3, ry: a, rz: 2.25 }), color: k % 2 ? 0x2f8a3e : 0x3a9a4a });
    }
  }
  game.scene.add(new THREE.Mesh(mergeParts(trunks), new THREE.MeshLambertMaterial({ vertexColors: true })));
  game.scene.add(new THREE.Mesh(mergeParts(fronds), new THREE.MeshLambertMaterial({ vertexColors: true })));
}

function addMuzzleFlash(game) {
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc860, transparent: true, opacity: 0.95, depthWrite: false }));
  flash.position.set(-19.5, 1.35, 41.3);
  flash.scale.set(5, 5, 1);
  game.scene.add(flash);
  const flashLight = new THREE.PointLight(0xffb060, 80, 25);
  flashLight.position.set(-18.5, 2.2, 39);
  game.scene.add(flashLight);
}

function spawnPlayerCar(game, type, x, z, heading, speed) {
  const car = createVehicle(game.scene, type, x, z, heading, { driver: 'player' });
  car.isPlayerCar = true;
  car.speed = speed;
  game.playerCar = car;
  game.playerInCar = true;
  game.player.mesh.visible = false;
  game.vehicles.push(car);
  return car;
}
