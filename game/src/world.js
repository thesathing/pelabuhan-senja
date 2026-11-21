// PELABUHAN SENJA — the city itself.
//
// buildWorld lays out the whole open world in one seeded pass: a road grid,
// blocks of varied buildings (different footprints, heights, roofs, parapets
// and balconies — no two silhouettes alike), the harbour with its pier,
// cranes and container stacks, the market street with striped stalls, the
// old town, palms, streetlights, the beach and the sea, all under a dusk sky
// with a low warm sun and long shadows. It returns the collision boxes and
// the traffic loops the other systems drive on.

import * as THREE from '../vendor/three.module.min.js';
import { DUSK, WORLD } from './config.js';
import {
  asphaltTexture,
  awningTexture,
  concreteTexture,
  facadeTexture,
  mulberry32,
  pierTexture,
  sandTexture,
  shopSignTexture,
  skyTexture,
  waterTexture,
} from './textures.js';

const FACADE_COLORS = ['#e8dcc8', '#d9c9a8', '#cbb59a', '#e3cfae', '#bfae8e', '#d8b49a'];
const CONTAINER_COLORS = [0xc94f43, 0x3f7d9e, 0xd9a441, 0x5d8a4f, 0x8a5f9e, 0xbf6b35];
const SHOP_NAMES = ['KOPI SENJA', 'IKAN BAKAR', 'WARUNG BU SARI', 'PELABUHAN MART', 'ROTI PANAS', 'ES KELAPA', 'TAMBAL BAN', 'LAUNDRY 24'];

// A rectangular loop of waypoints around one city block, for traffic to
// follow: up one street, across, down the next, back along the bottom.
function blockLoop(x0, z0, x1, z1) {
  return [
    new THREE.Vector3(x0, 0, z0),
    new THREE.Vector3(x0, 0, z1),
    new THREE.Vector3(x1, 0, z1),
    new THREE.Vector3(x1, 0, z0),
  ];
}

