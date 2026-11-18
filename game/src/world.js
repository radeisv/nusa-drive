import * as THREE from 'three';
import { WORLD } from './config.js';
import {
  facadeMaterial,
  glowTexture,
  grassTexture,
  neonTexture,
  plazaTexture,
  roadTexture,
  runwayTexture,
  sandTexture,
  signTexture,
  waterTexture,
} from './textures.js';
import { boxPart, geoPart, mergeParts, unitBoxPart, xform } from './merge.js';

const LAND_RECTS = [
  [-320, 320, -320, 320],
  [320, 560, -10, 10],
  [560, 920, -220, 220],
];

export function isOnLand(x, z) {
  for (const [minX, maxX, minZ, maxZ] of LAND_RECTS) {
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
  }
  return false;
}

export function clampToLand(x, z, radius) {
  if (isOnLand(x, z)) return { x, z, onLand: true };
  let best = null;
  let bestDist = Infinity;
  for (const [minX, maxX, minZ, maxZ] of LAND_RECTS) {
    const cx = Math.max(minX + radius, Math.min(maxX - radius, x));
    const cz = Math.max(minZ + radius, Math.min(maxZ - radius, z));
    const dx = cx - x;
    const dz = cz - z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) { bestDist = d; best = { x: cx, z: cz }; }
  }
  return { x: best.x, z: best.z, onLand: false };
}

export function buildRoadSegments() {
  const segments = [];
  const add = (x1, z1, x2, z2) => {
    segments.push({ x1, z1, x2, z2, axis: x1 === x2 ? 'z' : 'x', length: Math.abs(x2 - x1) + Math.abs(z2 - z1) });
  };
  for (const line of WORLD.gridLines) {
    add(line, -300, line, 300);
    add(-300, line, 300, line);
  }
  const extraRoads = [
    [-300, -300, 300, -300], [-300, 300, 300, 300], [-300, -300, -300, 300],
    [300, -300, 300, 300], [-300, 290, 300, 290], [320, 0, 560, 0], [560, 0, 600, 0],
    [600, -200, 600, 200], [880, -200, 880, 200], [600, -200, 880, -200],
    [600, 200, 880, 200], [740, 0, 740, 100],
  ];
  for (const [x1, z1, x2, z2] of extraRoads) add(x1, z1, x2, z2);
  const byEnd = new Map();
  const key = (x, z) => `${x},${z}`;
  segments.forEach((seg, i) => {
    for (const [x, z] of [[seg.x1, seg.z1], [seg.x2, seg.z2]]) {
      const k = key(x, z);
      if (!byEnd.has(k)) byEnd.set(k, []);
      byEnd.get(k).push(i);
    }
  });
  return { segments, byEnd };
}

export function segmentPoint(seg, s) {
  const t = Math.max(0, Math.min(1, s / seg.length));
  return { x: seg.x1 + (seg.x2 - seg.x1) * t, z: seg.z1 + (seg.z2 - seg.z1) * t };
}

export function segmentEndPoint(seg, dir) {
  return dir > 0 ? { x: seg.x2, z: seg.z2 } : { x: seg.x1, z: seg.z1 };
}

function signPlane(parts, w, h, x, y, z, ry) {
  parts.push({ geo: new THREE.PlaneGeometry(w, h), matrix: xform({ x, y, z, ry }), color: 0xffffff });
}

function signSpot(bx, bz, w, d, off, faceX) {
  const ry = faceX ? (bx > 0 ? -Math.PI / 2 : Math.PI / 2) : (bz > 0 ? Math.PI : 0);
  return [faceX ? bx + (bx > 0 ? -w / 2 - off : w / 2 + off) : bx, faceX ? bz : bz + (bz > 0 ? -d / 2 - off : d / 2 + off), ry];
}

