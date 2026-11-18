import * as THREE from 'three';
import { COLORS } from './config.js';
import { cloudTexture, glowTexture } from './textures.js';
import { mergeParts } from './merge.js';

const SUN_DIR = new THREE.Vector3(-0.92, 0.16, -0.03).normalize();

function skyDome() {
  const geo = new THREE.SphereGeometry(1400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(COLORS.skyTop) },
      horizon: { value: new THREE.Color(COLORS.skyHorizon) },
      band: { value: new THREE.Color(COLORS.skyBand) },
      sunDir: { value: SUN_DIR },
      sunColor: { value: new THREE.Color(COLORS.sun) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 band;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      void main() {
        float y = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(horizon, top, pow(y, 0.6));
        c = mix(band, c, smoothstep(0.03, 0.3, y));
        float s = clamp(dot(normalize(vDir), normalize(sunDir)), 0.0, 1.0);
        c += sunColor * (pow(s, 110.0) * 1.4 + pow(s, 5.0) * 0.35);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

function buildSkyline(scene) {
  const parts = [];
  for (let i = 0; i < 26; i += 1) {
    const a = -0.9 + (i / 25) * 1.8;
    const h = 40 + ((i * 37) % 90);
    const w = 26 + ((i * 53) % 30);
    const px = Math.sin(a) * 1020;
    const pz = Math.cos(a) * 1020;
    parts.push({ geo: new THREE.BoxGeometry(w, h, w), matrix: new THREE.Matrix4().makeRotationY(a).setPosition(px, h / 2 - 4, pz), color: 0x2a1a3a });
  }
  const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshBasicMaterial({ color: 0x2a1a3a, fog: false }));
  scene.add(mesh);
  return mesh;
}

function buildClouds(scene) {
  const tex = cloudTexture();
  const list = [];
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 30; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = 900 + rand() * 500;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd8c8, transparent: true, opacity: 0.6, depthWrite: false, fog: false }));
    sprite.position.set(Math.cos(a) * r, 120 + rand() * 140, Math.sin(a) * r);
    const s = 380 + rand() * 220;
    sprite.scale.set(s * 0.6, s * 0.3, 1);
    scene.add(sprite);
    list.push({ sprite, speed: 1.5 + rand() * 1.5 });
  }
  return list;
}

