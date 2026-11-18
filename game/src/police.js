import * as THREE from 'three';
import { TUNING } from './config.js';
import { dist2D, resolveCircleVsColliders, segmentPoint } from './world.js';
import { createVehicle, updateVehicleMesh } from './vehicles.js';
import { boxPart, mergeParts, xform } from './merge.js';

function createCopMesh(scene) {
  const mesh = new THREE.Mesh(mergeParts([
    boxPart(0.8, 1.1, 0.5, 0, 1.05, 0, 0x1c2f55),
    { geo: new THREE.SphereGeometry(0.28, 10, 8), matrix: xform({ y: 1.85 }), color: 0xd8a878 },
    { geo: new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10), matrix: xform({ y: 2.05 }), color: 0x101825 },
    boxPart(0.55, 0.5, 0.35, 0, 0.25, 0, 0x101825),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

function angleToward(from, to, maxStep) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + Math.max(-maxStep, Math.min(maxStep, diff));
}

export function createPolice(scene, world, rng) {
  const police = {
    cars: [], cops: [], wantedPoints: 0, stars: 0,
    lastCrimeAt: -999, bustTimer: 0, spawnTimer: 0,
  };

  function recomputeStars() {
    police.stars = Math.min(5, Math.floor(police.wantedPoints / TUNING.wantedPerStar));
  }

  function addCrime(points, reason) {
    police.wantedPoints = Math.min(TUNING.wantedMax, police.wantedPoints + points);
    police.lastCrimeAt = police.time;
    recomputeStars();
  }

  function clearWanted(ctx) {
    police.wantedPoints = 0;
    police.stars = 0;
    police.bustTimer = 0;
    for (const car of police.cars) {
      ctx.scene.remove(car.mesh);
      ctx.vehicles = ctx.vehicles.filter((v) => v !== car);
    }
    police.cars = [];
    for (const cop of police.cops) ctx.scene.remove(cop.mesh);
    police.cops = [];
    ctx.audio.setSiren(false);
  }

  function spawnPoliceCarNear(ctx, distance) {
    const playerPos = ctx.playerPosition();
    let best = null;
    let bestScore = Infinity;
    for (let tries = 0; tries < 24; tries += 1) {
      const seg = world.segments[Math.floor(Math.random() * world.segments.length)];
      const point = segmentPoint(seg, Math.random() * seg.length);
      const d = dist2D(point.x, point.z, playerPos.x, playerPos.z);
      const score = Math.abs(d - distance);
      if (score < bestScore) {
        bestScore = score;
        best = point;
      }
    }
    if (!best) return;
    const car = createVehicle(scene, 'police', best.x, best.z, 0, { driver: 'police', cruiseSpeed: 38 });
    car.isPlayerCar = false;
    car.stuckTimer = 0;
    police.cars.push(car);
    ctx.vehicles.push(car);
  }

  function spawnCopNear(ctx) {
    const playerPos = ctx.playerPosition();
    const angle = Math.random() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * 25;
    const z = playerPos.z + Math.sin(angle) * 25;
    const mesh = createCopMesh(scene);
    const cop = {
      mesh,
      kind: 'cop',
      x,
      z,
      heading: 0,
      health: 50,
      punchTimer: 0,
      downTimer: 0,
      walkPhase: 0,
    };
    mesh.userData.ref = cop;
    mesh.position.set(x, 0, z);
    police.cops.push(cop);
  }

  function knockCopDown(cop) {
    cop.health = 0;
    cop.downTimer = 6;
    cop.mesh.rotation.x = Math.PI / 2;
    cop.mesh.position.y = 0.4;
  }

  function unstick(car, dt) {
    if (Math.abs(car.speed) >= 3) return;
    car.stuckTimer = (car.stuckTimer || 0) + dt;
    if (car.stuckTimer <= 1.2) return;
    car.heading += Math.PI * 0.7;
    car.stuckTimer = 0;
  }

  function stepPoliceCar(car, dt, ctx) {
    const playerPos = ctx.playerPosition();
    const d = dist2D(car.x, car.z, playerPos.x, playerPos.z);
    if (d > 220) {
      const seg = world.segments[Math.floor(Math.random() * world.segments.length)];
      const point = segmentPoint(seg, Math.random() * seg.length);
      if (dist2D(point.x, point.z, playerPos.x, playerPos.z) < 120) {
        car.x = point.x;
        car.z = point.z;
      }
    }
    const desired = Math.atan2(playerPos.x - car.x, playerPos.z - car.z);
    car.heading = angleToward(car.heading, desired, 2.4 * dt);
    car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
    const playerCar = ctx.playerCar;
    if (playerCar && d < 5.5 && car.ramCooldown <= 0 && Math.abs(car.speed) > 12) {
      playerCar.health -= 1;
      playerCar.speed = Math.min(playerCar.spec.topSpeed, playerCar.speed + 2);
      car.speed *= 0.7;
      car.ramCooldown = 2.5;
      ctx.audio.impact(0.4);
      if (playerCar.health <= 0 && !playerCar.wrecked) {
        playerCar.wrecked = true;
        playerCar.speed = 0;
        ctx.hud.toast('Your car is wrecked. Get out and find another ride.');
      }
    }
    let targetSpeed;
    if (car.ramCooldown > 1) targetSpeed = Math.max(0, ctx.playerSpeed() * 0.5);
    else targetSpeed = d < 7 ? Math.max(0, ctx.playerSpeed() * 0.9) : car.cruiseSpeed;
    const accel = targetSpeed > car.speed ? 18 : 26;
    car.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - car.speed));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const resolved = resolveCircleVsColliders(car.x, car.z, TUNING.carRadius, world.colliders);
    if (resolved.hit) {
      car.speed *= 0.6;
      unstick(car, dt);
    }
    car.x = resolved.x;
    car.z = resolved.z;
    updateVehicleMesh(car, dt, ctx.time);
  }

  function stepCop(cop, dt, ctx) {
    if (cop.health <= 0) {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) {
        cop.mesh.visible = false;
        police.cops = police.cops.filter((c) => c !== cop);
        ctx.scene.remove(cop.mesh);
      }
      return;
    }
    const playerPos = ctx.playerPosition();
    const d = dist2D(cop.x, cop.z, playerPos.x, playerPos.z);
    const desired = Math.atan2(playerPos.x - cop.x, playerPos.z - cop.z);
    cop.heading = angleToward(cop.heading, desired, 6 * dt);
    const speed = d > 3 ? 8.2 : 0;
    cop.x += Math.sin(cop.heading) * speed * dt;
    cop.z += Math.cos(cop.heading) * speed * dt;
    const resolved = resolveCircleVsColliders(cop.x, cop.z, 0.6, world.colliders);
    cop.x = resolved.x;
    cop.z = resolved.z;
    cop.walkPhase += dt * 10;
    cop.mesh.position.set(cop.x, Math.abs(Math.sin(cop.walkPhase)) * 0.06, cop.z);
    cop.mesh.rotation.y = cop.heading;
    if (d < 2.2) {
      cop.punchTimer -= dt;
      if (cop.punchTimer <= 0) {
        cop.punchTimer = 0.9;
        ctx.damagePlayer(8);
      }
    }
    if (d < TUNING.bustDistance) {
      police.bustTimer += dt;
      if (police.bustTimer >= TUNING.bustHoldSec && !ctx.playerInCar) ctx.onBusted();
    }
  }

  function nearestPoliceDistance(ctx) {
    const p = ctx.playerPosition();
    let best = Infinity;
    for (const car of police.cars) best = Math.min(best, dist2D(car.x, car.z, p.x, p.z));
    for (const cop of police.cops) {
      if (cop.health > 0) best = Math.min(best, dist2D(cop.x, cop.z, p.x, p.z));
    }
    return best;
  }

  function update(dt, ctx) {
    police.time = ctx.time;
    const nearest = nearestPoliceDistance(ctx);
    if (police.wantedPoints > 0 && ctx.time - police.lastCrimeAt > TUNING.wantedGraceSec && nearest > 45) {
      police.wantedPoints = Math.max(0, police.wantedPoints - TUNING.wantedDecayPerSec * dt);
      const before = police.stars;
      recomputeStars();
      if (police.stars === 0 && before > 0) {
        ctx.hud.toast('You lost the cops. The heat is off.');
        clearWanted(ctx);
      }
    }
    if (police.stars === 0) {
      police.bustTimer = 0;
      ctx.audio.setSiren(false);
      return;
    }
    ctx.audio.setSiren(true);
    police.spawnTimer -= dt;
    const wantCars = Math.min(police.stars, 4);
    if (police.cars.length < wantCars && police.spawnTimer <= 0) {
      spawnPoliceCarNear(ctx, 70 + police.stars * 10);
      police.spawnTimer = 1.5;
    }
    const wantCops = police.stars >= 2 ? Math.min(police.stars - 1, 3) : (!ctx.playerInCar ? 1 : 0);
    if (police.cops.filter((c) => c.health > 0).length < wantCops && police.spawnTimer <= 0) {
      spawnCopNear(ctx);
      police.spawnTimer = 1.5;
    }
    for (const car of police.cars) stepPoliceCar(car, dt, ctx);
    let anyClose = false;
    for (const cop of police.cops) {
      if (cop.health > 0 && dist2D(cop.x, cop.z, ctx.playerPosition().x, ctx.playerPosition().z) < TUNING.bustDistance) anyClose = true;
    }
    if (!anyClose) police.bustTimer = 0;
    for (const cop of [...police.cops]) stepCop(cop, dt, ctx);
    if (ctx.playerInCar && ctx.playerCar) {
      const near = police.cars.some((c) => dist2D(c.x, c.z, ctx.playerCar.x, ctx.playerCar.z) < 4);
      if (near && Math.abs(ctx.playerCar.speed) < 2) {
        police.bustTimer += dt;
        if (police.bustTimer >= 3) ctx.onBusted();
      } else if (!anyClose) {
        police.bustTimer = 0;
      }
    }
  }

  police.addCrime = addCrime;
  police.clearWanted = clearWanted;
  police.update = update;
  police.knockCopDown = knockCopDown;
  police.nearestPoliceDistance = nearestPoliceDistance;
  police.spawnPoliceCarNear = spawnPoliceCarNear;
  return police;
}
