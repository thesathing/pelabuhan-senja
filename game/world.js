// PELABUHAN SENJA — three.js world: heightfield, sky, sun, clouds, water,
// lights, roads and buildings. Pure layout comes from world-data.js; this file
// only turns it into meshes.
import * as THREE from './vendor/three.module.min.js';
import {
  WORLD_WIDTH, WORLD_DEPTH, LIGHTHOUSE, WORLD_DATA, ROADS,
  heightAt, slopeAt, clamp, lerp, smoothstep, FACADES,
} from './world-data.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Muted facade: base colour, a grid of windows (some warm-lit), a darker ground
// floor and a door. One texture per palette colour, shared by every building.
const facadeCache = new Map();
export function facadeTexture(paletteIndex) {
  if (facadeCache.has(paletteIndex)) return facadeCache.get(paletteIndex);
  const base = new THREE.Color(FACADES[paletteIndex]);
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = `#${base.getHexString()}`;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 4, h);
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 6; c += 1) {
        const lit = ((r * 7 + c * 3 + paletteIndex) % 5) === 0;
        g.fillStyle = lit ? '#ffd9a0' : '#232033';
        g.fillRect(14 + c * 40, 14 + r * 28, 24, 16);
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(14 + c * 40, 14 + r * 28, 24, 3);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(0, h - 34, w, 34);
    g.fillStyle = '#1c1826';
    g.fillRect(w / 2 - 14, h - 34, 28, 34);
  });
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  facadeCache.set(paletteIndex, tex);
  return tex;
}

function neonSignTexture(text) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#12081f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ff4fd8';
    g.lineWidth = 6;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.font = 'bold 56px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#ff4fd8';
    g.shadowBlur = 22;
    g.fillStyle = '#ffe9f8';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function glowTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,190,120,0.95)');
    grad.addColorStop(0.35, 'rgba(255,120,90,0.45)');
    grad.addColorStop(1, 'rgba(255,80,140,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function terrainColor(x, z, h, slope) {
  const c = new THREE.Color();
  if (h < 0.4) { c.setHex(0xa89468); return c; } // sand near water
  if (h < 1.2 && x > 60) { c.setHex(0xb09a6e); return c; } // harbor sand
  if (slope > 0.55) { c.setHex(0x8a8078); return c; } // rocky steep ground
  const n = Math.sin(x * 0.35 + z * 0.21) * Math.sin(x * 0.13 - z * 0.31);
  if (n > 0.25) c.setHex(0x5d8448);
  else if (n < -0.25) c.setHex(0x71924a);
  else c.setHex(0x648c46);
  if (h > 18) c.lerp(new THREE.Color(0x7a6a55), smoothstep(18, 30, h) * 0.6);
  return c;
}

// A road ribbon as one flat geometry following the terrain.
function roadRibbon(r) {
  const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
  const steps = Math.max(4, Math.floor(len / 4));
  const angle = Math.atan2(r.bz - r.az, r.bx - r.ax);
  const nx = Math.sin(angle), nz = -Math.cos(angle);
  const positions = [];
  const indices = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const cx = lerp(r.ax, r.bx, t), cz = lerp(r.az, r.bz, t);
    for (const side of [-1, 1]) {
      const x = cx + nx * side * (r.w / 2);
      const z = cz + nz * side * (r.w / 2);
      positions.push(x, heightAt(x, z) + 0.07, z);
    }
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// One building: textured box, parapet, roof AC units, antenna on some, door on
// the ground floor, and an emissive neon sign when the data assigns one.
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a8296, emissive: 0x8a8296, emissiveIntensity: 0.3, roughness: 0.9 });
const parapetMat = new THREE.MeshStandardMaterial({ color: 0x55506a, roughness: 0.9 });
const acMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.8, metalness: 0.3 });
const antennaMat = new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.6, metalness: 0.6 });