function addBox(group, w, h, d, x, y, z, material, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function buildWorld(scene) {
  const rnd = mulberry32(WORLD.seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'PelabuhanSenjaCity';
  scene.add(group);

  // ---- sky, fog and light -------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
  );
  sky.name = 'DuskSky';
  scene.add(sky);
  scene.fog = new THREE.Fog(new THREE.Color(DUSK.fogColor), DUSK.fogNear, DUSK.fogFar);

  const sun = new THREE.DirectionalLight(new THREE.Color(DUSK.sunColor), DUSK.sunIntensity);
  sun.position.set(-180, 55, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190;
  sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190;
  sun.shadow.camera.bottom = -190;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(new THREE.Color(DUSK.hemiSky), new THREE.Color(DUSK.hemiGround), DUSK.hemiIntensity));

  // A visible low sun disc hanging over the sea, so the horizon glows.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false })
  );
  sunDisc.position.set(-420, 42, 560);
  sunDisc.lookAt(0, 20, 0);
  scene.add(sunDisc);

  // ---- ground: sand base, city slab, sea ----------------------------------
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.05;
  sand.receiveShadow = true;
  group.add(sand);

  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.halfSize * 2 + 20, WORLD.halfSize * 2 + 20),
    new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.95 })
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, 0.02, -5);
  slab.receiveShadow = true;
  group.add(slab);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 340),
    new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.35, metalness: 0.25 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.35, WORLD.seaStart + 170);
  sea.receiveShadow = true;
  group.add(sea);

  // ---- roads ----------------------------------------------------------------
  const asphalt = asphaltTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.9 });
  const roadLines = [];
  for (let v = WORLD.roadFirst; v <= WORLD.roadLast; v += WORLD.roadSpacing) roadLines.push(v);
  for (const x of roadLines) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.halfSize * 2), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.06, 0);
    road.receiveShadow = true;
    group.add(road);
  }
  for (const z of roadLines) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.halfSize * 2, WORLD.roadWidth), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.06, z);
    road.receiveShadow = true;
    group.add(road);
  }

  // ---- buildings -------------------------------------------------------------
  // One block cell sits between four roads; each cell gets one to three
  // buildings with their own footprint, height, facade and roof furniture.
  const facadeCache = new Map();
  function facadeFor(base, floors, seed) {
    const key = `${base}|${floors}|${seed}`;
    if (!facadeCache.has(key)) facadeCache.set(key, facadeTexture(base, floors, seed));
    return facadeCache.get(key);
  }

  function buildOneBuilding(cx, cz, w, d, h, seed) {
    const floors = Math.max(2, Math.round(h / 3.4));
    const base = FACADE_COLORS[Math.floor(rnd() * FACADE_COLORS.length)];
    const walls = new THREE.MeshStandardMaterial({ map: facadeFor(base, floors, seed), roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), walls);
    body.position.set(cx, h / 2 + 0.05, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });

    // Parapet ring, so the roofline is not a flat box edge.
    const parapet = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 1 });
    addBox(group, w + 0.3, 0.7, 0.5, cx, h + 0.35, cz - d / 2, parapet);
    addBox(group, w + 0.3, 0.7, 0.5, cx, h + 0.35, cz + d / 2, parapet);
    addBox(group, 0.5, 0.7, d, cx - w / 2, h + 0.35, cz, parapet);
    addBox(group, 0.5, 0.7, d, cx + w / 2, h + 0.35, cz, parapet);
    // Roof furniture: water tank and AC boxes.
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.9 });
    if (rnd() < 0.7) addBox(group, 1.6, 1.8, 1.6, cx + (rnd() - 0.5) * w * 0.4, h + 0.9, cz + (rnd() - 0.5) * d * 0.4, roofMat);
    if (rnd() < 0.6) addBox(group, 2.2, 0.9, 1.2, cx - w * 0.2, h + 0.45, cz + d * 0.2, roofMat);
    // Balconies on the upper floors, facing the street.
    const balconyMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 });
    const balconies = Math.min(3, floors - 1);
    for (let b = 0; b < balconies; b++) {
      const by = 3.4 * (b + 1) + 0.6;
      if (by > h - 2) break;
      addBox(group, w * 0.5, 0.25, 1.1, cx, by, cz + d / 2 + 0.45, balconyMat);
      addBox(group, w * 0.5, 0.9, 0.12, cx, by + 0.55, cz + d / 2 + 0.95, balconyMat);
    }
    return body;
  }

  const blockCenters = [];
  for (let v = WORLD.roadFirst + WORLD.roadSpacing / 2; v < WORLD.roadLast; v += WORLD.roadSpacing) {
    blockCenters.push(v);
  }
  let shopIndex = 0;
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      // Keep the harbour quarter and the market avenue clear of blocks.
      if (bz >= 120) continue;
      if (bz === 0 && bx >= -60 && bx <= 60) continue;
      const count = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < count; i++) {
        const w = 12 + rnd() * 10;
        const d = 11 + rnd() * 9;
        const h = 8 + rnd() * rnd() * 26;
        const ox = (rnd() - 0.5) * (WORLD.roadSpacing - w - 6);
        const oz = (rnd() - 0.5) * (WORLD.roadSpacing - d - 6);
        const cx = bx + ox;
        const cz = bz + oz;
        buildOneBuilding(cx, cz, w, d, h, Math.floor(rnd() * 100000));
        // Ground-floor shop sign on some buildings along the avenues.
        if (h >= 10 && rnd() < 0.5) {
          const name = SHOP_NAMES[shopIndex++ % SHOP_NAMES.length];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(w * 0.75, 11), 1.4),
            new THREE.MeshStandardMaterial({ map: shopSignTexture(name, '#2b1d33', '#ffd27a'), emissive: 0x442200, roughness: 0.6 })
          );
          sign.position.set(cx, 2.6, cz + d / 2 + 0.06);
          group.add(sign);
        }
      }
    }
  }

  // ---- old town: low shophouses with tiled roofs around the west square -----
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xa34a35, roughness: 0.9 });
  const oldWall = new THREE.MeshStandardMaterial({ color: 0xe6d3ae, roughness: 0.95 });
  for (let i = 0; i < 6; i++) {
    const cx = -118 + (i % 3) * 16;
    const cz = -118 + Math.floor(i / 3) * 16;
    addBox(group, 12, 6, 10, cx, 3, cz, oldWall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.5, 3.4, 4), tileMat);
    roof.position.set(cx, 7.7, cz);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 5, maxZ: cz + 5 });
  }

  // ---- harbour: warehouses, container stacks, cranes, pier ------------------
  const shedMat = new THREE.MeshStandardMaterial({ color: 0x7d8894, roughness: 0.8, metalness: 0.35 });
  for (const [sx, sz, sw] of [[30, 138, 30], [70, 138, 24], [110, 138, 26]]) {
    addBox(group, sw, 9, 14, sx, 4.5, sz, shedMat);
    // Gable roof: two sloped slabs meeting at the ridge.
    const slope = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.6, 0.35, 8.2), shedMat);
    slope.position.set(sx, 10.6, sz - 3.4);
    slope.rotation.x = 0.42;
    slope.castShadow = true;
    group.add(slope);
    const slope2 = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.6, 0.35, 8.2), shedMat);
    slope2.position.set(sx, 10.6, sz + 3.4);
    slope2.rotation.x = -0.42;
    slope2.castShadow = true;
    group.add(slope2);
    colliders.push({ minX: sx - sw / 2, maxX: sx + sw / 2, minZ: sz - 7, maxZ: sz + 7 });
  }

  const containerMat = CONTAINER_COLORS.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.3 })
  );
  for (let i = 0; i < 22; i++) {
    const stack = i % 4;
    const cx = 18 + (i % 6) * 13 + rnd() * 3;
    const cz = 128 + Math.floor(i / 6) * 7;
    const h = 2.6 * (1 + (stack % 2));
    addBox(group, 12, h, 2.6, cx, h / 2 + 0.05, cz, containerMat[i % containerMat.length]);
    colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 1.3, maxZ: cz + 1.3 });
  }

  // Gantry cranes: lattice mast, long jib over the water, hook cable.
  function buildCrane(x, z, height, reach) {
    const steel = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.6, metalness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.7, metalness: 0.4 });
    addBox(group, 2.4, height, 2.4, x, height / 2, z, steel);
    addBox(group, 1.2, height * 0.8, 1.2, x + 2.2, height * 0.4, z, dark);
    addBox(group, reach, 1.6, 1.6, x + reach / 2 - 2, height, z, steel);
    addBox(group, 8, 1.6, 1.6, x - 6, height, z, steel);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 12, 6), dark);
    cable.position.set(x + reach - 6, height - 6, z);
    group.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), dark);
    hook.position.set(x + reach - 6, height - 12.5, z);
    group.add(hook);
    addBox(group, 6, 1, 6, x, 0.5, z, dark);
    colliders.push({ minX: x - 3, maxX: x + 3, minZ: z - 3, maxZ: z + 3 });
  }
  buildCrane(48, 146, 30, 26);
  buildCrane(96, 146, 36, 30);
  buildCrane(128, 146, 26, 22);

  // The pier: planks on piles, reaching out over the sea.
  const pierMat = new THREE.MeshStandardMaterial({ map: pierTexture(), roughness: 0.9 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 84), pierMat);
  pier.position.set(90, 0.5, 192);
  pier.castShadow = true;
  pier.receiveShadow = true;
  group.add(pier);
  const pileMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
  for (let z = 156; z <= 228; z += 12) {
    addBox(group, 0.7, 1.6, 0.7, 86, -0.3, z, pileMat, false);
    addBox(group, 0.7, 1.6, 0.7, 94, -0.3, z, pileMat, false);
  }
  colliders.push({ minX: 84, maxX: 96, minZ: 150, maxZ: 152 });

  // ---- market street: stalls with striped awnings along the avenue ---------
  const awningMats = [
    new THREE.MeshStandardMaterial({ map: awningTexture('#c94f43', '#f2e3c9'), roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: awningTexture('#3f7d9e', '#f2e3c9'), roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: awningTexture('#d9a441', '#f2e3c9'), roughness: 0.9 }),
  ];
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const sx = -54 + Math.floor(i / 2) * 26;
    const sz = side * 8;
    const mat = awningMats[i % awningMats.length];
    addBox(group, 6, 0.25, 4.5, sx, 2.6, sz, mat);
    addBox(group, 5.6, 1.1, 3.6, sx, 0.85, sz, new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 1 }));
    addBox(group, 1.4, 1.4, 1.4, sx - 3.4, 0.7, sz + 1.5, crateMat);
    addBox(group, 1.1, 1.1, 1.1, sx + 3.6, 0.55, sz - 1.4, crateMat);
    colliders.push({ minX: sx - 3, maxX: sx + 3, minZ: sz - 2.2, maxZ: sz + 2.2 });
  }

  // ---- palms and streetlights ------------------------------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.9, side: THREE.DoubleSide });
  function buildPalm(x, z) {
    const lean = (rnd() - 0.5) * 0.24;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 7, 7), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    group.add(trunk);
    const topX = x + Math.sin(lean) * -3.4;
    for (let f = 0; f < 7; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 4), frondMat);
      const angle = (f / 7) * Math.PI * 2;
      frond.position.set(topX + Math.cos(angle) * 1.6, 7.4, z + Math.sin(angle) * 1.6);
      frond.rotation.set(Math.sin(angle) * 1.1, 0, -Math.cos(angle) * 1.1);
      frond.scale.set(1, 1, 0.35);
      frond.castShadow = true;
      group.add(frond);
    }
  }
  for (let x = -140; x <= 140; x += 20) {
    buildPalm(x + (rnd() - 0.5) * 4, 152 + rnd() * 6);
  }
  // Palms line the sidewalks of the north-south avenues (x = ±14), on the
  // blocks between roads (z never a multiple of 40), never in the roadway.
  for (const [px, pz] of [[-14, -100], [14, -60], [-14, -20], [14, 20], [-14, 60], [14, 100], [-14, -60], [14, -100]]) {
    buildPalm(px, pz);
  }

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e2e36, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb35c, emissiveIntensity: 2.2 });
  const lampPositions = [];
  for (let i = 0; i < 18; i++) {
    const along = roadLines[i % roadLines.length];
    const cross = -120 + Math.floor(i / roadLines.length) * 80 + (i % 2 === 0 ? 7 : -7);
    const x = i % 2 === 0 ? along : cross;
    const z = i % 2 === 0 ? cross : along;
    if (z >= 140) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 8), poleMat);
    pole.position.set(x, 3.25, z);
    pole.castShadow = true;
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), poleMat);
    arm.position.set(x + 0.8, 6.4, z);
    group.add(arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), lampMat);
    lamp.position.set(x + 1.6, 6.3, z);
    group.add(lamp);
    lampPositions.push([x + 1.6, 6.3, z]);
  }
  // A few real warm point lights where the city is busiest; the rest of the
  // lamps glow emissive only, so the frame stays cheap.
  for (const [lx, ly, lz] of [[0, 6, 0], [90, 6, 150], [-40, 6, 0], [40, 6, -40]].slice(0, 3)) {
    const light = new THREE.PointLight(0xffb35c, 60, 42, 1.8);
    light.position.set(lx, ly, lz);
    scene.add(light);
  }

  // ---- beach props: umbrellas and a beached boat ------------------------------
  const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xd94f43, roughness: 0.9, side: THREE.DoubleSide });
  for (const [ux, uz] of [[-60, 162], [-20, 164], [20, 161], [130, 163]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), poleMat);
    pole.position.set(ux, 1.3, uz);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 8), umbrellaMat);
    top.position.set(ux, 3, uz);
    top.castShadow = true;
    group.add(top);
  }
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.7 });
  const boat = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.1, 7, 8), boatMat);
  boat.rotation.z = Math.PI / 2;
  boat.rotation.y = 0.5;
  boat.scale.set(1, 1, 0.55);
  boat.position.set(-100, 0.9, 164);
  boat.castShadow = true;
  group.add(boat);

  // ---- traffic loops -----------------------------------------------------------
  const loops = [
    blockLoop(-40, -120, -80, 120),
    blockLoop(40, -120, 80, 120),
    blockLoop(-120, -40, 120, -80),
    blockLoop(-120, 40, 120, 80),
    blockLoop(-80, -40, -40, 40),
  ];

  return { colliders, loops, group, lampPositions };
}
