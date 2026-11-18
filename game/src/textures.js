import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

function speckle(g, w, h, count, alpha) {
  for (let i = 0; i < count; i += 1) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

const FACADE_BASES = ['#c8b8a8', '#5a6a8a', '#a87850', '#b8ac96'];
const FACADE_TRIMS = ['#988a78', '#42526a', '#7a5230', '#948868'];

function makeFacadeCanvas(variant) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = FACADE_BASES[variant];
  g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 700, 0.04);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < 256; y += 26) g.fillRect(0, y, 256, 2);
  const WIN_COLORS = [[0.45, '#ffd98a'], [0.62, '#ffb060'], [0.8, '#6a5a8a'], [0.9, '#ff8a6a'], [1, '#2c2438']];
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const x = 8 + col * 42;
      const y = 6 + row * 26;
      const r = Math.random();
      g.fillStyle = WIN_COLORS.find(([t]) => r < t)[1];
      g.fillRect(x, y, 26, 16);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(x + 3, y + 2, 10, 4);
      g.fillRect(x + 14, y + 9, 8, 3);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 8; i += 1) {
    g.fillRect(8 + Math.floor(Math.random() * 6) * 42 - 2, 6 + Math.floor(Math.random() * 10) * 26 + 18, 30, 3);
  }
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 232, 256, 24);
  g.fillStyle = FACADE_TRIMS[variant];
  for (let x = 0; x < 256; x += 32) g.fillRect(x, 226, 16, 6);
  return c;
}

const facadeCanvases = [];
const facadeMats = [];

export function facadeMaterial(variant) {
  if (!facadeMats[variant]) {
    if (!facadeCanvases[variant]) facadeCanvases[variant] = makeFacadeCanvas(variant);
    facadeMats[variant] = new THREE.MeshLambertMaterial({ map: toTexture(facadeCanvases[variant], true) });
  }
  return facadeMats[variant];
}

/** Shop signs: one atlas, 4 neon storefronts, used by billboards and signs. */
const SHOPS = [
  ['CLUB NEON', '#1a0a20', '#ff2a7a'],
  ['KOPI NUSA', '#1a1430', '#ffd23e'],
  ['BENGKEL 7', '#1a1a22', '#ff9a3c'],
  ['SURF & SUN', '#0a2a3a', '#39d0ff'],
];
let signTex = null;
export function signTexture() {
  if (signTex) return signTex;
  const [c, g] = canvas(512, 128);
  SHOPS.forEach(([name, bg, fg], i) => {
    g.fillStyle = bg;
    g.fillRect(i * 128, 0, 128, 128);
    g.fillStyle = fg;
    g.shadowColor = fg;
    g.shadowBlur = 14;
    g.font = 'bold 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const words = name.split(' ');
    if (words.length > 1) {
      g.fillText(words[0], i * 128 + 64, 48);
      g.fillText(words.slice(1).join(' '), i * 128 + 64, 82);
    } else {
      g.fillText(name, i * 128 + 64, 64);
    }
    g.shadowBlur = 0;
    g.strokeStyle = fg;
    g.lineWidth = 3;
    g.strokeRect(i * 128 + 6, 6, 116, 116);
  });
  signTex = toTexture(c, false);
  return signTex;
}

/** One big neon sign (billboard, terminal): glowing text on a dark board. */
export function neonTexture(text, fg, bg) {
  const [c, g] = canvas(512, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.shadowColor = fg;
  g.shadowBlur = 26;
  g.font = 'bold 72px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  g.shadowBlur = 0;
  g.strokeStyle = fg;
  g.lineWidth = 4;
  g.strokeRect(6, 6, 500, 116);
  return toTexture(c, false);
}

/** Dusk grass: 256px tile — blade strokes, dry patches, soil, flowers. */
export function grassTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#4c6e38';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 42; i += 1) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(150,140,70,0.16)' : 'rgba(25,55,25,0.18)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 26, 0, 7);
    g.fill();
  }
  const blades = ['#5d8146', '#6d9150', '#476b32', '#7fae5e', '#c2b060', '#3a5c2a'];
  for (let i = 0; i < 2600; i += 1) {
    g.strokeStyle = blades[Math.floor(Math.random() * blades.length)];
    g.globalAlpha = 0.25 + Math.random() * 0.45;
    const x = Math.random() * 256, y = Math.random() * 256, l = 2 + Math.random() * 4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 2, y - l);
    g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 56; i += 1) {
    if (Math.random() < 0.45) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,180,200,0.8)' : 'rgba(255,255,255,0.8)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    } else {
      g.fillStyle = 'rgba(60,40,25,0.35)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3);
    }
  }
  const t = toTexture(c, true);
  t.repeat.set(48, 48);
  return t;
}