function buildBuilding(b, signMats) {
  const g = new THREE.Group();
  const tex = facadeTexture(b.facade);
  const repeatX = Math.max(1, Math.round(b.w / 10));
  const repeatY = Math.max(1, Math.round(b.h / 10));
  tex.repeat.set(repeatX, repeatY);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.85,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3,
  });
  // Facade texture on the four walls; plain roof material on top and bottom
  // so no windows show on the roof.
  const body = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
  body.scale.set(b.w, b.h, b.d);
  body.position.y = b.h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Parapet: a real frame of four thin rims around the roof edge, so the
  // roof centre stays visible.
  const rimH = 0.7, rimT = 0.5;
  for (const [rw, rd, rx, rz] of [
    [b.w + 0.4, rimT, 0, b.d / 2],
    [b.w + 0.4, rimT, 0, -b.d / 2],
    [rimT, b.d + 0.4, b.w / 2, 0],
    [rimT, b.d + 0.4, -b.w / 2, 0],
  ]) {
    const rim = new THREE.Mesh(boxGeo, parapetMat);
    rim.scale.set(rw, rimH, rd);
    rim.position.set(rx, b.h + rimH / 2, rz);
    rim.castShadow = true;
    g.add(rim);
  }
  // AC units on the roof.
  const acCount = 1 + (Math.floor(b.w + b.d) % 3);
  for (let i = 0; i < acCount; i += 1) {
    const ac = new THREE.Mesh(boxGeo, acMat);
    ac.scale.set(1.4, 0.9, 1.1);
    ac.position.set(-b.w / 4 + i * (b.w / 3), b.h + 1.1, -b.d / 4 + (i % 2) * (b.d / 2));
    ac.castShadow = true;
    g.add(ac);
  }
  // Antenna on taller buildings.
  if (b.h > 18) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6, 6), antennaMat);
    ant.position.set(b.w / 4, b.h + 3.4, b.d / 4);
    g.add(ant);
    const cross = new THREE.Mesh(boxGeo, antennaMat);
    cross.scale.set(2.2, 0.12, 0.12);
    cross.position.set(b.w / 4, b.h + 5.4, b.d / 4);
    g.add(cross);
  }
  // Neon sign on the face toward the city centre.
  if (b.sign) {
    if (!signMats[b.sign]) {
      signMats[b.sign] = new THREE.MeshStandardMaterial({
        map: neonSignTexture(b.sign),
        emissive: 0xffffff, emissiveMap: neonSignTexture(b.sign),
        emissiveIntensity: 1.6, roughness: 0.4,
      });
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, b.w * 0.9), 3.2), signMats[b.sign]);
    const towardCenter = Math.atan2(-b.x, -b.z);
    const face = Math.round(towardCenter / (Math.PI / 2)) % 4;
    const y = b.h * 0.72;
    if (face === 0) { sign.position.set(0, y, b.d / 2 + 0.15); }
    else if (face === 1) { sign.position.set(b.w / 2 + 0.15, y, 0); sign.rotation.y = Math.PI / 2; }
    else if (face === 2) { sign.position.set(0, y, -b.d / 2 - 0.15); sign.rotation.y = Math.PI; }
    else { sign.position.set(-b.w / 2 - 0.15, y, 0); sign.rotation.y = -Math.PI / 2; }
    g.add(sign);
  }
  g.position.set(b.x, heightAt(b.x, b.z), b.z);
  g.rotation.y = b.rot;
  return g;
}

