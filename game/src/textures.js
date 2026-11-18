import * as THREE from 'three';

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

function grain(g, w, h, n, a) {
  for (let i = 0; i < n; i += 1) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

function crack(g, x, y, steps, spread) {
  g.beginPath();
  g.moveTo(x, y);
  for (let i = 0; i < steps; i += 1) {
    x += (Math.random() - 0.5) * spread;
    y += (Math.random() - 0.5) * spread * 0.6;
    g.lineTo(x, y);
  }
  g.stroke();
}

const FACADE_BASE = ['#b8a894', '#5f6f8e', '#a87a52', '#9a8a70'];
const FACADE_TRIM = ['#8a7a66', '#46536a', '#7e5a36', '#7a6c56'];

function paintFacade(variant) {
  const [c, g] = mk(256, 256);
  g.fillStyle = FACADE_BASE[variant];
  g.fillRect(0, 0, 256, 256);
  grain(g, 256, 256, 600, 0.05);
  g.fillStyle = 'rgba(0,0,0,0.10)';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 2);
  const lit = ['#ffe0a0', '#ffb060', '#ff9a70', '#ffd98a'];
  const dark = ['#241d33', '#332c46', '#1c2030'];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const x = 6 + col * 42;
      const y = 8 + row * 32;
      const warm = Math.random() < 0.58;
      g.fillStyle = warm ? lit[Math.floor(Math.random() * lit.length)] : dark[Math.floor(Math.random() * dark.length)];
      g.fillRect(x, y, 30, 20);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(x + 3, y + 3, 12, 4);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x, y + 18, 30, 2);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 256, 6);
  g.fillRect(0, 250, 256, 6);
  g.fillStyle = FACADE_TRIM[variant];
  for (let x = 0; x < 256; x += 32) g.fillRect(x + 4, 236, 20, 8);
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(10 + Math.floor(Math.random() * 6) * 42, 12 + Math.floor(Math.random() * 8) * 32, 24, 2);
  }
  return c;
}

const facadeCache = [];
const facadeMatCache = [];

export function facadeMaterial(variant) {
  if (!facadeMatCache[variant]) {
    if (!facadeCache[variant]) facadeCache[variant] = paintFacade(variant);
    facadeMatCache[variant] = new THREE.MeshLambertMaterial({ map: tex(facadeCache[variant], true) });
  }
  return facadeMatCache[variant];
}

const SHOPS = [
  ['CLUB NEON', '#160a1e', '#ff2a7a'],
  ['KOPI NUSA', '#14122e', '#ffd23e'],
  ['BENGKEL 7', '#16161e', '#ff9a3c'],
  ['SURF & SUN', '#082430', '#39d0ff'],
];

let signAtlas = null;

export function signTexture() {
  if (signAtlas) return signAtlas;
  const [c, g] = mk(512, 128);
  SHOPS.forEach(([name, bg, fg], i) => {
    const x0 = i * 128;
    g.fillStyle = bg;
    g.fillRect(x0, 0, 128, 128);
    g.fillStyle = fg;
    g.shadowColor = fg;
    g.shadowBlur = 12;
    g.font = 'bold 24px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const words = name.split(' ');
    g.fillText(words[0], x0 + 64, words.length > 1 ? 46 : 64);
    if (words.length > 1) g.fillText(words.slice(1).join(' '), x0 + 64, 82);
    g.shadowBlur = 0;
    g.strokeStyle = fg;
    g.lineWidth = 3;
    g.strokeRect(x0 + 8, 8, 112, 112);
    g.fillStyle = fg;
    g.fillRect(x0 + 24, 106, 80, 3);
  });
  signAtlas = tex(c, false);
  return signAtlas;
}