export function buildWorld(scene, rng) {
  const colliders = [];
  const addCollider = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ });
  const waterTex = waterTexture();
  const roadTexX = roadTexture('x');
  const roadTexZ = roadTexture('z');
  const runwayTex = runwayTexture();
  runwayTex.repeat.set(4, 1);
  const grassTex = grassTexture();
  const sandTex = sandTexture();

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshLambertMaterial({ map: waterTex }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1;
  scene.add(sea);

  const mainGround = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), new THREE.MeshLambertMaterial({ map: grassTex }));
  mainGround.rotation.x = -Math.PI / 2;
  mainGround.position.y = 0.01;
  mainGround.receiveShadow = true;
  scene.add(mainGround);

  const airportGround = new THREE.Mesh(new THREE.PlaneGeometry(360, 440), new THREE.MeshLambertMaterial({ map: grassTex }));
  airportGround.rotation.x = -Math.PI / 2;
  airportGround.position.set(740, 0.01, 0);
  airportGround.receiveShadow = true;
  scene.add(airportGround);

  const beach = new THREE.Mesh(new THREE.PlaneGeometry(640, 38), new THREE.MeshLambertMaterial({ map: sandTex }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.03, -301);
  beach.receiveShadow = true;
  scene.add(beach);

  const { segments, byEnd } = buildRoadSegments();
  const roadPartsX = [];
  const roadPartsZ = [];
  for (const seg of segments) {
    const length = seg.length;
    const isBridgeRoad = seg.axis === 'x' && seg.z1 === 0 && seg.x1 >= 320;
    const width = isBridgeRoad ? 20 : WORLD.roadWidth;
    const geo = new THREE.PlaneGeometry(seg.axis === 'x' ? length : width, seg.axis === 'x' ? width : length);
    const matrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
      .setPosition((seg.x1 + seg.x2) / 2, isBridgeRoad ? 0.05 : 0.04, (seg.z1 + seg.z2) / 2);
    const part = { geo, matrix, color: 0xffffff, uvScale: seg.axis === 'x' ? [length / 16, 1] : [1, length / 16] };
    if (seg.axis === 'x') roadPartsX.push(part);
    else roadPartsZ.push(part);
  }
  for (const [parts, tex] of [[roadPartsX, roadTexX], [roadPartsZ, roadTexZ]]) {
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshPhongMaterial({ map: tex, shininess: 90, specular: 0x997755 }));
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const crossParts = [];
  for (const ix of WORLD.gridLines) {
    for (const iz of WORLD.gridLines) {
      if (((ix + iz) / 60) % 2 !== 0) continue;
      for (const off of [-4.4, -2.2, 0, 2.2, 4.4]) {
        for (const [w, h, x, z] of [[3.6, 0.7, ix - 8, iz + off], [0.7, 3.6, ix + off, iz - 8]]) {
          crossParts.push({
            geo: new THREE.PlaneGeometry(w, h),
            matrix: new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(x, 0.07, z),
            color: 0xffffff,
          });
        }
      }
    }
  }
  scene.add(new THREE.Mesh(mergeParts(crossParts), new THREE.MeshBasicMaterial({ vertexColors: true })));

  const bridgeParts = [boxPart(240, 0.6, 20, 440, -0.3, 0, 0x55585e)];
  for (const side of [-1, 1]) {
    bridgeParts.push(boxPart(210, 1.2, 0.4, 440, 1, side * 10, 0xd8d8c8));
    addCollider(335, 545, side * 10 - 0.5, side * 10 + 0.5);
  }
  for (const px of [400, 480]) {
    bridgeParts.push(boxPart(3.4, 2, 26, px, 30, 0, 0xe8e4da));
    for (const side of [-1, 1]) {
      bridgeParts.push(boxPart(3, 34, 3, px, 17, side * 11, 0xe8e4da));
      for (const dx of [-28, -14, 14, 28]) {
        const top = new THREE.Vector3(px, 30, side * 11);
        const bottom = new THREE.Vector3(px + dx, 1.2, side * 9.5);
        const dir = bottom.clone().sub(top);
        const len = dir.length();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        const m = new THREE.Matrix4().compose(top.clone().lerp(bottom, 0.5), quat, new THREE.Vector3(1, 1, 1));
        bridgeParts.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, len, 5), matrix: m, color: 0x8a9096 });
      }
    }
  }
  const bridge = new THREE.Mesh(mergeParts(bridgeParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  bridge.receiveShadow = true;
  scene.add(bridge);

  const halfRoad = WORLD.roadWidth / 2 + 3;
  const lines = [-300, ...WORLD.gridLines, 300];
  const facadeParts = [[], [], [], []];
  const capParts = [];
  const roofParts = [];
  const parkParts = [];
  const trunkParts = [];
  const foliageParts = [];
  const signParts = [[], [], [], []];
  let buildingCount = 0;
  for (let ix = 0; ix < lines.length - 1; ix += 1) {
    for (let iz = 0; iz < lines.length - 1; iz += 1) {
      const x0 = lines[ix] + halfRoad;
      const x1 = lines[ix + 1] - halfRoad;
      const z0 = lines[iz] + halfRoad;
      const z1 = lines[iz + 1] - halfRoad;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (Math.abs(cx) < 40 && Math.abs(cz - 50) < 40) continue; // keep plaza clear
      if (cz > 275) continue; // keep marina road clear
      if (rng.chance(0.12)) { // a park instead of a building
        parkParts.push({ geo: new THREE.PlaneGeometry(x1 - x0, z1 - z0), matrix: new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(cx, 0.05, cz), color: 0x3a6a30 });
        plantTrees(trunkParts, foliageParts, rng, cx, cz, (x1 - x0) / 2 - 4, 5);
        continue;
      }
      const downtown = Math.abs(cx) < 170 && Math.abs(cz) < 170;
      const count = downtown ? 2 : rng.chance(0.5) ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const wMax = count === 1 ? Math.min(30, x1 - x0 - 4) : Math.min(20, x1 - x0 - 4);
        const w = rng.range(12, Math.max(13, wMax));
        const d = rng.range(12, Math.min(20, z1 - z0 - 4));
        const bx = count === 1 ? cx : x0 + w / 2 + rng.range(0, Math.max(0, x1 - x0 - w - 2));
        const bz = count === 1 ? cz : z0 + d / 2 + rng.range(0, Math.max(0, z1 - z0 - d - 2));
        const h = downtown ? rng.range(45, 110) : rng.range(8, 26);
        const variant = Math.floor(rng.next() * 4);
        const rx = Math.max(1, Math.min(6, Math.round(w / 16)));
        const ry = Math.max(1, Math.min(8, Math.round(h / 16)));
        facadeParts[variant].push(unitBoxPart(w, h, d, bx, h / 2, bz, [rx, ry]));
        capParts.push(boxPart(w + 0.6, 0.8, d + 0.6, bx, h + 0.4, bz, 0x3a3f45));
        if (downtown && h > 45 && rng.chance(0.7)) {
          facadeParts[variant].push(unitBoxPart(w * 0.55, 8, d * 0.55, bx, h + 4.8, bz, [1, 1]));
        }
        if (rng.chance(0.55)) {
          roofParts.push(boxPart(rng.range(2, 4), 1.2, rng.range(2, 3), bx + rng.range(-w / 4, w / 4), h + 1.4, bz + rng.range(-d / 4, d / 4), 0x6a7076));
        }
        if (downtown && rng.chance(0.3)) {
          roofParts.push({ geo: new THREE.CylinderGeometry(1.6, 1.6, 2.6, 10), matrix: xform({ x: bx + w / 4, y: h + 2.1, z: bz - d / 4 }), color: 0x7a6a52 });
        }
        if (downtown && rng.chance(0.35)) {
          const ah = rng.range(6, 12);
          roofParts.push({ geo: new THREE.CylinderGeometry(0.12, 0.2, ah, 6), matrix: xform({ x: bx - w / 4, y: h + 4, z: bz + d / 4 }), color: 0x33383e });
          roofParts.push({ geo: new THREE.SphereGeometry(0.3, 6, 6), matrix: xform({ x: bx - w / 4, y: h + 4 + ah / 2, z: bz + d / 4 }), color: 0xff4444 });
        }
        if (downtown && h > 55 && rng.chance(0.45)) {
          const shop = Math.floor(rng.next() * 4);
          const [px, pz, ry] = signSpot(bx, bz, w, d, 0.4, Math.abs(bx) > Math.abs(bz));
          signPlane(signParts[shop], 12, 3, px, h + 2.2, pz, ry);
        }
        if (!downtown && h < 30 && rng.chance(0.5) && (Math.abs(bx) < 55 || Math.abs(bz) < 55)) {
          const shop = Math.floor(rng.next() * 4);
          const [px, pz, ry] = signSpot(bx, bz, w, d, 0.15, Math.abs(bx) < 55 && Math.abs(bx) <= Math.abs(bz));
          signPlane(signParts[shop], 8, 1.6, px, 3.4, pz, ry);
        }
        addCollider(bx - w / 2, bx + w / 2, bz - d / 2, bz + d / 2);
        buildingCount += 1;
      }
    }
  }
  for (let v = 0; v < 4; v += 1) {
    if (facadeParts[v].length === 0) continue;
    const mesh = new THREE.Mesh(mergeParts(facadeParts[v]), facadeMaterial(v));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  scene.add(new THREE.Mesh(mergeParts(capParts), new THREE.MeshLambertMaterial({ vertexColors: true })));
  scene.add(new THREE.Mesh(mergeParts(roofParts), new THREE.MeshLambertMaterial({ vertexColors: true })));
  if (parkParts.length > 0) {
    const parks = new THREE.Mesh(mergeParts(parkParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
    parks.receiveShadow = true;
    scene.add(parks);
  }
  const signAtlas = signTexture();
  for (let s = 0; s < 4; s += 1) {
    if (signParts[s].length === 0) continue;
    const tex = signAtlas.clone();
    tex.needsUpdate = true;
    tex.repeat.set(0.25, 1);
    tex.offset.set(s * 0.25, 0);
    scene.add(new THREE.Mesh(mergeParts(signParts[s]), new THREE.MeshBasicMaterial({ map: tex })));
  }

  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshLambertMaterial({ map: plazaTexture() }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.05, 50);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0x7fb8d8 }));
  fountain.position.set(0, 0.6, 50);
  scene.add(fountain);
  const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.25, 20), new THREE.MeshPhongMaterial({ color: 0x4a90c2, shininess: 120, specular: 0xaaddff }));
  fountainWater.position.set(0, 1.15, 50);
  scene.add(fountainWater);
  addCollider(-7, 7, 43, 57);

  const furnitureParts = [];
  for (const [bx, bz, ry] of [[-18, 30, 0], [18, 30, 0], [-18, 72, Math.PI], [18, 72, Math.PI]]) {
    furnitureParts.push(boxPart(4, 0.3, 1.2, bx, 0.6, bz, 0x6a4a2a, ry));
    furnitureParts.push(boxPart(4, 1, 0.25, bx, 1.1, bz + (ry === 0 ? -0.6 : 0.6), 0x6a4a2a, ry));
  }
  for (const [bx, bz, ry] of [[-15, 28, 0.5], [14, 31, -0.4]]) {
    furnitureParts.push(boxPart(4, 0.3, 1.2, bx, 0.6, bz, 0x6a4a2a, ry));
    furnitureParts.push(boxPart(4, 1, 0.25, bx, 1.1, bz - 0.6, 0x6a4a2a, ry));
  }
  for (const [px, pz] of [[-26, 50], [26, 50], [-26, 62], [26, 62], [-11, 22], [11, 25]]) {
    furnitureParts.push(boxPart(2.2, 1, 2.2, px, 0.5, pz, 0x8a8f96));
    furnitureParts.push({
      geo: new THREE.SphereGeometry(1.1, 8, 6),
      matrix: xform({ x: px, y: 1.5, z: pz, sy: 0.8 }),
      color: 0x3a7a3a,
    });
  }
  furnitureParts.push({
    geo: new THREE.CylinderGeometry(0.35, 0.4, 1, 8),
    matrix: xform({ x: 24, y: 0.5, z: 38 }),
    color: 0xc23a2a,
  });
  for (const [bx, bz, ry] of [[7, -180, 0], [7, 180, 0], [-180, 7, Math.PI / 2], [180, 7, Math.PI / 2]]) {
    furnitureParts.push(boxPart(3.6, 0.3, 1.1, bx, 0.6, bz, 0x6a4a2a, ry));
    furnitureParts.push(boxPart(3.6, 0.9, 0.22, bx, 1.05, bz - 0.55, 0x6a4a2a, ry));
  }
  scene.add(new THREE.Mesh(mergeParts(furnitureParts), new THREE.MeshLambertMaterial({ vertexColors: true })));

  const poleParts = [];
  const bulbParts = [];
  const propParts = [];
  for (const line of WORLD.gridLines) {
    for (const along of [-240, -120, 0, 120, 240]) {
      for (const [x, z] of [[line, along], [along, line]]) {
        poleParts.push({ geo: new THREE.CylinderGeometry(0.15, 0.2, 6, 6), matrix: xform({ x: x + 6, y: 3, z: z + 6 }), color: 0x22262b });
        bulbParts.push({ geo: new THREE.SphereGeometry(0.38, 8, 6), matrix: xform({ x: x + 6, y: 6.2, z: z + 6 }), color: 0xffe9a8 });
      }
    }
  }
  for (let x = 340; x <= 540; x += 40) {
    for (const side of [-9, 9]) {
      poleParts.push({ geo: new THREE.CylinderGeometry(0.15, 0.2, 6, 6), matrix: xform({ x, y: 3, z: side }), color: 0x22262b });
      bulbParts.push({ geo: new THREE.SphereGeometry(0.5, 8, 6), matrix: xform({ x, y: 6.2, z: side }), color: 0xffe9a8 });
    }
  }
  const lampParts = [];
  const lampGeo = new THREE.SphereGeometry(0.28, 8, 6);
  for (const [ix, iz] of [[-60, -60], [60, -60], [-60, 60], [60, 60], [-120, 0], [120, 0], [0, -120], [0, 120]]) {
    poleParts.push({ geo: new THREE.CylinderGeometry(0.18, 0.24, 7, 6), matrix: xform({ x: ix + 7, y: 3.5, z: iz + 7 }), color: 0x22262b });
    propParts.push(boxPart(6.5, 0.3, 0.3, ix + 4, 6.8, iz + 7, 0x22262b));
    propParts.push(boxPart(0.9, 2.4, 0.5, ix + 1, 5.8, iz + 7, 0x1a1d20));
    propParts.push(boxPart(0.5, 2.4, 0.9, ix + 7, 5.8, iz + 4, 0x1a1d20));
    for (const [hx, hz, dx, dz] of [[ix + 1, iz + 7, 0, 1], [ix + 7, iz + 4, 1, 0]]) {
      lampParts.push({ geo: lampGeo, matrix: xform({ x: hx + dx * 0.3, y: 6.5, z: hz + dz * 0.3 }), color: 0x22cc44 });
      lampParts.push({ geo: lampGeo, matrix: xform({ x: hx - dx * 0.3, y: 6.5, z: hz - dz * 0.3 }), color: 0xcc2222 });
    }
  }
  scene.add(new THREE.Mesh(mergeParts(lampParts), new THREE.MeshBasicMaterial({ vertexColors: true })));

  const glowTex = glowTexture();
  const neonSign = (text, fg, bg, w, h, x, y, z, ry) => {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: neonTexture(text, fg, bg) }));
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    scene.add(sign);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: fg, transparent: true, opacity: 0.32, depthWrite: false }));
    glow.position.set(x, y, z);
    glow.scale.set(w * 1.4, h * 1.8, 1);
    scene.add(glow);
  };
  neonSign('PALM FM', '#ff5aa0', '#2a0a2a', 18, 6, 205, 10, -15, Math.PI / 2);
  propParts.push(boxPart(0.6, 10, 0.6, 194, 5, -15, 0x33383e));
  propParts.push(boxPart(0.6, 10, 0.6, 216, 5, -15, 0x33383e));
  neonSign('CLUB NEON', '#ff2a7a', '#1a0a20', 14, 3.4, 0, 5.8, 64, Math.PI);
  propParts.push(boxPart(0.4, 6, 0.4, -5.5, 3, 64, 0x33383e));
  propParts.push(boxPart(0.4, 6, 0.4, 5.5, 3, 64, 0x33383e));

  for (let a = -280; a <= 280; a += 40) {
    for (const [px, pz] of [[-7, a], [7, a], [a, -7], [a, 7]]) {
      if ((Math.abs(px) === 7 && pz > 20 && pz < 80) || (Math.abs(pz) === 7 && px > -40 && px < 40)) continue;
      trunkParts.push({ geo: new THREE.CylinderGeometry(0.25, 0.4, 7, 6), matrix: xform({ x: px, y: 3.5, z: pz }), color: 0x6a4a2a });
      palmFronds(foliageParts, px, pz, 7.6);
    }
  }
  plantTrees(trunkParts, foliageParts, rng, -200, -300, 180, 14, true);
  plantTrees(trunkParts, foliageParts, rng, 150, -300, 120, 8, true);
  for (const ux of [-160, -40, 90, 210]) {
    poleParts.push({ geo: new THREE.CylinderGeometry(0.12, 0.12, 3, 6), matrix: xform({ x: ux, y: 1.5, z: -302 }), color: 0x22262b });
    propParts.push({ geo: new THREE.ConeGeometry(3, 1.2, 8), matrix: xform({ x: ux, y: 3.4, z: -302 }), color: 0xe86a5a });
  }

  const boatColors = [0xe8e8e8, 0x3a6a8a, 0xc25a3a, 0x4a8a5a];
  for (const dx of [-180, -60, 60, 180]) {
    propParts.push(boxPart(6, 0.8, 26, dx, 0.4, 308, 0x8a6a42));
    const boat = makeBoat(rng.pick(boatColors));
    boat.position.set(dx + 8, 0.4, 312);
    boat.rotation.y = rng.range(0, Math.PI);
    scene.add(boat);
  }

  const runway = new THREE.Mesh(new THREE.PlaneGeometry(260, 26), new THREE.MeshLambertMaterial({ map: runwayTex }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(750, 0.06, -60);
  runway.receiveShadow = true;
  scene.add(runway);
  const lightCount = 44;
  const lightPos = new Float32Array(lightCount * 3);
  for (let i = 0; i < lightCount; i += 1) {
    lightPos[i * 3] = 750 + (-120 + (i % 22) * (240 / 21));
    lightPos[i * 3 + 1] = 0.4;
    lightPos[i * 3 + 2] = i < 22 ? -72.5 : -47.5;
  }
  const lightGeo = new THREE.BufferGeometry();
  lightGeo.setAttribute('position', new THREE.BufferAttribute(lightPos, 3));
  const runwayLights = new THREE.Points(lightGeo, new THREE.PointsMaterial({ color: 0xffc860, size: 0.55, sizeAttenuation: true }));
  runwayLights.frustumCulled = false;
  scene.add(runwayLights);
  poleParts.push({
    geo: new THREE.CylinderGeometry(0.12, 0.15, 6, 6),
    matrix: xform({ x: 700, y: 3, z: -40 }),
    color: 0x22262b,
  });
  propParts.push({
    geo: new THREE.ConeGeometry(0.9, 3.2, 8),
    matrix: xform({ rz: Math.PI / 2, x: 701.6, y: 5.8, z: -40 }),
    color: 0xff7a3c,
  });
  const airportParts = [
    boxPart(90, 16, 30, 740, 8, 80, 0xd8b8a0),
    boxPart(92, 1.2, 32, 740, 16.4, 80, 0x5a4a42),
    boxPart(40, 14, 26, 860, 7, 60, 0xa89078),
    boxPart(30, 10, 0.6, 860, 5, 46.8, 0x3a3038),
    boxPart(26, 3, 3.4, 712, 5.5, 32, 0x9aa4a8, 0.6),
    boxPart(4, 3.4, 4.4, 701, 5.5, 24, 0x6a7478, 0.6),
  ];
  addCollider(695, 785, 65, 95);
  const glassParts = [boxPart(88, 6, 1, 740, 6, 64.5, 0xffc890), boxPart(88, 4, 1, 740, 12, 64.5, 0xffc890)];
  neonSign('NUSA AIR', '#39d0ff', '#0a1a2a', 16, 3, 740, 12, 64.4, Math.PI);
  const TX = 830;
  const TZ = 55;
  const towerParts = [
    { geo: new THREE.CylinderGeometry(3, 4, 30, 10), matrix: xform({ x: TX, y: 15, z: TZ }), color: 0xe8e4da },
    { geo: new THREE.CylinderGeometry(3.4, 3.4, 1.4, 10), matrix: xform({ x: TX, y: 8, z: TZ }), color: 0xc23a2a },
    { geo: new THREE.CylinderGeometry(3.4, 3.4, 1.4, 10), matrix: xform({ x: TX, y: 22, z: TZ }), color: 0xc23a2a },
    { geo: new THREE.CylinderGeometry(5.5, 4.5, 5, 10), matrix: xform({ x: TX, y: 32.5, z: TZ }), color: 0x1a2a33 },
    { geo: new THREE.CylinderGeometry(6, 5.5, 1, 10), matrix: xform({ x: TX, y: 35.5, z: TZ }), color: 0xe8e4da },
    { geo: new THREE.CylinderGeometry(0.12, 0.2, 6, 6), matrix: xform({ x: TX, y: 39, z: TZ }), color: 0x33383e },
    { geo: new THREE.SphereGeometry(0.35, 6, 6), matrix: xform({ x: TX, y: 42, z: TZ }), color: 0xff4444 },
  ];
  addCollider(TX - 6, TX + 6, TZ - 6, TZ + 6);
  addCollider(840, 880, 47, 73);
  const plane1 = makePlane(0xe8e8e8, 0x2a6a9a);
  plane1.position.set(660, 2, -20);
  plane1.rotation.y = 0.4;
  scene.add(plane1);
  addCollider(640, 680, -32, -8);
  const plane2 = makePlane(0xf2e8d8, 0xc25a3a);
  plane2.position.set(790, 2, -30);
  plane2.rotation.y = -0.5;
  scene.add(plane2);
  addCollider(770, 810, -42, -18);

  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 4), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  arrow.position.y = 8;
  arrow.rotation.x = Math.PI;
  beacon.add(arrow);
  beacon.visible = false;
  scene.add(beacon);

  const rings = [[300, -200], [300, 0], [300, 200], [200, 300], [-100, 300]].map(([x, z]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 8, 24), new THREE.MeshBasicMaterial({ color: 0x39d0ff }));
    ring.position.set(x, 3, z);
    ring.visible = false;
    scene.add(ring);
    return { mesh: ring, x, z };
  });

  scene.add(new THREE.Mesh(mergeParts(poleParts), new THREE.MeshLambertMaterial({ color: 0x22262b })));
  scene.add(new THREE.Mesh(mergeParts(bulbParts), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc860 })));
  scene.add(new THREE.Mesh(mergeParts(propParts), new THREE.MeshLambertMaterial({ vertexColors: true })));
  scene.add(new THREE.Mesh(mergeParts(trunkParts), new THREE.MeshLambertMaterial({ color: 0x6a4a2a })));
  const foliage = new THREE.Mesh(mergeParts(foliageParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  foliage.castShadow = true;
  scene.add(foliage);
  const tuftParts = [];
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.55, 4);
  const tuftColors = [0x4a7a34, 0x5d8a3e, 0x6d9a4a, 0x3a6a2a];
  for (let i = 0; i < 460; i += 1) {
    const marina = rng.chance(0.09);
    const line = marina ? 290 : WORLD.gridLines[Math.floor(rng.next() * WORLD.gridLines.length)];
    const along = rng.range(-300, 300);
    const off = (rng.chance(0.5) ? 1 : -1) * (5.8 + rng.next() * 1.8);
    const vertical = marina ? false : rng.chance(0.5);
    const x = vertical ? line + off : along;
    const z = vertical ? along : line + off;
    if (z < -278 || (Math.abs(x) < 40 && Math.abs(z - 50) < 40)) continue;
    if (WORLD.gridLines.some((l) => Math.abs(along - l) < 6.5)) continue;
    tuftParts.push({ geo: tuftGeo, matrix: xform({ x, y: 0.28, z, ry: rng.range(0, 6.28) }), color: tuftColors[Math.floor(rng.next() * 4)] });
  }
  scene.add(new THREE.Mesh(mergeParts(tuftParts), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const airport = new THREE.Mesh(mergeParts(airportParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  airport.castShadow = true;
  scene.add(airport);
  scene.add(new THREE.Mesh(mergeParts(glassParts), new THREE.MeshLambertMaterial({ color: 0xffc890, emissive: 0x662211 })));
  const towerMesh = new THREE.Mesh(mergeParts(towerParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  towerMesh.castShadow = true;
  scene.add(towerMesh);

  return {
    colliders,
    segments,
    byEnd,
    buildingCount,
    beacon,
    rings,
    waterTex,
    landmarks: {
      playerSpawn: { x: 0, z: 40 },
      parkedCar: { x: 8, z: 46 },
      plazaPickup: { x: 10, z: 60 },
      airportCargo: { x: 760, z: 40 },
      marinaPickup: { x: 40, z: 285 },
      hotelDropoff: { x: -40, z: -40 },
      showroomCar: { x: 120, z: 280 },
      marinaGarage: { x: 200, z: 290 },
      terminalCargo: { x: 740, z: 60 },
      hideout: { x: -120, z: 120 },
    },
  };
}

function palmFronds(parts, x, z, topY) {
  const geo = new THREE.ConeGeometry(0.85, 4.2, 4);
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * Math.PI * 2;
    parts.push({
      geo,
      matrix: xform({ x: x - Math.cos(a) * 1.3, y: topY, z: z + Math.sin(a) * 1.3, ry: a, rz: 2.25, sz: 0.45 }),
      color: k % 2 ? 0x2f8a3e : 0x3a9a4a,
    });
  }
}

function plantTrees(trunkParts, foliageParts, rng, cx, cz, halfExtent, count, palm = false) {
  for (let i = 0; i < count; i += 1) {
    const x = cx + rng.range(-halfExtent, halfExtent);
    const z = cz + rng.range(-halfExtent, halfExtent);
    const trunkH = palm ? 7 : 3;
    const tilt = palm ? rng.range(-0.12, 0.12) : 0;
    trunkParts.push({ geo: new THREE.CylinderGeometry(0.25, 0.4, trunkH, 6), matrix: xform({ rz: tilt, x: x + Math.sin(tilt) * trunkH * 0.3, y: trunkH / 2, z }), color: 0x6a4a2a });
    if (palm) palmFronds(foliageParts, x, z, trunkH + 0.6);
    else {
      foliageParts.push({ geo: new THREE.ConeGeometry(2.2, 4, 8), matrix: xform({ x, y: trunkH + 2, z }), color: 0x2f6a2a });
      foliageParts.push({ geo: new THREE.ConeGeometry(1.7, 3, 8), matrix: xform({ x, y: trunkH + 3.6, z }), color: 0x27602a });
    }
  }
}

function makeBoat(color) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 9), new THREE.MeshLambertMaterial({ color }));
  hull.position.y = 0.7;
  group.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 3.4), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  cabin.position.set(0, 2, -1);
  group.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  mast.position.set(0, 4.5, 1);
  group.add(mast);
  return group;
}

function makePlane(bodyColor, stripeColor) {
  const parts = [
    { geo: new THREE.CylinderGeometry(2.2, 2.2, 26, 12), matrix: xform({ rz: Math.PI / 2, y: 2.5 }), color: bodyColor },
    { geo: new THREE.ConeGeometry(2.2, 5, 12), matrix: xform({ rz: -Math.PI / 2, x: 15.5, y: 2.5 }), color: bodyColor },
    boxPart(24, 0.5, 4.5, 0, 2.6, 0, stripeColor),
    boxPart(8, 0.4, 30, 0, 2.2, 0, bodyColor),
    boxPart(4, 5, 0.5, -12, 5, 0, stripeColor),
    boxPart(2.5, 1, 4, 13.5, 3.4, 0, 0x1a2a33),
  ];
  for (const ez of [-5, 5]) {
    parts.push({ geo: new THREE.CylinderGeometry(1, 1, 3.4, 10), matrix: xform({ rz: Math.PI / 2, x: 0.5, y: 1.2, z: ez }), color: 0xd8d8d8 });
  }
  const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  return mesh;
}

export function resolveCircleVsColliders(x, z, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(c.maxX, x));
    const cz = Math.max(c.minZ, Math.min(c.maxZ, z));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        const pushes = [x - c.minX, c.maxX - x, z - c.minZ, c.maxZ - z];
        const min = Math.min(...pushes);
        if (min === pushes[0]) x = c.minX - radius;
        else if (min === pushes[1]) x = c.maxX + radius;
        else if (min === pushes[2]) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  return { x, z, hit };
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
