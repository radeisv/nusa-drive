import * as THREE from 'three';
import { CAR_TYPES, TUNING } from './config.js';
import { clampToLand, dist2D, resolveCircleVsColliders, segmentEndPoint, segmentPoint } from './world.js';
import { boxPart, mergeParts, xform } from './merge.js';

const PED_SHIRTS = [0xc25a5a, 0x5a7ac2, 0x5ac28a, 0xc2a55a, 0x8a5ac2, 0xe8e8e8, 0x3a3a3a];

export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

export function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

const SHAPES = {
  sedan: { len: 5.0, wid: 2.05, bodyH: 0.64, bodyY: 0.62, cabLen: 2.1, cabZ: -0.2 },
  taxi: { len: 5.0, wid: 2.05, bodyH: 0.64, bodyY: 0.62, cabLen: 2.1, cabZ: -0.2 },
  pickup: { len: 5.5, wid: 2.15, bodyH: 0.72, bodyY: 0.66, cabLen: 1.8, cabZ: 0.85 },
  sports: { len: 4.7, wid: 2.2, bodyH: 0.54, bodyY: 0.54, cabLen: 1.9, cabZ: -0.25 },
  police: { len: 5.0, wid: 2.1, bodyH: 0.64, bodyY: 0.62, cabLen: 2.1, cabZ: -0.2 },
};

function addWheels(group, geo, mats) {
  const wheels = [];
  const spots = [[-0.94, 1.58], [0.94, 1.58], [-0.94, -1.58], [0.94, -1.58]];
  for (const [wx, wz] of spots) {
    const wheel = new THREE.Mesh(geo, mats);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.46, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  return wheels;
}

export function createCarMesh(type, colorHex) {
  const group = new THREE.Group();
  const spec = CAR_TYPES[type];
  const s = SHAPES[type];
  const len = s.len;
  const wid = s.wid;
  const paint = type === 'police' ? 0x141c26 : colorHex;
  const parts = [boxPart(wid, s.bodyH, len, 0, s.bodyY, 0, paint)];
  if (type === 'police') parts.push(boxPart(wid + 0.02, 0.42, len * 0.52, 0, s.bodyY - 0.02, 0, 0xf2f2f2));
  parts.push(boxPart(wid - 0.12, 0.26, len * 0.26, 0, s.bodyY + 0.28, len * 0.33, paint));
  parts.push(boxPart(wid - 0.12, 0.24, len * 0.2, 0, s.bodyY + 0.27, -len * 0.37, paint));
  parts.push(boxPart(wid - 0.28, 0.1, s.cabLen * 0.75, 0, s.bodyY + s.bodyH / 2 + 0.62, s.cabZ, paint));
  if (type === 'pickup') parts.push(boxPart(wid - 0.2, 0.42, len * 0.38, 0, s.bodyY + 0.32, -1.55, 0x2a2f36));
  if (type === 'sports') {
    parts.push(boxPart(wid - 0.1, 0.1, 0.7, 0, s.bodyY + s.bodyH / 2 + 0.32, -len / 2 + 0.15, paint));
    for (const sx of [-0.85, 0.85]) parts.push(boxPart(0.12, 0.42, 0.12, sx, s.bodyY + 0.55, -len / 2 + 0.15, 0x9aa2a8));
  }
  for (const bz of [len / 2 + 0.02, -len / 2 - 0.02]) {
    parts.push(boxPart(wid - 0.08, 0.24, 0.18, 0, s.bodyY - 0.18, bz, 0xc8ccd0));
  }
  parts.push(boxPart(wid - 0.7, 0.2, 0.08, 0, s.bodyY + 0.05, len / 2 + 0.02, 0x14181d));
  const body = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 }));
  body.castShadow = true;
  group.add(body);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101c26, metalness: 0.9, roughness: 0.12, envMapIntensity: 1.4 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, 0.55, s.cabLen), glassMat);
  cabin.position.set(0, s.bodyY + s.bodyH / 2 + 0.32, s.cabZ);
  cabin.castShadow = true;
  group.add(cabin);
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(wid - 0.34, 0.62), glassMat);
  shield.position.set(0, s.bodyY + s.bodyH / 2 + 0.32, s.cabZ + s.cabLen / 2 + 0.02);
  shield.rotation.x = -0.42;
  group.add(shield);
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.5), new THREE.MeshLambertMaterial({ color: 0xf2d13d, emissive: 0xaa8800 }));
    sign.position.set(0, s.bodyY + s.bodyH / 2 + 0.72, s.cabZ);
    group.add(sign);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        const sq = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x111111 : 0xf2f2f2 }));
        sq.position.set(sx * (wid / 2 + 0.01), s.bodyY + 0.05, -0.8 + i * 0.45);
        group.add(sq);
      }
    }
  }
  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 14);
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x101215 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.9, roughness: 0.25 });
  const wheels = addWheels(group, wheelGeo, [tireMat, hubMat, hubMat]);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2c8, emissive: 0x998844 });
  const headParts = [];
  for (const hx of [-0.68, 0.68]) headParts.push(boxPart(0.5, 0.2, 0.1, hx, s.bodyY + 0.08, len / 2, 0xffffff));
  group.add(new THREE.Mesh(mergeParts(headParts), headMat));
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x550000 });
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, 0.2, 0.08), tailMat);
  tailBar.position.set(0, s.bodyY + 0.1, -len / 2 - 0.01);
  group.add(tailBar);
  let lightBar = null;
  if (type === 'police') {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.42, s.bodyY + s.bodyH / 2 + 0.68, s.cabZ);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.42, s.bodyY + s.bodyH / 2 + 0.68, s.cabZ);
    group.add(red);
    group.add(blue);
    lightBar = { red, blue };
  }
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshLambertMaterial({ color: 0x555555, transparent: true, opacity: 0.55 }));
  smoke.position.set(0, 1.6, len / 2 - 0.4);
  smoke.visible = false;
  group.add(smoke);
  group.userData = { spec, length: len };
  return { group, wheels, lightBar, smoke, tailMats: [tailMat] };
}