export function createRenderer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(opts.lowFx ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !opts.lowFx;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe89a72, 260, 1100);
  const sky = skyDome();
  scene.add(sky);

  {
    const envScene = new THREE.Scene();
    envScene.add(skyDome());
    const sunBall = new THREE.Mesh(
      new THREE.SphereGeometry(60, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfffbe8 }),
    );
    sunBall.position.copy(SUN_DIR).multiplyScalar(1200);
    envScene.add(sunBall);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  }

  const glowTex = glowTexture();
  function sunSprite(color, opacity, size) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity, depthWrite: false, fog: false,
    }));
    sprite.position.copy(SUN_DIR).multiplyScalar(1250);
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
    return sprite;
  }
  const sunHalo = sunSprite(0xffb060, 0.95, 520);
  const sunDisc = sunSprite(0xfff2c8, 1, 220);
  const clouds = buildClouds(scene);
  const skyline = buildSkyline(scene);
  const sun = new THREE.DirectionalLight(0xffb070, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 800 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xff9a80, 0x4a3a5a, 0.9);
  scene.add(hemi);

  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 3000);

  const SPARKS = 240;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = [];
  const sparkLife = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i += 1) {
    sparkPos[i * 3 + 1] = -100;
    sparkVel.push(new THREE.Vector3());
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffc860, size: 0.7, sizeAttenuation: true }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sparkCursor = 0;

  const SKIDS = 140;
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.55 });
  const skidGeo = new THREE.PlaneGeometry(0.5, 2.2);
  const skids = [];
  for (let i = 0; i < SKIDS; i += 1) {
    const mesh = new THREE.Mesh(skidGeo, skidMat.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.position.y = 0.06;
    scene.add(mesh);
    skids.push({ mesh, life: 0 });
  }
  let skidCursor = 0;

  const SMOKE = 12;
  const smokes = [];
  for (let i = 0; i < SMOKE; i += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x888888, transparent: true, opacity: 0, depthWrite: false }));
    sprite.visible = false;
    scene.add(sprite);
    smokes.push({ sprite, life: 0 });
  }
  let smokeCursor = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let shotCamera = null;

  function stepSparks(dt) {
    for (let i = 0; i < SPARKS; i += 1) {
      if (sparkLife[i] <= 0) continue;
      sparkLife[i] -= dt;
      sparkVel[i].y -= 18 * dt;
      sparkPos[i * 3] += sparkVel[i].x * dt;
      sparkPos[i * 3 + 1] = Math.max(0.05, sparkPos[i * 3 + 1] + sparkVel[i].y * dt);
      sparkPos[i * 3 + 2] += sparkVel[i].z * dt;
      if (sparkLife[i] <= 0) sparkPos[i * 3 + 1] = -100;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  }

  function stepSkids(dt) {
    for (const skid of skids) {
      if (!skid.mesh.visible) continue;
      skid.life -= dt;
      skid.mesh.material.opacity = Math.max(0, (skid.life / 9) * 0.55);
      if (skid.life <= 0) skid.mesh.visible = false;
    }
  }

  function stepSmoke(dt) {
    for (const puff of smokes) {
      if (!puff.sprite.visible) continue;
      puff.life -= dt;
      const grow = 1 + (0.9 - Math.max(0, puff.life)) * 6;
      puff.sprite.scale.set(grow * 2, grow * 2, 1);
      puff.sprite.material.opacity = Math.max(0, puff.life / 0.9) * 0.5;
      if (puff.life <= 0) puff.sprite.visible = false;
    }
  }

  function followCar(game, out, look) {
    const car = game.playerCar;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    out.set(car.x - fx * 6.2, 2.4, car.z - fz * 6.2);
    look.set(car.x + fx * 10, 1.2, car.z + fz * 10);
  }

  function followOnFoot(game, out, look) {
    const p = game.player;
    const dist = 4.2;
    const cx = Math.sin(p.cameraYaw) * Math.cos(p.cameraPitch);
    const cz = Math.cos(p.cameraYaw) * Math.cos(p.cameraPitch);
    out.set(p.x + cx * dist, p.y + 1.6 + Math.sin(p.cameraPitch) * dist, p.z + cz * dist);
    look.set(p.x - Math.sin(p.cameraYaw) * 2, p.y + 1.6, p.z - Math.cos(p.cameraYaw) * 2);
  }

  const api = {
    scene,
    camera,
    renderer,
    setShotCamera(position, lookAt) {
      shotCamera = position ? { position, lookAt } : null;
    },
    spawnSparks(x, z) {
      for (let n = 0; n < 10; n += 1) {
        const i = sparkCursor;
        sparkCursor = (sparkCursor + 1) % SPARKS;
        sparkPos[i * 3] = x;
        sparkPos[i * 3 + 1] = 0.6;
        sparkPos[i * 3 + 2] = z;
        sparkVel[i].set((Math.random() - 0.5) * 8, Math.random() * 6 + 2, (Math.random() - 0.5) * 8);
        sparkLife[i] = 0.5;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    },
    spawnSmoke(x, z) {
      const puff = smokes[smokeCursor];
      smokeCursor = (smokeCursor + 1) % SMOKE;
      puff.sprite.position.set(x + (Math.random() - 0.5) * 2, 0.8, z + (Math.random() - 0.5) * 2);
      puff.sprite.visible = true;
      puff.sprite.scale.set(2, 2, 1);
      puff.sprite.material.opacity = 0.5;
      puff.life = 0.9;
    },
    addSkid(x, z, heading) {
      const skid = skids[skidCursor];
      skidCursor = (skidCursor + 1) % SKIDS;
      skid.mesh.position.set(x, 0.06, z);
      skid.mesh.rotation.z = -heading;
      skid.mesh.visible = true;
      skid.mesh.material.opacity = 0.55;
      skid.life = 9;
    },
    updateEffects(dt) {
      stepSparks(dt);
      stepSkids(dt);
      stepSmoke(dt);
    },
    updateEnvironment(dt, world) {
      if (world && world.waterTex) {
        world.waterTex.offset.x += dt * 0.004;
        world.waterTex.offset.y += dt * 0.002;
      }
      for (let i = 0; i < clouds.length; i += 1) {
        const cloud = clouds[i];
        cloud.sprite.position.x += cloud.speed * dt;
        if (cloud.sprite.position.x > 1450) cloud.sprite.position.x = -1450;
      }
    },
    updateCamera(dt, game) {
      if (shotCamera) {
        camera.position.copy(shotCamera.position);
        camera.lookAt(shotCamera.lookAt);
        return;
      }
      const boost = game.playerInCar ? Math.min(1, Math.abs(game.playerCar.speed) / 40) * 12 : 0;
      const targetFov = 66 + boost;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      }
      const desired = new THREE.Vector3();
      const lookAt = new THREE.Vector3();
      if (game.playerInCar && game.playerCar) followCar(game, desired, lookAt);
      else followOnFoot(game, desired, lookAt);
      const k = 1 - Math.exp(-dt * 5);
      camera.position.lerp(desired, k);
      camera.position.y = Math.max(camera.position.y, 1.2);
      camera.lookAt(lookAt);
      const anchor = game.playerPosition();
      sun.position.set(anchor.x + SUN_DIR.x * 320, SUN_DIR.y * 320, anchor.z + SUN_DIR.z * 320);
      sun.target.position.set(anchor.x, 0, anchor.z);
    },
    setNight(on) {
      const uni = sky.material.uniforms;
      uni.top.value.setHex(on ? 0x0d1230 : COLORS.skyTop);
      uni.horizon.value.setHex(on ? 0x2a1a4a : COLORS.skyHorizon);
      uni.band.value.setHex(on ? 0x1a1030 : COLORS.skyBand);
      uni.sunColor.value.setHex(on ? 0x8a9ac0 : COLORS.sun);
      scene.fog.color.setHex(on ? 0x141428 : 0xe89a72);
      sun.intensity = on ? 0.5 : 2.8;
      sun.color.setHex(on ? 0x8a9ac8 : 0xffb070);
      sun.castShadow = !on;
      hemi.intensity = on ? 0.35 : 0.9;
      sunHalo.visible = !on;
      sunDisc.visible = !on;
      skyline.visible = !on;
      for (const c of clouds) c.sprite.material.opacity = on ? 0.18 : 0.6;
      renderer.toneMappingExposure = on ? 1.0 : 1.15;
    },
    render() {
      renderer.render(scene, camera);
    },
  };
  return api;
}
