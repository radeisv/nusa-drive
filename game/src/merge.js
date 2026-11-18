import * as THREE from 'three';

export function mergeParts(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  let base = 0;
  const color = new THREE.Color();
  for (const part of parts) {
    const geo = part.geo.clone();
    if (part.matrix) geo.applyMatrix4(part.matrix);
    color.setHex(part.color ?? 0xffffff);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const [su = 1, sv = 1] = part.uvScale || [];
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(color.r, color.g, color.b);
      if (uv) uvs.push(uv.getX(i) * su, uv.getY(i) * sv);
    }
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 1) indices.push(idx.getX(i) + base);
    base += pos.count;
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (uvs.length > 0) out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(indices);
  return out;
}

export function boxPart(w, h, d, x, y, z, color, ry = 0) {
  return { geo: new THREE.BoxGeometry(w, h, d), matrix: xform({ x, y, z, ry }), color };
}

export function geoPart(geo, x, y, z, color, ry = 0, scale = 1) {
  return { geo, matrix: xform({ x, y, z, ry, s: scale }), color };
}

export function unitBoxPart(w, h, d, x, y, z, uvScale) {
  return { geo: new THREE.BoxGeometry(1, 1, 1), matrix: xform({ x, y, z, sx: w, sy: h, sz: d }), color: 0xffffff, uvScale };
}

export function xform({ rx = 0, ry = 0, rz = 0, x = 0, y = 0, z = 0, s = 1, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s * sx, s * sy, s * sz));
  return m;
}
