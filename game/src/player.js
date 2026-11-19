import * as THREE from 'three';
import { TUNING } from './config.js';
import { clampToLand, dist2D, resolveCircleVsColliders } from './world.js';
import { knockPedestrianDown } from './vehicles.js';
import { boxPart, mergeParts, xform } from './merge.js';

const JACKET = 0xd86a2a, SKIN = 0xd8a878, TROUSERS = 0x2a2f36, GUNMETAL = 0x181a1c;
const TORSO = [0.8, 1.1, 0.5], LEGS = [0.6, 0.55, 0.4], ARM = [0.18, 0.9, 0.22];
const MOUSE_YAW = 0.0032, MOUSE_PITCH = 0.0022, PITCH_MIN = -0.1, PITCH_MAX = 0.9;
const ARROW_TURN = 1.9, WALK_BOB = 0.06, CAR_SHOVE = 0.6;
const CAR_HIT_SPEED = 9, CAR_HIT_DAMAGE = 12;
const PUNCH_REACH = 2.6, PUNCH_ARC = 0.3, SHOT_RANGE = 70;

function buildBody() {
  const mesh = new THREE.Mesh(mergeParts([
    boxPart(...TORSO, 0, 1.05, 0, JACKET),
    { geo: new THREE.SphereGeometry(0.21, 12, 10), matrix: xform({ y: 1.78 }), color: SKIN },
    boxPart(...LEGS, 0, 0.28, 0, TROUSERS),
    boxPart(...ARM, -0.48, 1.05, 0, JACKET),
    boxPart(...ARM, 0.48, 1.05, 0, JACKET),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.4),
    new THREE.MeshLambertMaterial({ color: GUNMETAL }));
  pistol.position.set(0.5, 1.1, 0.3);
  pistol.visible = false;
  mesh.add(pistol);
  return { mesh, pistol };
}
export const createPlayer = (scene) => {
  const { mesh, pistol } = buildBody();
  mesh.position.set(0, 0, 40);
  scene.add(mesh);
  return {
    mesh, pistolMesh: pistol, x: 0, z: 40, y: 0, vy: 0, heading: 0,
    cameraYaw: Math.PI, cameraPitch: 0.25, health: TUNING.playerMaxHealth,
    armed: 'fists', invulnerable: 0, walkPhase: 0,
  };
};
function steerCamera(player, input, dt) {
  const delta = input.takeMouseDelta();
  player.cameraYaw -= delta.x * MOUSE_YAW;
  const pitch = player.cameraPitch + delta.y * MOUSE_PITCH;
  player.cameraPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
  if (input.isDown('ArrowLeft')) player.cameraYaw += ARROW_TURN * dt;
  if (input.isDown('ArrowRight')) player.cameraYaw -= ARROW_TURN * dt;
}
function walkStep(player, input, dt) {
  const fwd = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
  const strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
  const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = running ? TUNING.playerRunSpeed : TUNING.playerWalkSpeed;
  const sin = Math.sin(player.cameraYaw);
  const cos = Math.cos(player.cameraYaw);
  const moveX = -sin * fwd + cos * strafe;
  const moveZ = -cos * fwd - sin * strafe;
  const len = Math.hypot(moveX, moveZ);
  if (len <= 0.01) return;
  const nx = moveX / len;
  const nz = moveZ / len;
  player.x += nx * speed * dt;
  player.z += nz * speed * dt;
  player.heading = Math.atan2(nx, nz);
  player.walkPhase += dt * (running ? 13 : 8);
}
function fallStep(player, input, dt) {
  if (input.wasPressed('Space') && player.y <= 0.01) player.vy = TUNING.playerJumpSpeed;
  player.vy -= TUNING.gravity * dt;
  player.y = Math.max(0, player.y + player.vy * dt);
  if (player.y === 0) player.vy = 0;
}
function collideStep(player, ctx) {
  const resolved = resolveCircleVsColliders(player.x, player.z, TUNING.playerRadius, ctx.world.colliders);
  player.x = resolved.x;
  player.z = resolved.z;
  const land = clampToLand(player.x, player.z, TUNING.playerRadius);
  player.x = land.x;
  player.z = land.z;
}
function shoveFromCars(player, ctx) {
  const radius = TUNING.carRadius + CAR_SHOVE;
  for (const car of ctx.vehicles) {
    const d = dist2D(player.x, player.z, car.x, car.z);
    if (d >= radius || d <= 0.01) continue;
    const nx = (player.x - car.x) / d;
    const nz = (player.z - car.z) / d;
    player.x += nx * (radius - d);
    player.z += nz * (radius - d);
    if (Math.abs(car.speed) > CAR_HIT_SPEED && player.invulnerable <= 0) {
      damagePlayer(player, CAR_HIT_DAMAGE, ctx);
      player.x += nx * 2;
      player.z += nz * 2;
    }
  }
}
function syncBody(player, dt) {
  if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
  const bob = Math.abs(Math.sin(player.walkPhase)) * WALK_BOB;
  player.mesh.position.set(player.x, player.y + bob, player.z);
  player.mesh.rotation.y = player.heading;
  const blinking = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
  player.mesh.visible = !blinking;
}
// On foot: WASD steers relative to the camera, Shift runs, Space jumps.
export const stepPlayerOnFoot = (player, input, dt, ctx) => {
  steerCamera(player, input, dt);
  walkStep(player, input, dt);
  fallStep(player, input, dt);
  collideStep(player, ctx);
  shoveFromCars(player, ctx);
  syncBody(player, dt);
};
export const damagePlayer = (player, amount, ctx) => {
  if (player.invulnerable > 0) return;
  player.health -= amount;
  player.invulnerable = 0.6;
  ctx.audio.impact(0.4);
  if (player.health <= 0) {
    player.health = 0;
    ctx.onWasted();
  }
};
function nearestTargetInFront(player, ctx) {
  const dirX = Math.sin(player.heading);
  const dirZ = Math.cos(player.heading);
  const targets = [];
  for (const ped of ctx.peds) {
    if (ped.state !== 'down') targets.push({ ref: ped, kind: 'ped' });
  }
  for (const cop of ctx.police.cops) {
    if (cop.health > 0) targets.push({ ref: cop, kind: 'cop' });
  }
  let best = null;
  let bestD = PUNCH_REACH;
  for (const t of targets) {
    const d = dist2D(player.x, player.z, t.ref.x, t.ref.z);
    if (d > bestD) continue;
    const dx = (t.ref.x - player.x) / Math.max(0.1, d);
    const dz = (t.ref.z - player.z) / Math.max(0.1, d);
    if (dx * dirX + dz * dirZ < PUNCH_ARC) continue;
    best = t;
    bestD = d;
  }
  return best;
}
// A punch hits the nearest person in front of the player, within arm's reach.
export const tryPunch = (player, ctx) => {
  const { audio } = ctx;
  audio.punch();
  const best = nearestTargetInFront(player, ctx);
  if (!best) return;
  if (best.kind === 'ped') {
    knockPedestrianDown(best.ref);
    ctx.addCrime(25, 'assault');
    ctx.hud.toast('You knocked a pedestrian down. The cops noticed.');
    return;
  }
  best.ref.health -= 25;
  ctx.addCrime(30, 'assault cop');
  if (best.ref.health <= 0) ctx.police.knockCopDown(best.ref);
};
function resolveHitRoot(hit) {
  let target = hit.object;
  for (; target && !target.userData.ref; target = target.parent);
  return target ? target.userData.ref : null;
}
// Fire the pistol at whatever the crosshair covers: peds, cops and cars.
export const tryShoot = (player, camera, ctx) => {
  if (player.armed !== 'pistol') return;
  ctx.audio.shot();
  ctx.lastGunshotAt = ctx.time;
  ctx.addCrime(20, 'shooting');
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = SHOT_RANGE;
  const roots = [];
  for (const ped of ctx.peds) if (ped.state !== 'down') roots.push(ped.mesh);
  for (const cop of ctx.police.cops) if (cop.health > 0) roots.push(cop.mesh);
  for (const car of ctx.vehicles) roots.push(car.mesh);
  const hits = raycaster.intersectObjects(roots, true);
  if (hits.length === 0) return;
  const ref = resolveHitRoot(hits[0]);
  if (!ref) return;
  if (ref.kind === 'ped') {
    knockPedestrianDown(ref);
    ctx.addCrime(25, 'shooting');
    ctx.fx.spawnSparks(ref.x, ref.z);
  } else if (ref.kind === 'cop') {
    ref.health -= 34;
    ctx.addCrime(30, 'shooting cop');
    ctx.fx.spawnSparks(ref.x, ref.z);
    if (ref.health <= 0) ctx.police.knockCopDown(ref);
  } else if (ref.kind === 'car') {
    ref.health -= 25;
    ctx.fx.spawnSparks(ref.x, ref.z);
    if (ref.health <= 0 && ref.driver === 'traffic') {
      ref.driver = 'none';
      ref.speed = 0;
      ctx.addCrime(15, 'shooting');
    }
  }
};