export function createVehicle(scene, type, x, z, heading, opts = {}) {
  const color = opts.color ?? CAR_TYPES[type].color;
  const built = createCarMesh(type, color);
  built.group.position.set(x, 0, z);
  built.group.rotation.y = heading;
  scene.add(built.group);
  const vehicle = {
    mesh: built.group, wheels: built.wheels, lightBar: built.lightBar, smoke: built.smoke, tailMats: built.tailMats,
    kind: 'car', type, spec: CAR_TYPES[type],
    x, z, heading, speed: 0, steer: 0, braking: false, health: TUNING.carMaxHealth,
    driver: opts.driver || 'traffic', seg: opts.seg ?? 0, segDir: opts.segDir ?? 1, s: opts.s ?? 0,
    cruiseSpeed: opts.cruiseSpeed ?? 12, stopTimer: 0, honkTimer: 0, wrecked: false, isPlayerCar: false,
    flashTimer: 0,
    mass: opts.driver === 'police' ? 0.1 : opts.driver === 'traffic' ? 0.5 : 1,
  };
  built.group.userData.ref = vehicle;
  return vehicle;
}

export function updateVehicleMesh(car, dt, time) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = (car.speed * dt) / 0.46;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
  if (car.lightBar) {
    const on = Math.floor(time * 4) % 2 === 0;
    car.lightBar.red.material.color.setHex(on ? 0xff2222 : 0x550000);
    car.lightBar.blue.material.color.setHex(on ? 0x113366 : 0x2266ff);
  }
  const brakeGlow = car.isPlayerCar && car.braking;
  for (const tailMat of car.tailMats || []) tailMat.emissive.setHex(brakeGlow ? 0xff2211 : 0x550000);
  const smoking = car.health < 45 && !car.wrecked;
  car.smoke.visible = smoking || car.wrecked;
  if (car.smoke.visible) {
    const pulse = 0.8 + Math.sin(time * 6) * 0.25;
    car.smoke.scale.set(pulse, pulse * 1.3, pulse);
  }
  car.mesh.rotation.z = -car.steer * 0.04 * Math.min(1, Math.abs(car.speed) / 20);
}

