import * as THREE from 'three';
import { COLORS } from './config.js';
import { cloudTexture, glowTexture } from './textures.js';

const SUN_DIR = new THREE.Vector3(-0.92, 0.16, -0.03).normalize();

function makeSkyDome() {
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
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        col = mix(band, col, smoothstep(0.02, 0.28, h));
        float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 90.0);
        col += sunColor * sun * 1.2;
        float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 4.0);
        col += sunColor * glow * 0.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
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
  const sky = makeSkyDome();
  scene.add(sky);

  {
    const envScene = new THREE.Scene();
    envScene.add(makeSkyDome());
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
  function sunGlow(color, opacity, size) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity, depthWrite: false, fog: false,
    }));
    sprite.position.copy(SUN_DIR).multiplyScalar(1250);
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
    return sprite;
  }
  const sunSprite = sunGlow(0xffb060, 0.95, 360);
  const sunCore = sunGlow(0xfff2c8, 1, 150);
  const cloudTex = cloudTexture();
  const clouds = [];
  const cloudSpots = [
    [-700, 320, -500, 420], [500, 380, -700, 520], [-200, 300, 800, 380],
    [800, 340, 500, 460], [-900, 360, 300, 400], [200, 420, -900, 560],
    [0, 300, -1000, 480], [-500, 400, -850, 420], [950, 300, -250, 380],
    [-350, 340, 950, 440], [650, 380, 850, 420], [100, 320, 1100, 500],
    [-150, 360, -300, 360], [350, 330, 250, 400],
  ];
  for (const [x, y, z, s] of cloudSpots) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xff8a80, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
    cloud.position.set(x, y, z);
    cloud.scale.set(s * 0.5, s * 0.25, 1);
    scene.add(cloud);
    clouds.push({ sprite: cloud, speed: 1.5 + Math.random() * 1.5 });
  }

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
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let shotCamera = null;

  const api = {
    scene,
    camera,
    renderer,
    /** A fixed camera for screenshot poses; null returns to the follow camera. */
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
      for (const skid of skids) {
        if (!skid.mesh.visible) continue;
        skid.life -= dt;
        skid.mesh.material.opacity = Math.max(0, (skid.life / 9) * 0.55);
        if (skid.life <= 0) skid.mesh.visible = false;
      }
      for (const puff of smokes) {
        if (!puff.sprite.visible) continue;
        puff.life -= dt;
        const grow = 1 + (0.9 - Math.max(0, puff.life)) * 6;
        puff.sprite.scale.set(grow * 2, grow * 2, 1);
        puff.sprite.material.opacity = Math.max(0, puff.life / 0.9) * 0.5;
        if (puff.life <= 0) puff.sprite.visible = false;
      }
    },
    updateEnvironment(dt, world) {
      if (world && world.waterTex) {
        world.waterTex.offset.x += dt * 0.004;
        world.waterTex.offset.y += dt * 0.002;
      }
      for (const cloud of clouds) {
        cloud.sprite.position.x += cloud.speed * dt;
        if (cloud.sprite.position.x > 1300) cloud.sprite.position.x = -1300;
      }
    },
    /** GTA-style follow camera: low and close behind the car, over the shoulder on foot. */
    updateCamera(dt, game) {
      if (shotCamera) {
        camera.position.copy(shotCamera.position);
        camera.lookAt(shotCamera.lookAt);
        return;
      }
      const targetFov = 66 + (game.playerInCar ? Math.min(1, Math.abs(game.playerCar.speed) / 40) * 12 : 0);
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      }
      const desired = new THREE.Vector3();
      const lookAt = new THREE.Vector3();
      if (game.playerInCar && game.playerCar) {
        const car = game.playerCar;
        const fx = Math.sin(car.heading);
        const fz = Math.cos(car.heading);
        desired.set(car.x - fx * 6.5, 2.3, car.z - fz * 6.5);
        lookAt.set(car.x + fx * 10, 1.2, car.z + fz * 10);
      } else {
        const p = game.player;
        const yaw = p.cameraYaw;
        const pitch = p.cameraPitch;
        const dist = 4.2;
        const cx = Math.sin(yaw) * Math.cos(pitch);
        const cz = Math.cos(yaw) * Math.cos(pitch);
        desired.set(p.x + cx * dist, p.y + 1.6 + Math.sin(pitch) * dist, p.z + cz * dist);
        lookAt.set(p.x - Math.sin(yaw) * 2, p.y + 1.6, p.z - Math.cos(yaw) * 2);
      }
      const k = 1 - Math.exp(-dt * 5);
      camera.position.lerp(desired, k);
      camera.position.y = Math.max(camera.position.y, 1.2);
      camera.lookAt(lookAt);
      const anchor = game.playerPosition();
      sun.position.set(anchor.x + SUN_DIR.x * 320, SUN_DIR.y * 320, anchor.z + SUN_DIR.z * 320);
      sun.target.position.set(anchor.x, 0, anchor.z);
    },
    /** Night for the neon downtown shot: dark sky, dim cool light, lamps and neon pop. */
    setNight(on) {
      const u = sky.material.uniforms;
      u.top.value.setHex(on ? 0x0d1230 : COLORS.skyTop);
      u.horizon.value.setHex(on ? 0x2a1a4a : COLORS.skyHorizon);
      u.band.value.setHex(on ? 0x1a1030 : COLORS.skyBand);
      u.sunColor.value.setHex(on ? 0x8a9ac0 : COLORS.sun);
      scene.fog.color.setHex(on ? 0x141428 : 0xe89a72);
      sun.intensity = on ? 0.5 : 2.8;
      sun.color.setHex(on ? 0x8a9ac8 : 0xffb070);
      sun.castShadow = !on; // no long black shadows at night
      hemi.intensity = on ? 0.35 : 0.9;
      sunSprite.visible = !on;
      sunCore.visible = !on;
      for (const c of clouds) c.sprite.material.opacity = on ? 0.18 : 0.45;
      renderer.toneMappingExposure = on ? 1.0 : 1.15;
    },
    render() {
      renderer.render(scene, camera);
    },
  };
  return api;
}