/** Warm sunset sand: ripples, shells, pebbles, footprints. */
export function sandTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#e8c890';
  g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 1200, 0.07);
  for (let i = 0; i < 30; i += 1) {
    g.strokeStyle = `rgba(160,120,70,${0.1 + Math.random() * 0.12})`;
    g.lineWidth = 1 + Math.random();
    const y = Math.random() * 256, x = Math.random() * 256, l = 20 + Math.random() * 50;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + l / 2, y + (Math.random() - 0.5) * 8, x + l, y + (Math.random() - 0.5) * 6);
    g.stroke();
  }
  for (let i = 0; i < 18; i += 1) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,245,230,0.9)' : 'rgba(255,180,160,0.85)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 2, 0, 7);
    g.fill();
  }
  for (let i = 0; i < 14; i += 1) {
    g.fillStyle = 'rgba(120,100,80,0.5)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  for (let i = 0; i < 10; i += 1) {
    const x = Math.random() * 256, y = Math.random() * 256;
    g.fillStyle = 'rgba(150,115,70,0.4)';
    g.fillRect(x, y, 4, 7);
    g.fillRect(x + 7, y + 4, 4, 7);
  }
  const t = toTexture(c, true);
  t.repeat.set(24, 2);
  return t;
}

/** One road tile, 10x16 m, 256px: sidewalks, curbs, asphalt detail, worn paint. 'z' rotates 90 degrees. */
export function roadTexture(axis) {
  const [c, g] = canvas(256, 256);
  if (axis === 'z') { g.translate(128, 128); g.rotate(Math.PI / 2); g.translate(-128, -128); }
  g.fillStyle = '#a89a88';
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
    g.fillRect(x, 0, 32, 46);
    g.fillRect(x, 210, 32, 46);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(x, 0, 1, 46);
    g.fillRect(x, 210, 1, 46);
  }
  speckle(g, 256, 256, 500, 0.05);
  for (let i = 0; i < 24; i += 1) {
    g.fillStyle = 'rgba(40,30,25,0.4)';
    g.fillRect(Math.random() * 256, Math.random() < 0.5 ? Math.random() * 44 : 212 + Math.random() * 42, 2, 2);
  }
  g.fillStyle = '#7a6e5e';
  g.fillRect(0, 44, 256, 3);
  g.fillRect(0, 209, 256, 3);
  for (let i = 0; i < 40; i += 1) {
    g.strokeStyle = 'rgba(90,140,60,0.85)';
    const x = Math.random() * 256;
    g.beginPath(); g.moveTo(x, 46); g.lineTo(x + 1, 41); g.stroke();
    g.beginPath(); g.moveTo(x + 3, 210); g.lineTo(x + 4, 215); g.stroke();
  }
  g.fillStyle = '#2a2d33';
  g.fillRect(0, 47, 256, 162);
  speckle(g, 256, 256, 2200, 0.07);
  g.fillStyle = 'rgba(0,0,0,0.14)';
  g.fillRect(0, 82, 256, 22);
  g.fillRect(0, 152, 256, 22);
  for (let i = 0; i < 4; i += 1) {
    const px = Math.random() * 220, py = 52 + Math.random() * 140, pw = 14 + Math.random() * 26, ph = 10 + Math.random() * 16;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(px, py, pw, ph);
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.strokeRect(px + 0.5, py + 0.5, pw, ph);
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 6; i += 1) {
    let x = Math.random() * 256, y = 50 + Math.random() * 150;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) { x += (Math.random() - 0.5) * 22; y += (Math.random() - 0.5) * 14; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle = 'rgba(8,8,12,0.3)';
    g.beginPath();
    g.arc(30 + Math.random() * 196, 60 + Math.random() * 130, 6 + Math.random() * 12, 0, 7);
    g.fill();
  }
  const mx = 60 + Math.random() * 136, my = 90 + Math.random() * 70;
  g.fillStyle = '#1c1e22';
  g.beginPath(); g.arc(mx, my, 9, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.15)';
  g.beginPath(); g.arc(mx, my, 9, 0, 7); g.stroke();
  g.fillStyle = 'rgba(255,170,120,0.13)';
  g.fillRect(0, 76, 256, 5);
  g.fillRect(0, 152, 256, 4);
  g.fillStyle = '#f0f0e0';
  g.fillRect(0, 50, 256, 3);
  g.fillRect(0, 203, 256, 3);
  g.fillStyle = '#ffd23e';
  for (let x = 12; x < 256; x += 64) g.fillRect(x, 124, 36, 7);
  speckle(g, 256, 256, 700, 0.08);
  return toTexture(c, true);
}

