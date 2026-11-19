import * as THREE from 'three';

// Combine many coloured parts into one geometry so a car, a pedestrian or a
// building costs a single draw call. Each part brings its own geometry,
// optional transform, colour and UV scale; positions, normals, colours and
// UVs are concatenated, indices rebased, and the temporary clone freed.
export function mergeParts(parts) {
  const bag = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
  let base = 0;
  const tint = new THREE.Color();
  for (const part of parts) {
    const geo = part.geo.clone();
    if (part.matrix) geo.applyMatrix4(part.matrix);
    tint.setHex(part.color ?? 0xffffff);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const scale = part.uvScale || [];
    const su = scale[0] === undefined ? 1 : scale[0];
    const sv = scale[1] === undefined ? 1 : scale[1];
    for (let v = 0; v < pos.count; v += 1) {
      bag.positions.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      bag.normals.push(nor.getX(v), nor.getY(v), nor.getZ(v));
      bag.colors.push(tint.r, tint.g, tint.b);
      if (uv) bag.uvs.push(uv.getX(v) * su, uv.getY(v) * sv);
    }
    const idx = geo.index;
    for (let v = 0; v < idx.count; v += 1) bag.indices.push(idx.getX(v) + base);
    base += pos.count;
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(bag.positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(bag.normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(bag.colors, 3));
  if (bag.uvs.length > 0) out.setAttribute('uv', new THREE.Float32BufferAttribute(bag.uvs, 2));
  out.setIndex(bag.indices);
  return out;
}
export function boxPart(w, h, d, x, y, z, color, ry = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  return { geo, matrix: xform({ x, y, z, ry }), color };
}
export function geoPart(geo, x, y, z, color, ry = 0, scale = 1) {
  return { geo, matrix: xform({ x, y, z, ry, s: scale }), color };
}
export function unitBoxPart(w, h, d, x, y, z, uvScale) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const matrix = xform({ x, y, z, sx: w, sy: h, sz: d });
  return { geo, matrix, color: 0xffffff, uvScale };
}
// Position + rotation + scale packed into one matrix. Uniform scale `s`
// multiplies the per-axis scales, so callers pass either or both.
export function xform({ rx = 0, ry = 0, rz = 0, x = 0, y = 0, z = 0, s = 1, sx = 1, sy = 1, sz = 1 } = {}) {
  const position = new THREE.Vector3(x, y, z);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  const scale = new THREE.Vector3(s * sx, s * sy, s * sz);
  const m = new THREE.Matrix4();
  m.compose(position, rotation, scale);
  return m;
}