export function stepPlayerCar(car, input, dt, ctx) {
  const spec = car.spec;
  const gas = input.isDown('KeyW') || input.isDown('ArrowUp');
  const reverse = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const handbrake = input.isDown('Space');
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.braking = reverse || handbrake;

  if (gas) car.speed += spec.accel * dt;
  if (reverse) car.speed -= (car.speed > 1 ? spec.accel * 1.4 : spec.accel * 0.5) * dt;
  if (!gas && !reverse) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = Math.max(-12, Math.min(spec.topSpeed, car.speed));

  const gripFactor = Math.min(1, Math.abs(car.speed) / 14);
  const steerAmount = car.steer * spec.grip * 0.8 * (0.6 + 0.4 * gripFactor) * Math.sign(car.speed);
  car.heading += steerAmount * dt * (handbrake ? 1.6 : 1);

  const dir = forwardOf(car.heading);
  car.x += dir.x * car.speed * dt;
  car.z += dir.z * car.speed * dt;

  const resolved = resolveCircleVsColliders(car.x, car.z, TUNING.carRadius, ctx.world.colliders);
  if (resolved.hit) {
    if (!car.wallContact && Math.abs(car.speed) > 9 && ctx.time - (car.lastWallHitAt || -999) > 0.5) {
      ctx.audio.impact(Math.abs(car.speed) / 40);
      ctx.fx.spawnSparks(car.x, car.z);
      car.health -= Math.abs(car.speed) * 0.25;
      car.lastWallHitAt = ctx.time;
      if (Math.abs(car.speed) > 18) ctx.addCrime(6, 'crash');
    }
    car.speed *= 0.65;
  }
  car.wallContact = resolved.hit;
  car.x = resolved.x;
  car.z = resolved.z;
  const land = clampToLand(car.x, car.z, TUNING.carRadius);
  if (!land.onLand) {
    car.x = land.x;
    car.z = land.z;
    car.speed *= 0.6;
  }
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = 0;
    ctx.hud.toast('Your car is wrecked. Get out and find another ride.');
  }
  if (handbrake && Math.abs(car.speed) > 10) {
    ctx.fx.addSkid(car.x, car.z, car.heading);
    ctx.fx.spawnSmoke(car.x, car.z);
  }
  ctx.audio.setEngine(Math.abs(car.speed) / spec.topSpeed, true);
}

function scanAhead(car, ctx) {
  const ahead = forwardOf(car.heading);
  for (const other of ctx.vehicles) {
    if (other === car || other.driver !== 'traffic' || other.health <= 0) continue;
    if (other.seg !== car.seg || other.segDir !== car.segDir) continue;
    const gap = (other.s - car.s) * car.segDir;
    if (gap > 0 && gap < 13) return true;
  }
  for (const ped of ctx.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - car.x;
    const dz = ped.z - car.z;
    const along = dx * ahead.x + dz * ahead.z;
    const side = Math.abs(dx * ahead.z - dz * ahead.x);
    if (along > 0 && along < 9 && side < 3) return true;
  }
  const pc = ctx.playerCar;
  if (pc && car.driver === 'traffic') {
    const dx = pc.x - car.x;
    const dz = pc.z - car.z;
    const along = dx * ahead.x + dz * ahead.z;
    const side = Math.abs(dx * ahead.z - dz * ahead.x);
    if (along < 0 && along > -12 && side < 4) car.boostTimer = 1;
    if (along > -2 && along < 14 && side < 5.5) return true;
  }
  return false;
}