export function neonTexture(text, fg, bg) {
  const [c, g] = mk(512, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.shadowColor = fg;
  g.shadowBlur = 30;
  g.font = 'bold 68px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 60);
  g.shadowBlur = 0;
  g.fillStyle = fg;
  g.fillRect(56, 102, 400, 4);
  g.strokeStyle = fg;
  g.lineWidth = 3;
  g.strokeRect(8, 8, 496, 112);
  return tex(c, false);
}

export function grassTexture() {
  const [c, g] = mk(256, 256);
  g.fillStyle = '#557a3e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 38; i += 1) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(140,130,60,0.15)' : 'rgba(20,50,20,0.16)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 24, 0, 7);
    g.fill();
  }
  const blades = ['#648c4e', '#75995a', '#4e7338', '#86b464', '#b8a858', '#40632e'];
  for (let i = 0; i < 2400; i += 1) {
    g.strokeStyle = blades[Math.floor(Math.random() * blades.length)];
    g.globalAlpha = 0.3 + Math.random() * 0.4;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const l = 2 + Math.random() * 4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y - l);
    g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 48; i += 1) {
    if (Math.random() < 0.5) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,170,190,0.85)' : 'rgba(255,255,255,0.85)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    } else {
      g.fillStyle = 'rgba(70,45,25,0.4)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3);
    }
  }
  const t = tex(c, true);
  t.repeat.set(48, 48);
  return t;
}

export function sandTexture() {
  const [c, g] = mk(256, 256);
  g.fillStyle = '#e8c890';
  g.fillRect(0, 0, 256, 256);
  grain(g, 256, 256, 1100, 0.07);
  for (let i = 0; i < 26; i += 1) {
    g.strokeStyle = `rgba(165,125,75,${0.1 + Math.random() * 0.12})`;
    g.lineWidth = 1 + Math.random();
    const y = Math.random() * 256;
    const x = Math.random() * 256;
    const l = 24 + Math.random() * 46;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + l / 2, y + (Math.random() - 0.5) * 10, x + l, y + (Math.random() - 0.5) * 6);
    g.stroke();
  }
  for (let i = 0; i < 16; i += 1) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,246,232,0.9)' : 'rgba(255,175,155,0.85)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 2, 0, 7);
    g.fill();
  }
  for (let i = 0; i < 12; i += 1) {
    g.fillStyle = 'rgba(130,105,80,0.5)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  for (let i = 0; i < 8; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    g.fillStyle = 'rgba(150,115,70,0.4)';
    g.fillRect(x, y, 4, 7);
    g.fillRect(x + 7, y + 4, 4, 7);
  }
  const t = tex(c, true);
  t.repeat.set(24, 2);
  return t;
}

export function roadTexture(axis) {
  const [c, g] = mk(256, 256);
  if (axis === 'z') {
    g.translate(128, 128);
    g.rotate(Math.PI / 2);
    g.translate(-128, -128);
  }
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
  grain(g, 256, 256, 480, 0.05);
  g.fillStyle = '#7a6e5e';
  g.fillRect(0, 44, 256, 3);
  g.fillRect(0, 209, 256, 3);
  for (let i = 0; i < 36; i += 1) {
    g.strokeStyle = 'rgba(90,140,60,0.85)';
    const x = Math.random() * 256;
    g.beginPath();
    g.moveTo(x, 46);
    g.lineTo(x + 1, 41);
    g.stroke();
    g.beginPath();
    g.moveTo(x + 3, 210);
    g.lineTo(x + 4, 215);
    g.stroke();
  }
  g.fillStyle = '#2a2d33';
  g.fillRect(0, 47, 256, 162);
  grain(g, 256, 256, 2000, 0.07);
  g.fillStyle = 'rgba(0,0,0,0.14)';
  g.fillRect(0, 82, 256, 22);
  g.fillRect(0, 152, 256, 22);
  for (let i = 0; i < 5; i += 1) {
    const px = Math.random() * 220;
    const py = 52 + Math.random() * 140;
    const pw = 14 + Math.random() * 26;
    const ph = 10 + Math.random() * 16;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(px, py, pw, ph);
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.strokeRect(px + 0.5, py + 0.5, pw, ph);
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 6; i += 1) crack(g, Math.random() * 256, 50 + Math.random() * 150, 6, 22);
  for (let i = 0; i < 3; i += 1) {
    g.fillStyle = 'rgba(8,8,12,0.3)';
    g.beginPath();
    g.arc(30 + Math.random() * 196, 60 + Math.random() * 130, 6 + Math.random() * 12, 0, 7);
    g.fill();
  }
  const mx = 60 + Math.random() * 136;
  const my = 90 + Math.random() * 70;
  g.fillStyle = '#1c1e22';
  g.beginPath();
  g.arc(mx, my, 9, 0, 7);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.15)';
  g.beginPath();
  g.arc(mx, my, 9, 0, 7);
  g.stroke();
  g.fillStyle = 'rgba(255,170,120,0.13)';
  g.fillRect(0, 76, 256, 5);
  g.fillRect(0, 152, 256, 4);
  g.fillStyle = '#f0f0e0';
  g.fillRect(0, 50, 256, 3);
  g.fillRect(0, 203, 256, 3);
  g.fillStyle = '#ffd23e';
  for (let x = 12; x < 256; x += 64) g.fillRect(x, 124, 36, 7);
  grain(g, 256, 256, 650, 0.08);
  return tex(c, true);
}

