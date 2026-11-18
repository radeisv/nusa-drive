import * as THREE from 'three';
import { TUNING } from './config.js';
import { dist2D, resolveCircleVsColliders, segmentPoint } from './world.js';
import { createVehicle, updateVehicleMesh } from './vehicles.js';
import { boxPart, mergeParts, xform } from './merge.js';

const COP_BODY = 0x1c2f55;
const COP_DARK = 0x101825;
const COP_SKIN = 0xd8a878;

function buildCopMesh(scene) {
  const parts = [
    boxPart(0.8, 1.1, 0.5, 0, 1.05, 0, COP_BODY),
    boxPart(0.55, 0.5, 0.35, 0, 0.25, 0, COP_DARK),
    { geo: new THREE.SphereGeometry(0.28, 10, 8), matrix: xform({ y: 1.85 }), color: COP_SKIN },
    { geo: new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10), matrix: xform({ y: 2.05 }), color: COP_DARK },
  ];
  const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

function steerAngle(from, to, step) {
  let diff = ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return from + Math.max(-step, Math.min(step, diff));
}

export function createPolice(scene, world, rng) {
  const P = {
    cars: [], cops: [], wantedPoints: 0, stars: 0,
    lastCrimeAt: -999, bustTimer: 0, spawnTimer: 0, time: 0,
  };

  const starCount = () => Math.min(5, Math.floor(P.wantedPoints / TUNING.wantedPerStar));

  function addCrime(points) {
    P.wantedPoints = Math.min(TUNING.wantedMax, P.wantedPoints + points);
    P.lastCrimeAt = P.time;
    P.stars = starCount();
  }

  function clearWanted(ctx) {
    P.wantedPoints = 0;
    P.stars = 0;
    P.bustTimer = 0;
    for (const car of P.cars) {
      ctx.scene.remove(car.mesh);
      ctx.vehicles = ctx.vehicles.filter((v) => v !== car);
    }
    P.cars = [];
    for (const cop of P.cops) ctx.scene.remove(cop.mesh);
    P.cops = [];
    ctx.audio.setSiren(false);
  }

  function roadPointNear(ctx, distance) {
    const pp = ctx.playerPosition();
    let pick = null;
    let pickScore = Infinity;
    for (let i = 0; i < 24; i += 1) {
      const seg = world.segments[Math.floor(Math.random() * world.segments.length)];
      const pt = segmentPoint(seg, Math.random() * seg.length);
      const gap = Math.abs(dist2D(pt.x, pt.z, pp.x, pp.z) - distance);
      if (gap < pickScore) {
        pickScore = gap;
        pick = pt;
      }
    }
    return pick;
  }

  function spawnCruiser(ctx, distance) {
    const spot = roadPointNear(ctx, distance);
    if (!spot) return;
    const car = createVehicle(scene, 'police', spot.x, spot.z, 0, { driver: 'police', cruiseSpeed: 38 });
    car.isPlayerCar = false;
    car.stuckTimer = 0;
    P.cars.push(car);
    ctx.vehicles.push(car);
  }

  function spawnFootCop(ctx) {
    const pp = ctx.playerPosition();
    const a = Math.random() * Math.PI * 2;
    const spot = { x: pp.x + Math.cos(a) * 25, z: pp.z + Math.sin(a) * 25 };
    const mesh = buildCopMesh(scene);
    const cop = {
      mesh, kind: 'cop', x: spot.x, z: spot.z, heading: 0,
      health: 50, punchTimer: 0, downTimer: 0, walkPhase: 0,
    };
    mesh.userData.ref = cop;
    mesh.position.set(spot.x, 0, spot.z);
    P.cops.push(cop);
  }

  function knockCopDown(cop) {
    cop.health = 0;
    cop.downTimer = 6;
    cop.mesh.rotation.x = Math.PI / 2;
    cop.mesh.position.y = 0.4;
  }

  function freeStuck(car, dt) {
    if (Math.abs(car.speed) >= 3) return;
    car.stuckTimer = (car.stuckTimer || 0) + dt;
    if (car.stuckTimer <= 1.2) return;
    car.heading += Math.PI * 0.7;
    car.stuckTimer = 0;
  }

  function chaseCar(car, dt, ctx) {
    const pp = ctx.playerPosition();
    const d = dist2D(car.x, car.z, pp.x, pp.z);
    if (d > 220) {
      const spot = roadPointNear(ctx, 100);
      if (spot && dist2D(spot.x, spot.z, pp.x, pp.z) < 120) {
        car.x = spot.x;
        car.z = spot.z;
      }
    }
    car.heading = steerAngle(car.heading, Math.atan2(pp.x - car.x, pp.z - car.z), 2.4 * dt);
    car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
    const pc = ctx.playerCar;
    if (pc && d < 5.5 && car.ramCooldown <= 0 && Math.abs(car.speed) > 12) {
      pc.health -= 1;
      pc.speed = Math.min(pc.spec.topSpeed, pc.speed + 2);
      car.speed *= 0.7;
      car.ramCooldown = 2.5;
      ctx.audio.impact(0.4);
      if (pc.health <= 0 && !pc.wrecked) {
        pc.wrecked = true;
        pc.speed = 0;
        ctx.hud.toast('Your car is wrecked. Get out and find another ride.');
      }
    }
    const cruise = car.ramCooldown > 1
      ? Math.max(0, ctx.playerSpeed() * 0.5)
      : (d < 7 ? Math.max(0, ctx.playerSpeed() * 0.9) : car.cruiseSpeed);
    const accel = cruise > car.speed ? 18 : 26;
    car.speed += Math.max(-accel * dt, Math.min(accel * dt, cruise - car.speed));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const hit = resolveCircleVsColliders(car.x, car.z, TUNING.carRadius, world.colliders);
    car.x = hit.x;
    car.z = hit.z;
    if (hit.hit) {
      car.speed *= 0.6;
      freeStuck(car, dt);
    }
    updateVehicleMesh(car, dt, ctx.time);
  }

  function chaseCop(cop, dt, ctx) {
    if (cop.health <= 0) {
      cop.downTimer -= dt;
      if (cop.downTimer > 0) return;
      cop.mesh.visible = false;
      P.cops = P.cops.filter((c) => c !== cop);
      ctx.scene.remove(cop.mesh);
      return;
    }
    const pp = ctx.playerPosition();
    const d = dist2D(cop.x, cop.z, pp.x, pp.z);
    cop.heading = steerAngle(cop.heading, Math.atan2(pp.x - cop.x, pp.z - cop.z), 6 * dt);
    const speed = d > 3 ? 8.2 : 0;
    cop.x += Math.sin(cop.heading) * speed * dt;
    cop.z += Math.cos(cop.heading) * speed * dt;
    const hit = resolveCircleVsColliders(cop.x, cop.z, 0.6, world.colliders);
    cop.x = hit.x;
    cop.z = hit.z;
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
      P.bustTimer += dt;
      if (P.bustTimer >= TUNING.bustHoldSec && !ctx.playerInCar) ctx.onBusted();
    }
  }

  function nearestPoliceDistance(ctx) {
    const pp = ctx.playerPosition();
    let best = Infinity;
    const units = [...P.cars, ...P.cops.filter((c) => c.health > 0)];
    for (const u of units) best = Math.min(best, dist2D(u.x, u.z, pp.x, pp.z));
    return best;
  }

  function decayHeat(dt, ctx) {
    const near = nearestPoliceDistance(ctx);
    if (P.wantedPoints <= 0) return false;
    if (ctx.time - P.lastCrimeAt <= TUNING.wantedGraceSec) return false;
    if (near <= 45) return false;
    P.wantedPoints = Math.max(0, P.wantedPoints - TUNING.wantedDecayPerSec * dt);
    const before = P.stars;
    P.stars = starCount();
    if (P.stars === 0 && before > 0) {
      ctx.hud.toast('You lost the cops. The heat is off.');
      clearWanted(ctx);
      return true;
    }
    return false;
  }

  function reinforce(dt, ctx) {
    P.spawnTimer -= dt;
    const wantCars = Math.min(P.stars, 4);
    if (P.cars.length < wantCars && P.spawnTimer <= 0) {
      spawnCruiser(ctx, 70 + P.stars * 10);
      P.spawnTimer = 1.5;
    }
    const aliveCops = P.cops.filter((c) => c.health > 0).length;
    const wantCops = P.stars >= 2 ? Math.min(P.stars - 1, 3) : (!ctx.playerInCar ? 1 : 0);
    if (aliveCops < wantCops && P.spawnTimer <= 0) {
      spawnFootCop(ctx);
      P.spawnTimer = 1.5;
    }
  }

  function checkBust(dt, ctx) {
    const pp = ctx.playerPosition();
    let anyClose = false;
    for (const cop of P.cops) {
      if (cop.health > 0 && dist2D(cop.x, cop.z, pp.x, pp.z) < TUNING.bustDistance) anyClose = true;
    }
    if (!anyClose) P.bustTimer = 0;
    if (ctx.playerInCar && ctx.playerCar) {
      const blocked = P.cars.some((c) => dist2D(c.x, c.z, ctx.playerCar.x, ctx.playerCar.z) < 4);
      if (blocked && Math.abs(ctx.playerCar.speed) < 2) {
        P.bustTimer += dt;
        if (P.bustTimer >= 3) ctx.onBusted();
      } else if (!anyClose) {
        P.bustTimer = 0;
      }
    }
    return anyClose;
  }

  function update(dt, ctx) {
    P.time = ctx.time;
    decayHeat(dt, ctx);
    if (P.stars === 0) {
      P.bustTimer = 0;
      ctx.audio.setSiren(false);
      return;
    }
    ctx.audio.setSiren(true);
    reinforce(dt, ctx);
    for (const car of P.cars) chaseCar(car, dt, ctx);
    for (const cop of [...P.cops]) chaseCop(cop, dt, ctx);
    checkBust(dt, ctx);
  }

  P.addCrime = addCrime;
  P.clearWanted = clearWanted;
  P.update = update;
  P.knockCopDown = knockCopDown;
  P.nearestPoliceDistance = nearestPoliceDistance;
  P.spawnPoliceCarNear = spawnCruiser;
  return P;
}