export function stepTrafficCar(car, dt, ctx) {
  if (car.health <= 0) {
    car.speed = Math.max(0, car.speed - 20 * dt);
  } else {
    const seg = ctx.world.segments[car.seg];
    const blocked = scanAhead(car, ctx);
    car.boostTimer = Math.max(0, (car.boostTimer || 0) - dt);
    const nearEnd = car.segDir > 0 ? seg.length - car.s : car.s;
    const target = blocked ? 0 : (car.cruiseSpeed + (car.boostTimer > 0 ? 6 : 0)) * (nearEnd < 18 ? 0.55 : 1);
    const accel = target > car.speed ? 8 : 22;
    car.speed += Math.max(-accel * dt, Math.min(accel * dt, target - car.speed));
    if (blocked) {
      car.stopTimer += dt;
      if (car.stopTimer > 3 && car.honkTimer <= 0) {
        ctx.audio.honk();
        car.honkTimer = 6;
        car.stopTimer = 0;
      }
    } else {
      car.stopTimer = 0;
    }
    car.honkTimer = Math.max(0, car.honkTimer - dt);
    car.s += car.segDir * car.speed * dt;
    if ((car.segDir > 0 && car.s >= seg.length) || (car.segDir < 0 && car.s <= 0)) pickNextSegment(car, ctx);
  }
  const seg = ctx.world.segments[car.seg];
  const point = segmentPoint(seg, car.s);
  const side = car.segDir * 2.2;
  if (seg.axis === 'x') {
    car.x = point.x;
    car.z = point.z + side;
  } else {
    car.x = point.x - side;
    car.z = point.z;
  }
  car.heading = headingFor(seg.axis, car.segDir);
}

export function pickNextSegment(car, ctx) {
  const seg = ctx.world.segments[car.seg];
  const end = segmentEndPoint(seg, car.segDir);
  const key = `${end.x},${end.z}`;
  const options = (ctx.world.byEnd.get(key) || []).filter((i) => i !== car.seg);
  if (options.length === 0) {
    car.segDir = -car.segDir;
    car.s = car.segDir > 0 ? 0 : seg.length;
    return;
  }
  const next = options[Math.floor(Math.random() * options.length)];
  const nextSeg = ctx.world.segments[next];
  const entersAtStart = nextSeg.x1 === end.x && nextSeg.z1 === end.z;
  car.seg = next;
  car.segDir = entersAtStart ? 1 : -1;
  car.s = entersAtStart ? 0 : nextSeg.length;
}

export function resolveCarCollisions(vehicles, ctx) {
  for (let i = 0; i < vehicles.length; i += 1) {
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const a = vehicles[i];
      const b = vehicles[j];
      const policeVsPlayer = (a.driver === 'police' && b.isPlayerCar) || (b.driver === 'police' && a.isPlayerCar);
      if (policeVsPlayer) continue;
      const d = dist2D(a.x, a.z, b.x, b.z);
      const min = TUNING.carRadius * 2 - 0.4;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = (b.x - a.x) / d;
        const nz = (b.z - a.z) / d;
        const totalMass = a.mass + b.mass;
        a.x -= nx * push * 2 * (b.mass / totalMass);
        a.z -= nz * push * 2 * (a.mass / totalMass);
        b.x += nx * push * 2 * (a.mass / totalMass);
        b.z += nz * push * 2 * (a.mass / totalMass);
        const relSpeed = Math.abs(a.speed - b.speed);
        if (relSpeed > 6) {
          ctx.audio.impact(relSpeed / 40);
          if (relSpeed > 20 && (a.isPlayerCar || b.isPlayerCar)) ctx.addCrime(3, 'crash');
          const lastBump = Math.max(a.lastBumpAt || 0, b.lastBumpAt || 0);
          if (ctx.time - lastBump > 0.5) {
            a.health -= relSpeed * 0.22;
            b.health -= relSpeed * 0.22;
            a.lastBumpAt = ctx.time;
            b.lastBumpAt = ctx.time;
          }
        }
        a.speed *= 0.95;
        b.speed *= 0.95;
      }
    }
  }
}