export function buildWorld() {
  const data = WORLD_DATA;
  // NOTE (part 2 fix): the lights and fog used to live on a private inner
  // scene that main.js never rendered — the world came out black except for
  // emissive materials. Lights now live on the returned group (at the origin,
  // so their world positions are unchanged) and the fog is returned for the
  // main scene to adopt.
  const fog = new THREE.Fog(0x3a2050, 90, 560);
  const group = new THREE.Group();

  const hemi = new THREE.HemisphereLight(0x9a7fe0, 0x4a3a55, 1.9);
  group.add(hemi);
  // Low violet ambient lifts shadowed ground and road so dusk never goes black.
  group.add(new THREE.AmbientLight(0x8a7ab0, 0.85));
  const sunLight = new THREE.DirectionalLight(0xffb36b, 3.2);
  sunLight.position.set(-180, 55, 40);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
  sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
  sunLight.shadow.camera.far = 600;
  group.add(sunLight);
  const fill = new THREE.DirectionalLight(0x7a6fd8, 1.1);
  fill.position.set(120, 80, -60);
  group.add(fill);

  // Sky dome: vertex-colour gradient, magenta top to orange horizon.
  const skyGeo = new THREE.SphereGeometry(700, 24, 16);
  const skyPos = skyGeo.attributes.position;
  const skyColors = new Float32Array(skyPos.count * 3);
  const top = new THREE.Color(0x2c1a5e), mid = new THREE.Color(0x8a3a7a), low = new THREE.Color(0xff8a5a);
  for (let i = 0; i < skyPos.count; i += 1) {
    const y = skyPos.getY(i) / 700;
    const c = y > 0.25
      ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75)
      : mid.clone().lerp(low, 1 - clamp((y + 0.2) / 0.45, 0, 1));
    skyColors[i * 3] = c.r; skyColors[i * 3 + 1] = c.g; skyColors[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  group.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

  // Sun disc + glow sprite, low in the west; repositioned each frame so the
  // glow stays with the camera (the avenue always leads toward the sun).
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a8, fog: false, transparent: true, opacity: 0.95 }),
  );
  group.add(sunDisc);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, fog: false }));
  glow.scale.set(280, 280, 1);
  group.add(glow);

  // Clouds: flattened ellipsoid blobs, drifting slowly.
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xd8a8c8, emissive: 0x5a2a55, emissiveIntensity: 0.55, roughness: 1, flatShading: true });
  const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 18; i += 1) {
    const cluster = new THREE.Group();
    const puffs = 2 + (i % 3);
    for (let p = 0; p < puffs; p += 1) {
      const m = new THREE.Mesh(cloudGeo, cloudMat);
      m.position.set(p * 9 - puffs * 4, (p % 2) * 2.5, (p * 7) % 9 - 4);
      m.scale.set(10 + (p % 3) * 4, 4.5, 7 + (p % 2) * 3);
      cluster.add(m);
    }
    cluster.position.set(-260 + (i * 53) % 520, 95 + (i * 17) % 55, -220 + (i * 37) % 440);
    clouds.add(cluster);
  }
  group.add(clouds);

  // Heightfield with vertex colours.
  const groundGeo = new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_DEPTH, 150, 140);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const c = terrainColor(x, z, h, slopeAt(x, z));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  ground.receiveShadow = true;
  group.add(ground);

  // Water: one translucent plane over the sea and harbor basin.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(230, 230),
    new THREE.MeshStandardMaterial({ color: 0x2a3a6e, transparent: true, opacity: 0.82, roughness: 0.25, metalness: 0.55 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(105, 0.15, 25);
  group.add(water);

  // Roads: dark asphalt ribbons following the terrain.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x453f4a, roughness: 0.92 });
  for (const r of ROADS) {
    const mesh = new THREE.Mesh(roadRibbon(r), roadMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Buildings + the lighthouse tower on its hill.
  const signMats = {};
  for (const b of data.buildings) group.add(buildBuilding(b, signMats));
  const tower = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xe8ddc8, roughness: 0.8 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.6, 26, 12), towerMat);
  shaft.position.y = 13;
  shaft.castShadow = true;
  tower.add(shaft);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2438, emissive: 0xffd9a0, emissiveIntensity: 1.2 }));
  lampRoom.position.y = 28;
  tower.add(lampRoom);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(4.4, 3.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a2a3a, roughness: 0.7 }));
  cap.position.y = 31.5;
  tower.add(cap);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false }));
  lampGlow.scale.set(24, 24, 1);
  lampGlow.position.y = 28;
  tower.add(lampGlow);
  tower.position.set(LIGHTHOUSE.x, heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z), LIGHTHOUSE.z);
  group.add(tower);

  function update(dt, camera) {
    // Clouds drift east, slowly.
    for (const c of clouds.children) {
      c.position.x += dt * 0.6;
      if (c.position.x > 300) c.position.x = -300;
    }
    // The sun and its glow sit west of the camera, so the avenue always leads
    // toward the light.
    if (camera) {
      sunDisc.position.set(camera.position.x - 420, 62, camera.position.z - 30);
      sunDisc.lookAt(camera.position);
      glow.position.set(camera.position.x - 420, 62, camera.position.z - 30);
    }
    lampGlow.material.opacity = 0.75 + 0.25 * Math.sin(performance.now() / 900);
  }

  return { group, update, data, fog };
}
