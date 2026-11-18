import * as THREE from 'three';
import { TUNING } from './config.js';
import { clampToLand, dist2D, resolveCircleVsColliders } from './world.js';
import { knockPedestrianDown } from './vehicles.js';
import { boxPart, mergeParts, xform } from './merge.js';

export function createPlayer(scene) {
  const JACKET = 0xd86a2a;
  const mesh = new THREE.Mesh(mergeParts([
    boxPart(0.8, 1.1, 0.5, 0, 1.05, 0, JACKET),
    { geo: new THREE.SphereGeometry(0.21, 12, 10), matrix: xform({ y: 1.78 }), color: 0xd8a878 },
    boxPart(0.6, 0.55, 0.4, 0, 0.28, 0, 0x2a2f36),
    boxPart(0.18, 0.9, 0.22, -0.48, 1.05, 0, JACKET),
    boxPart(0.18, 0.9, 0.22, 0.48, 1.05, 0, JACKET),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x181a1c }));
  pistol.position.set(0.5, 1.1, 0.3);
  pistol.visible = false;
  mesh.add(pistol);
  mesh.position.set(0, 0, 40);
  scene.add(mesh);
  return {
    mesh, pistolMesh: pistol, x: 0, z: 40, y: 0, vy: 0, heading: 0,
    cameraYaw: Math.PI, cameraPitch: 0.25, health: TUNING.playerMaxHealth,
    armed: 'fists', invulnerable: 0, walkPhase: 0,
  };
}

/** Move on foot: WASD relative to the camera, Shift to run, Space to jump. */
export function stepPlayerOnFoot(player, input, dt, ctx) {
  const delta = input.takeMouseDelta();
  player.cameraYaw -= delta.x * 0.0032;
  player.cameraPitch = Math.max(-0.1, Math.min(0.9, player.cameraPitch + delta.y * 0.0022));
  if (input.isDown('ArrowLeft')) player.cameraYaw += 1.9 * dt;
  if (input.isDown('ArrowRight')) player.cameraYaw -= 1.9 * dt;

  const fwd = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
  const strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
  const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = running ? TUNING.playerRunSpeed : TUNING.playerWalkSpeed;
  const sin = Math.sin(player.cameraYaw);
  const cos = Math.cos(player.cameraYaw);
  const moveX = -sin * fwd + cos * strafe;
  const moveZ = -cos * fwd - sin * strafe;
  const len = Math.hypot(moveX, moveZ);
  if (len > 0.01) {
    player.x += (moveX / len) * speed * dt;
    player.z += (moveZ / len) * speed * dt;
    player.heading = Math.atan2(moveX / len, moveZ / len);
    player.walkPhase += dt * (running ? 13 : 8);
  }
  if (input.wasPressed('Space') && player.y <= 0.01) player.vy = TUNING.playerJumpSpeed;
  player.vy -= TUNING.gravity * dt;
  player.y = Math.max(0, player.y + player.vy * dt);
  if (player.y === 0) player.vy = 0;

  const resolved = resolveCircleVsColliders(player.x, player.z, TUNING.playerRadius, ctx.world.colliders);
  player.x = resolved.x;
  player.z = resolved.z;
  const land = clampToLand(player.x, player.z, TUNING.playerRadius);
  player.x = land.x;
  player.z = land.z;

  for (const car of ctx.vehicles) {
    const d = dist2D(player.x, player.z, car.x, car.z);
    if (d < TUNING.carRadius + 0.6 && d > 0.01) {
      const push = TUNING.carRadius + 0.6 - d;
      const nx = (player.x - car.x) / d;
      const nz = (player.z - car.z) / d;
      player.x += nx * push;
      player.z += nz * push;
      if (Math.abs(car.speed) > 9 && player.invulnerable <= 0) {
        damagePlayer(player, 12, ctx);
        player.x += nx * 2;
        player.z += nz * 2;
      }
    }
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;

  player.mesh.position.set(player.x, player.y + Math.abs(Math.sin(player.walkPhase)) * 0.06, player.z);
  player.mesh.rotation.y = player.heading;
  player.mesh.visible = player.invulnerable <= 0 || Math.floor(player.invulnerable * 10) % 2 === 1;
}

export function damagePlayer(player, amount, ctx) {
  if (player.invulnerable > 0) return;
  player.health -= amount;
  player.invulnerable = 0.6;
  ctx.audio.impact(0.4);
  if (player.health <= 0) {
    player.health = 0;
    ctx.onWasted();
  }
}

/** A punch hits the nearest person in front of the player, within arm's reach. */
export function tryPunch(player, ctx) {
  ctx.audio.punch();
  const dir = { x: Math.sin(player.heading), z: Math.cos(player.heading) };
  const targets = [
    ...ctx.peds.filter((ped) => ped.state !== 'down').map((ped) => ({ ref: ped, kind: 'ped' })),
    ...ctx.police.cops.filter((cop) => cop.health > 0).map((cop) => ({ ref: cop, kind: 'cop' })),
  ];
  let best = null;
  let bestD = 2.6;
  for (const t of targets) {
    const d = dist2D(player.x, player.z, t.ref.x, t.ref.z);
    if (d > bestD) continue;
    const dx = (t.ref.x - player.x) / Math.max(0.1, d);
    const dz = (t.ref.z - player.z) / Math.max(0.1, d);
    if (dx * dir.x + dz * dir.z < 0.3) continue;
    best = t;
    bestD = d;
  }
  if (!best) return;
  if (best.kind === 'ped') {
    knockPedestrianDown(best.ref);
    ctx.addCrime(25, 'assault');
    ctx.hud.toast('You knocked a pedestrian down. The cops noticed.');
  } else {
    best.ref.health -= 25;
    ctx.addCrime(30, 'assault cop');
    if (best.ref.health <= 0) ctx.police.knockCopDown(best.ref);
  }
}

/** Fire the pistol at whatever the crosshair covers: peds, cops and cars. */
export function tryShoot(player, camera, ctx) {
  if (player.armed !== 'pistol') return;
  ctx.audio.shot();
  ctx.lastGunshotAt = ctx.time;
  ctx.addCrime(20, 'shooting');
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = 70;
  const roots = [];
  for (const ped of ctx.peds) if (ped.state !== 'down') roots.push(ped.mesh);
  for (const cop of ctx.police.cops) if (cop.health > 0) roots.push(cop.mesh);
  for (const car of ctx.vehicles) roots.push(car.mesh);
  const hits = raycaster.intersectObjects(roots, true);
  if (hits.length === 0) return;
  let target = hits[0].object;
  while (target && !target.userData.ref) target = target.parent;
  if (!target) return;
  const ref = target.userData.ref;
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
}