export function createPedestrian(scene, rng, world, x, z) {
  const shirt = rng.pick(PED_SHIRTS);
  const mesh = new THREE.Mesh(
    mergeParts([
      boxPart(0.7, 1.1, 0.45, 0, 1.05, 0, shirt),
      { geo: new THREE.SphereGeometry(0.21, 10, 8), matrix: xform({ y: 1.78 }), color: 0xd8a878 },
      boxPart(0.55, 0.5, 0.35, 0, 0.25, 0, 0x2a2f36),
    ]),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  mesh.castShadow = true;
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const seg = Math.floor(rng.next() * world.segments.length);
  const ped = {
    mesh,
    kind: 'ped',
    x,
    z,
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(1.2, 2),
    seg,
    segDir: rng.chance(0.5) ? 1 : -1,
    s: rng.range(0, world.segments[seg].length),
    state: 'walk',
    stateTimer: 0,
    downTimer: 0,
    walkPhase: rng.range(0, Math.PI * 2),
  };
  mesh.userData.ref = ped;
  return ped;
}

function walkRoad(ped, dt, ctx) {
  const seg = ctx.world.segments[ped.seg];
  ped.s += ped.segDir * ped.speed * dt;
  if ((ped.segDir > 0 && ped.s >= seg.length) || (ped.segDir < 0 && ped.s <= 0)) {
    const end = segmentEndPoint(seg, ped.segDir);
    const key = `${end.x},${end.z}`;
    const options = (ctx.world.byEnd.get(key) || []).filter((i) => i !== ped.seg);
    if (options.length > 0) {
      const next = options[Math.floor(Math.random() * options.length)];
      const nextSeg = ctx.world.segments[next];
      const entersAtStart = nextSeg.x1 === end.x && nextSeg.z1 === end.z;
      ped.seg = next;
      ped.segDir = entersAtStart ? 1 : -1;
      ped.s = entersAtStart ? 0 : nextSeg.length;
    } else {
      ped.segDir = -ped.segDir;
      ped.s = ped.segDir > 0 ? 0 : seg.length;
    }
  }
  const point = segmentPoint(ctx.world.segments[ped.seg], ped.s);
  const side = ped.segDir * 6;
  if (seg.axis === 'x') {
    ped.x = point.x;
    ped.z = point.z + side;
  } else {
    ped.x = point.x - side;
    ped.z = point.z;
  }
  ped.heading = headingFor(seg.axis, ped.segDir);
}

export function stepPedestrian(ped, dt, ctx) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      const seg = Math.floor(Math.random() * ctx.world.segments.length);
      const point = segmentPoint(ctx.world.segments[seg], Math.random() * ctx.world.segments[seg].length);
      ped.x = point.x;
      ped.z = point.z;
      ped.seg = seg;
      ped.s = Math.random() * ctx.world.segments[seg].length;
      ped.state = 'walk';
      ped.mesh.rotation.x = 0;
      ped.mesh.visible = true;
    }
    return;
  }
  const playerPos = ctx.playerPosition();
  const threat = dist2D(ped.x, ped.z, playerPos.x, playerPos.z);
  const playerSpeed = ctx.playerSpeed();
  if (ped.state === 'walk' && ((threat < 9 && playerSpeed > 12) || (ctx.lastGunshotAt > 0 && ctx.time - ctx.lastGunshotAt < 2 && threat < 45))) {
    ped.state = 'flee';
    ped.stateTimer = 3;
  }
  if (ped.state === 'flee') {
    ped.stateTimer -= dt;
    const dx = ped.x - playerPos.x;
    const dz = ped.z - playerPos.z;
    const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
    ped.heading = Math.atan2(dx / d, dz / d);
    ped.x += (dx / d) * 7 * dt;
    ped.z += (dz / d) * 7 * dt;
    const land = clampToLand(ped.x, ped.z, 0.5);
    ped.x = land.x;
    ped.z = land.z;
    if (ped.stateTimer <= 0) ped.state = 'walk';
  } else {
    walkRoad(ped, dt, ctx);
  }
  ped.walkPhase += dt * (ped.state === 'flee' ? 12 : 6);
  ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase)) * 0.08, ped.z);
  ped.mesh.rotation.y = ped.heading;
}

export function knockPedestrianDown(ped) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downTimer = 5;
  ped.mesh.rotation.x = Math.PI / 2;
  ped.mesh.position.y = 0.4;
}
