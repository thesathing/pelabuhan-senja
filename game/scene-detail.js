// PELABUHAN SENJA — terrain detail: instanced grass, shrubs, flowers, rocks
// and palms, dirt paths, and the asphalt dressing (cracks, patches, oil,
// puddles, manholes, drains, curbs, worn lane markings). Layout comes from
// world-data.js; this file only turns it into meshes.
import * as THREE from './vendor/three.module.min.js';
import { WORLD_DATA, ROADS, heightAt, lerp } from './world-data.js';

// Two crossed quads, the classic grass tuft.
function crossedQuads(w, h) {
  const g = new THREE.BufferGeometry();
  const hw = w / 2;
  const positions = new Float32Array([
    -hw, 0, 0, hw, 0, 0, hw, h, 0, -hw, 0, 0, hw, h, 0, -hw, h, 0,
    0, 0, -hw, 0, 0, hw, 0, h, hw, 0, 0, -hw, 0, h, -hw, 0, h, hw,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

function setInstances(mesh, items, place) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  items.forEach((it, i) => {
    place(it, p, e, s);
    q.setFromEuler(e);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (it.green !== undefined) mesh.setColorAt(i, new THREE.Color(it.green));
    else if (it.color !== undefined) mesh.setColorAt(i, new THREE.Color(it.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function buildDetail() {
  const data = WORLD_DATA;
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();

  // Grass tufts: 1600 crossed-plane instances in three greens.
  const grassGeo = crossedQuads(1.1, 0.9);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide });
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, data.scatter.grass.length);
  setInstances(grass, data.scatter.grass, (it, p, e, s) => {
    p.set(it.x, it.h, it.z);
    e.set(0, it.rot, 0);
    s.set(it.s, it.s * (0.9 + (it.s % 0.3)), it.s);
  });
  grass.receiveShadow = true;
  group.add(grass);

  // Shrubs: squashed icosahedra, dark green.
  const shrub = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x3d5c30, roughness: 1, flatShading: true }),
    data.scatter.shrubs.length,
  );
  setInstances(shrub, data.scatter.shrubs, (it, p, e, s) => {
    p.set(it.x, it.h + 0.4 * it.s, it.z);
    e.set(0, it.rot, 0);
    s.set(it.s, it.s * 0.7, it.s);
  });
  shrub.castShadow = true;
  group.add(shrub);

  // Flowers: tiny bright cones.
  const flowers = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.28, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    data.scatter.flowers.length,
  );
  setInstances(flowers, data.scatter.flowers, (it, p, e, s) => {
    p.set(it.x, it.h + 0.35 * it.s, it.z);
    e.set(0, it.rot, 0);
    s.set(it.s, it.s, it.s);
  });
  group.add(flowers);

  // Rocks: gray dodecahedra.
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x7a7268, roughness: 1, flatShading: true }),
    data.scatter.rocks.length,
  );
  setInstances(rocks, data.scatter.rocks, (it, p, e, s) => {
    p.set(it.x, it.h + 0.15 * it.s, it.z);
    e.set(0, it.rot, 0);
    s.set(it.s, it.s * 0.65, it.s);
  });
  rocks.castShadow = true;
  group.add(rocks);

  // Palms: instanced trunks + instanced squashed-cone crowns.
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.34, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }),
    data.scatter.palms.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.4, 1.6, 7),
    new THREE.MeshStandardMaterial({ color: 0x2f5c2a, roughness: 1, flatShading: true }),
    data.scatter.palms.length,
  );
  data.scatter.palms.forEach((it, i) => {
    dummy.position.set(it.x, it.h + 3 * it.s, it.z);
    dummy.rotation.set(0, it.rot, 0.06);
    dummy.scale.set(it.s, it.s, it.s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(it.x, it.h + 6.4 * it.s, it.z);
    dummy.rotation.set(0, it.rot, 0);
    dummy.scale.set(it.s, it.s * 0.8, it.s);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true; crowns.castShadow = true;
  group.add(trunks); group.add(crowns);

  // Dirt paths: flat brown ribbons following the terrain.
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 });
  for (const path of data.paths) {
    const positions = [];
    const indices = [];
    for (let i = 0; i < path.length; i += 1) {
      const [x, z] = path[i];
      const [nx, nz] = path[Math.min(i + 1, path.length - 1)];
      const [px, pz] = path[Math.max(i - 1, 0)];
      const dx = nx - px, dz = nz - pz;
      const len = Math.hypot(dx, dz) || 1;
      const ox = (-dz / len) * 1.6, oz = (dx / len) * 1.6;
      positions.push(x + ox, heightAt(x + ox, z + oz) + 0.05, z + oz);
      positions.push(x - ox, heightAt(x - ox, z - oz) + 0.05, z - oz);
      if (i < path.length - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, pathMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Asphalt dressing: thin dark planes laid on the roads.
  const crackMat = new THREE.MeshStandardMaterial({ color: 0x17141a, roughness: 1 });
  const patchMat = new THREE.MeshStandardMaterial({ color: 0x3d3844, roughness: 0.95 });
  const oilMat = new THREE.MeshStandardMaterial({ color: 0x0d0b10, roughness: 0.35, metalness: 0.4 });
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x3a4a7a, roughness: 0.12, metalness: 0.85 });
  const manholeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.7, metalness: 0.5 });
  function flatQuad(mat, x, z, y, angle, w, len, circle = false) {
    const geo = circle ? new THREE.CircleGeometry(w, 12) : new THREE.PlaneGeometry(w, len);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = angle;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    return m;
  }
  for (const c of data.dressing.cracks) group.add(flatQuad(crackMat, c.x, c.z, c.h + 0.1, c.angle, c.w, c.len));
  for (const p of data.dressing.patches) group.add(flatQuad(patchMat, p.x, p.z, p.h + 0.1, p.angle, p.w, p.len));
  for (const o of data.dressing.oil) group.add(flatQuad(oilMat, o.x, o.z, o.h + 0.1, o.angle, o.r, o.r, true));
  for (const p of data.dressing.puddles) group.add(flatQuad(puddleMat, p.x, p.z, p.h + 0.11, p.angle, p.r, p.r, true));
  for (const mh of data.dressing.manholes) group.add(flatQuad(manholeMat, mh.x, mh.z, mh.h + 0.1, mh.angle, mh.r * 2, mh.r * 2, true));
  for (const d of data.dressing.drains) group.add(flatQuad(manholeMat, d.x, d.z, d.h + 0.1, d.angle, d.w, d.len));

  // Curbs: one instanced box per road-edge chunk.
  const curbs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.35, 1),
    new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.95 }),
    data.dressing.curbs.length,
  );
  data.dressing.curbs.forEach((c, i) => {
    dummy.position.set(c.x, c.h + 0.18, c.z);
    dummy.rotation.set(0, -c.angle, 0);
    dummy.scale.set(c.len, 1, 0.7);
    dummy.updateMatrix();
    curbs.setMatrixAt(i, dummy.matrix);
  });
  curbs.instanceMatrix.needsUpdate = true;
  curbs.receiveShadow = true;
  group.add(curbs);

  // Worn lane markings: dashed centre lines down every road.
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xc8b890, roughness: 0.9, transparent: true, opacity: 0.55 });
  const lanePositions = [];
  const laneIndices = [];
  let v = 0;
  for (const r of ROADS) {
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
    const angle = Math.atan2(r.bz - r.az, r.bx - r.ax);
    const nx = Math.sin(angle), nz = -Math.cos(angle);
    const dash = 3, gap = 3;
    for (let d = 2; d < len - 2; d += dash + gap) {
      const t0 = d / len, t1 = Math.min((d + dash) / len, 1);
      for (const [t, side] of [[t0, -1], [t0, 1], [t1, -1], [t1, 1]]) {
        const cx = lerp(r.ax, r.bx, t), cz = lerp(r.az, r.bz, t);
        const x = cx + nx * side * 0.14;
        const z = cz + nz * side * 0.14;
        lanePositions.push(x, heightAt(x, z) + 0.09, z);
      }
      laneIndices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      v += 4;
    }
  }
  const laneGeo = new THREE.BufferGeometry();
  laneGeo.setAttribute('position', new THREE.Float32BufferAttribute(lanePositions, 3));
  laneGeo.setIndex(laneIndices);
  laneGeo.computeVertexNormals();
  group.add(new THREE.Mesh(laneGeo, laneMat));

  return { group };
}