/** Runway tile: 512px — rubber touchdown bands, cracks, oil, faded paint. */
export function runwayTexture() {
  const [c, g] = canvas(512, 128);
  g.fillStyle = '#2e2e36';
  g.fillRect(0, 0, 512, 128);
  speckle(g, 512, 128, 1800, 0.07);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(60, 44, 392, 12);
  g.fillRect(60, 72, 392, 12);
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 5; i += 1) {
    let x = Math.random() * 512, y = 10 + Math.random() * 108;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 16; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 4; i += 1) {
    g.fillStyle = 'rgba(8,8,12,0.28)';
    g.beginPath();
    g.arc(40 + Math.random() * 432, 20 + Math.random() * 88, 8 + Math.random() * 14, 0, 7);
    g.fill();
  }
  g.fillStyle = '#f2f2e8';
  for (let x = 16; x < 512; x += 64) g.fillRect(x, 60, 26, 8);
  g.fillRect(0, 6, 512, 4);
  g.fillRect(0, 118, 512, 4);
  for (let y = 16; y < 112; y += 24) g.fillRect(4, y, 16, 6);
  speckle(g, 512, 128, 500, 0.06);
  const t = toTexture(c, true);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Sunset sea: deep purple with pink sparkle, wave strokes and sun glints. */
export function waterTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#6e5a8e';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i += 1) {
    g.strokeStyle = `rgba(255,170,180,${0.12 + Math.random() * 0.14})`;
    g.lineWidth = 1 + Math.random();
    g.beginPath();
    const y = Math.random() * 128;
    g.moveTo(Math.random() * 128, y);
    g.lineTo(Math.random() * 128, y + (Math.random() - 0.5) * 8);
    g.stroke();
  }
  for (let i = 0; i < 12; i += 1) {
    g.strokeStyle = `rgba(255,210,160,${0.2 + Math.random() * 0.25})`;
    g.lineWidth = 1;
    const y = Math.random() * 128, x = Math.random() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 14 + Math.random() * 26, y);
    g.stroke();
  }
  for (let i = 0; i < 90; i += 1) {
    g.fillStyle = `rgba(255,200,180,${0.3 + Math.random() * 0.45})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
  }
  const t = toTexture(c, true);
  t.repeat.set(48, 48);
  return t;
}

/** Plaza paving: 8 tile tones, cracks, stains, moss in the joints. */
export function plazaTexture() {
  const [c, g] = canvas(256, 256);
  const tones = ['#b8a894', '#b0a08c', '#c0b09a', '#a89a86', '#b5a48e', '#ac9c88', '#bcac96', '#a3947e'];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      g.fillStyle = tones[(row * 4 + col) % 8];
      g.fillRect(col * 64, row * 64, 64, 64);
    }
  }
  speckle(g, 256, 256, 1600, 0.05);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i <= 256; i += 64) {
    g.fillRect(i, 0, 2, 256);
    g.fillRect(0, i, 256, 2);
  }
  g.fillStyle = 'rgba(70,110,50,0.5)';
  for (let i = 0; i < 60; i += 1) {
    const v = Math.random() < 0.5, j = Math.floor(Math.random() * 5) * 64, r = Math.random() * 256;
    g.fillRect(v ? j : r, v ? r : j, 3, 3);
  }
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 4; i += 1) {
    let x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 5; s += 1) { x += (Math.random() - 0.5) * 26; y += (Math.random() - 0.5) * 26; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = 'rgba(60,50,40,0.18)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 14, 0, 7);
    g.fill();
  }
  const t = toTexture(c, true);
  t.repeat.set(3, 3);
  return t;
}

/** Soft white cloud puffs on a transparent tile, for billboard sprites. */
export function cloudTexture() {
  const [c, g] = canvas(256, 128);
  const blob = (x, y, r, a) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(80, 80, 55, 0.95);
  blob(130, 65, 65, 0.95);
  blob(180, 82, 50, 0.9);
  blob(110, 95, 45, 0.75);
  blob(160, 95, 42, 0.75);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Radial glow sprite: sun disc, lamp halos, brake-light glow, smoke puffs. */
export function glowTexture() {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