export function runwayTexture() {
  const [c, g] = mk(512, 128);
  g.fillStyle = '#2e2e36';
  g.fillRect(0, 0, 512, 128);
  grain(g, 512, 128, 1700, 0.07);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(60, 44, 392, 12);
  g.fillRect(60, 72, 392, 12);
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 5; i += 1) crack(g, Math.random() * 512, 10 + Math.random() * 108, 6, 30);
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
  grain(g, 512, 128, 480, 0.06);
  const t = tex(c, true);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function waterTexture() {
  const [c, g] = mk(128, 128);
  g.fillStyle = '#6e5a8e';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 24; i += 1) {
    g.strokeStyle = `rgba(255,170,180,${0.12 + Math.random() * 0.14})`;
    g.lineWidth = 1 + Math.random();
    const y = Math.random() * 128;
    g.beginPath();
    g.moveTo(Math.random() * 128, y);
    g.lineTo(Math.random() * 128, y + (Math.random() - 0.5) * 8);
    g.stroke();
  }
  for (let i = 0; i < 12; i += 1) {
    g.strokeStyle = `rgba(255,210,160,${0.2 + Math.random() * 0.25})`;
    g.lineWidth = 1;
    const y = Math.random() * 128;
    const x = Math.random() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 14 + Math.random() * 26, y);
    g.stroke();
  }
  for (let i = 0; i < 80; i += 1) {
    g.fillStyle = `rgba(255,200,180,${0.3 + Math.random() * 0.45})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
  }
  const t = tex(c, true);
  t.repeat.set(48, 48);
  return t;
}

export function plazaTexture() {
  const [c, g] = mk(256, 256);
  const tones = ['#b8a894', '#b0a08c', '#c0b09a', '#a89a86', '#b5a48e', '#ac9c88', '#bcac96', '#a3947e'];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      g.fillStyle = tones[(row * 4 + col + ((row + col) % 2)) % 8];
      g.fillRect(col * 64, row * 64, 64, 64);
    }
  }
  grain(g, 256, 256, 1500, 0.05);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i <= 256; i += 64) {
    g.fillRect(i, 0, 2, 256);
    g.fillRect(0, i, 256, 2);
  }
  g.fillStyle = 'rgba(70,110,50,0.5)';
  for (let i = 0; i < 56; i += 1) {
    const v = Math.random() < 0.5;
    const j = Math.floor(Math.random() * 5) * 64;
    const r = Math.random() * 256;
    g.fillRect(v ? j : r, v ? r : j, 3, 3);
  }
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 4; i += 1) crack(g, Math.random() * 256, Math.random() * 256, 5, 26);
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = 'rgba(60,50,40,0.18)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 14, 0, 7);
    g.fill();
  }
  const t = tex(c, true);
  t.repeat.set(3, 3);
  return t;
}

export function cloudTexture() {
  const [c, g] = mk(256, 128);
  const blob = (x, y, r, a) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(70, 84, 52, 0.95);
  blob(125, 62, 62, 0.95);
  blob(185, 84, 48, 0.9);
  blob(105, 96, 44, 0.75);
  blob(165, 96, 40, 0.75);
  blob(210, 60, 34, 0.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function glowTexture() {
  const [c, g] = mk(64, 64);
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

export function flashTexture() {
  const [c, g] = mk(128, 128);
  g.translate(64, 64);
  g.fillStyle = '#fff6d8';
  g.beginPath();
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    const r = k % 2 === 0 ? 62 : 10;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
