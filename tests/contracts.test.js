import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,statSync,readdirSync} from 'node:fs';import {resolve} from 'node:path';
import {sportsCarProportions} from '../game/vehicles.js';
const root=resolve('.');test('static game and dossier assets satisfy bundle contracts',()=>{const required=['game/index.html','game/main.js','game/world.js','game/missions.js','game/ui.js','game/audio.js','game/style.css','game/vendor/three.module.min.js','game/vendor/three.core.min.js','vendor/makefun-game.ts','main.ts','shots.json'];for(const p of required)assert.ok(statSync(resolve(root,p)).isFile(),`${p} exists`);const html=readFileSync(resolve(root,'game/index.html'),'utf8');assert.match(html,/type="module" src="\.\/main\.js"/);assert.doesNotMatch(html,/https?:\/\//);const three=readFileSync(resolve(root,'game/vendor/three.module.min.js'),'utf8');assert.match(three,/from '\.\/three\.core\.min\.js'/);const shots=JSON.parse(readFileSync(resolve(root,'shots.json'),'utf8'));assert.deepEqual(Object.keys(shots),['start','drive','chase','victory']);const images=readdirSync(resolve(root,'screenshots'));assert.equal(images.length,4);for(const name of images){const file=resolve(root,'screenshots',name);assert.ok(statSync(file).size<262144);assert.equal(readFileSync(file).readUInt16BE(0),0xffd8)}const owner=JSON.parse(readFileSync(resolve(root,'.makefun/owner.json'),'utf8'));assert.equal(owner.wallet,'DH3JqLcf8bKJWabY6HPfBtPZsjDkQgCbbX1WkjLvQSxu')});

test('neon-dusk HUD and city map are wired',()=>{const html=readFileSync(resolve(root,'game/index.html'),'utf8');for(const id of ['mission-card','chapter','stage-fill','stage-label','next','police-list','police-head','money','wanted','health-fill','weapon-slots','radio-line','speed','gear','dialogue','portrait','dialogue-name','dialogue-text','respect','respect-fill','citymap','bigmap','map-jobs','map-current','map-stats'])assert.ok(html.includes(`id="${id}"`),`index.html has #${id}`);assert.ok(html.includes('M / Esc close'));const css=readFileSync(resolve(root,'game/style.css'),'utf8');assert.match(css,/#map\{[^}]*border-radius:50%/);assert.match(css,/#citymap\{/);const ui=readFileSync(resolve(root,'game/ui.js'),'utf8');assert.match(ui,/drawCityMap/);assert.match(ui,/POLICE RESPONSE/);assert.match(ui,/CALLSIGNS/);const main=readFileSync(resolve(root,'game/main.js'),'utf8');assert.match(main,/KeyM/);assert.match(main,/drawCityMap/);const missions=readFileSync(resolve(root,'game/missions.js'),'utf8');assert.match(missions,/get progress/);assert.match(missions,/rewardFor/)});

test('sports cars have real GT proportions, not bubble proportions',()=>{
  const p=sportsCarProportions();
  assert.ok(p.roofY>=0.9&&p.roofY<=1.1,`roofline ${p.roofY} is low like a GT`);
  assert.ok(p.glasshouseHeight<0.35,`glasshouse ${p.glasshouseHeight} is small, never a dome`);
  assert.ok(p.hoodLength>p.cabinLength,`hood ${p.hoodLength} longer than cabin ${p.cabinLength}`);
  assert.ok(p.wheelRadius/p.bodyHeight>0.45,`wheels ${p.wheelRadius} are big vs body ${p.bodyHeight}`);
  assert.ok(p.wheelRadius/p.bodyHeight<0.75,`wheels ${p.wheelRadius} are not monster-truck tall vs body ${p.bodyHeight}`);
  assert.ok(p.width/p.roofY>1.9,`stance ${p.width} wide vs roof ${p.roofY}`);
  const vehicles=readFileSync(resolve(root,'game/vehicles.js'),'utf8');
  for(const part of ['splitter','spoiler','diffuser','LED','convertible','interceptor'])assert.ok(vehicles.toLowerCase().includes(part.toLowerCase()),`vehicles.js has ${part}`);
  assert.match(vehicles,/brakeLights/);
  assert.match(vehicles,/sportsCarProportions/);
});

test('terrain is detailed: instanced grass, cracks, puddles, dirt paths',()=>{
  const world=readFileSync(resolve(root,'game/world.js'),'utf8');
  const tufts=world.match(/const GRASS_TUFTS=(\d+)/);
  assert.ok(tufts&&Number(tufts[1])>1000,`grass tufts ${tufts&&tufts[1]} above threshold`);
  for(const part of ['InstancedMesh','createGrass','createTerrainDetails','dirtPath','puddle','manhole','drain','shrub','flower'])assert.ok(world.includes(part),`world.js has ${part}`);
  assert.match(world,/Cracks: dark jagged strokes/);
  assert.match(world,/Repair patches/);
  assert.match(world,/Oil stains/);
  assert.match(world,/victory sightline corridor/);
  const detail=readFileSync(resolve(root,'game/scene-detail.js'),'utf8');
  assert.match(detail,/sand/);
  assert.match(detail,/smoothstep\(z,56,68\)/);
});

test('sound covers siren, screech and a radio bed',()=>{
  const audio=readFileSync(resolve(root,'game/audio.js'),'utf8');
  for(const part of ['siren','screech','radio','update(dt','note(','noiseBuf'])assert.ok(audio.includes(part),`audio.js has ${part}`);
  const main=readFileSync(resolve(root,'game/main.js'),'utf8');
  assert.match(main,/sound\.update\(dt/);
  assert.match(main,/brakeLights/);
  assert.match(main,/Handbrake drift/);
  assert.match(main,/FOV kick/);
});

test('rev6 fixes: front hero angle, readable driver, dressed hill, calmer ground',()=>{
  const staging=readFileSync(resolve(root,'game/shot-staging.js'),'utf8');
  assert.match(staging,/z\+6/); // drive camera ahead of the nose
  assert.match(staging,/cabinLight/); // lit cabin for the shot driver
  assert.match(staging,/39\.5/); // split interceptors, right lane
  assert.match(staging,/hillGrass/); // hill-grass count in diagnostics
  const vehicles=readFileSync(resolve(root,'game/vehicles.js'),'utf8');
  assert.match(vehicles,/opacity: \.42/); // lighter cabin glass
  assert.match(vehicles,/emissiveIntensity: 0\.9/); // dimmer red taillight bar
  assert.match(vehicles,/emissiveIntensity: 1\.1/); // dimmer cool headlamp strips
  assert.match(vehicles,/grilleMat/); // dark gunmetal grille, not chrome bars
  const world=readFileSync(resolve(root,'game/world.js'),'utf8');
  assert.match(world,/dressLighthouseHill/);
  assert.match(world,/hillGrassPositions/);
  assert.match(world,/textured\('asphalt','#a8aec0',21\)/); // cooler, less pink road
  const detail=readFileSync(resolve(root,'game/scene-detail.js'),'utf8');
  assert.match(detail,/\.5\)\*16/); // softer ground grain
  assert.match(detail,/repeat\.set\(24,22\)/); // larger ground blotches
  const main=readFileSync(resolve(root,'game/main.js'),'utf8');
  assert.match(main,/skyGlow/); // victory sky glow
  assert.match(main,/85,-95/); // victory clouds sit high in the up-tilted frame
});

test('all user-visible game text is English',()=>{const files=['game/index.html','game/main.js','game/world.js','game/missions.js','game/ui.js','game/audio.js','game/style.css','game/shot-staging.js','game/scene-detail.js','game/vehicles.js'];const proper=/(pelabuhan senja|pasar senja|tanjung api|lorong senja|raka|mira|dimas|pelabuhan-save)/gi;const indonesian=/\b(kamu|anda|jalan|mobil|polisi|kota|selamat|mulai|lanjut|kembali|misi|selesai|gagal|uang|kesehatan|amunisi|kecepatan|tujuan|distrik|mudah|sulit|berhenti|jeda|tangkap|dicari|bintang|tembak|lari|masuk|keluar|beli|bayar|biaya|tersisa|tersedia|tunggu|siap|pergi|pulang|rumah|toko|barang|paket|kiriman|kurir|penjaga|malam|pagi|sore|hari|minggu|bulan|tahun|tidak|bukan|dan|atau|dengan|untuk|dari|yang|ini|itu|ada|adalah|sudah|belum|akan|bisa|harus|jangan|tolong|senja|lorong|tanjung|pasar|pelabuhan)\b/i;for(const f of files){const text=readFileSync(resolve(root,f),'utf8').replace(/<br\s*\/?>/gi,' ').replace(proper,'');const hit=text.match(indonesian);assert.equal(hit,null,`${f}: non-English word ${hit&&hit[0]}`)}});
