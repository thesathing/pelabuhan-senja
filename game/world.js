import * as THREE from './vendor/three.module.min.js';
import {duskSky,detailGround,facadeTexture,signTexture,glowSprite,SUN_DIR} from './scene-detail.js';
import {buildCarBody,mergeGeometries,xform} from './vehicles.js';
const preserveShotGround=['start','victory'].includes(new URLSearchParams(location.search).get('shot'));
const GRASS_TUFTS=1600;
const ROCK_COUNT=220;

const mat=(color,roughness=.82,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const M={road:mat('#373b3b'),edge:mat('#b9aa8a'),white:mat('#e6d8b8'),yellow:mat('#dcae4f'),grass:mat('#52694d'),sand:mat('#b9a078'),stone:mat('#77766d'),brick:mat('#a75e49'),plaster:mat('#d0b999'),cream:mat('#dbcead'),blue:mat('#68848a'),roof:mat('#63483d'),dark:mat('#202b2c'),glass:new THREE.MeshStandardMaterial({color:'#547881',roughness:.23,metalness:.25}),lit:new THREE.MeshStandardMaterial({color:'#ffc879',emissive:'#c56a2f',emissiveIntensity:1.2}),litPink:new THREE.MeshStandardMaterial({color:'#ff9ec7',emissive:'#ff5fa2',emissiveIntensity:1.6}),litCyan:new THREE.MeshStandardMaterial({color:'#9be8ff',emissive:'#37b8d4',emissiveIntensity:1.6}),water:new THREE.MeshStandardMaterial({color:'#2e6b8a',roughness:.24,metalness:.25,transparent:true,opacity:.9}),leaf:mat('#496d4a'),trunk:mat('#795a40'),metal:mat('#686c67',.48,.6),tire:mat('#202323')};
const box=new THREE.BoxGeometry(1,1,1);
function mesh(g,m,x,y,z,group){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);group.add(o);o.castShadow=true;o.receiveShadow=true;return o}
function cube(group,m,x,y,z,sx,sy,sz){const o=mesh(box,m,x,y,z,group);o.scale.set(sx,sy,sz);return o}
function seeded(seed){let a=seed>>>0;return()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296}}
function textureCanvas(kind,seed){const S=1024;const c=document.createElement('canvas');c.width=S;c.height=S;const x=c.getContext('2d'),r=seeded(seed);let base=kind==='brick'?'#a8614d':kind==='concrete'?'#9c978b':kind==='asphalt'?'#2e2a33':kind==='sand'?'#c2a67b':kind==='stone'?'#77766d':kind==='roof'?'#67534a':kind==='road'?'#3a3340':'#cbbd9d';x.fillStyle=base;x.fillRect(0,0,S,S);for(let i=0;i<12000;i++){const v=Math.floor(r()*45),alpha=.08+r()*.22;x.fillStyle=`rgba(${r()>.5?255:0},${r()>.5?240:0},${r()>.5?220:0},${alpha})`;if(kind==='brick'){let row=Math.floor(i/50),off=row%2?25:0,xx=(i%50)*22+off;x.fillRect(xx,Math.floor(row*22+r()*8),18,16)}else if(kind==='asphalt'||kind==='road'){x.fillStyle=`rgba(230,220,190,${r()*.05})`;x.fillRect(r()*S,r()*S,1+r()*2,1+r()*2)}else{x.fillRect(r()*S,r()*S,4+r()*24,2+r()*10)}}
if(kind==='asphalt'||kind==='road'){for(let i=0;i<40;i++){x.fillStyle=`rgba(${r()>.5?60:20},${r()>.5?60:20},${r()>.5?55:20},${.03+r()*.04})`;x.beginPath();x.arc(r()*S,r()*S,30+r()*60,0,7);x.fill()}
// Cracks: dark jagged strokes wandering across the asphalt.
for(let i=0;i<14;i++){let cx=r()*S,cy=r()*S,ang=r()*Math.PI*2;x.strokeStyle=`rgba(12,10,14,${.45+r()*.25})`;x.lineWidth=2+r()*2;x.beginPath();x.moveTo(cx,cy);for(let s=0;s<12;s++){ang+=(r()-.5)*1.4;cx+=Math.cos(ang)*(14+r()*22);cy+=Math.sin(ang)*(14+r()*22);x.lineTo(cx,cy)}x.stroke()}
// Repair patches: darker rectangles with a worn lighter edge.
for(let i=0;i<7;i++){const px=r()*S,py=r()*S,pw=70+r()*130,ph=50+r()*90;x.fillStyle=`rgba(16,14,18,${.5+r()*.2})`;x.fillRect(px,py,pw,ph);x.strokeStyle=`rgba(210,200,170,${.12+r()*.1})`;x.lineWidth=3;x.strokeRect(px,py,pw,ph)}
// Oil stains: soft dark blobs.
for(let i=0;i<6;i++){const ox=r()*S,oy=r()*S,or=24+r()*46;const g=x.createRadialGradient(ox,oy,2,ox,oy,or);g.addColorStop(0,'rgba(8,8,12,.55)');g.addColorStop(1,'rgba(8,8,12,0)');x.fillStyle=g;x.beginPath();x.arc(ox,oy,or,0,7);x.fill()}}if(kind==='brick'){x.strokeStyle='#493a34';x.lineWidth=3;for(let y=0;y<S;y+=44){x.beginPath();x.moveTo(0,y);x.lineTo(S,y);x.stroke()}}const t=new THREE.CanvasTexture(c);t.anisotropy=16;return t}
function textured(kind,color,seed){return new THREE.MeshStandardMaterial({color,map:textureCanvas(kind,seed),roughness:kind==='asphalt'?.92:.9})}
function buildingTexture(type,seed){const tints={brick:'#ffd9c9',plaster:'#ffe9c9',cream:'#fff3d0',concrete:'#d9d9e8',blue:'#c9d9f0'};return new THREE.MeshStandardMaterial({color:tints[type]||'#ffffff',map:facadeTexture(type,seed),roughness:.94})}
function createCar(scene,x,z,type='coupe',color='#68777a',police=false){const g=new THREE.Group();g.position.set(x,.35,z);scene.add(g);const dims=buildCarBody(g,type,color,police);g.userData={...g.userData,type,police,length:dims.length};return g}
// Seated driver (head + torso + arms + steering wheel), sized to fit a car cabin.
export function createDriver(group,cloth='#273e43',skin='#b98263'){
  const p=new THREE.Group();group.add(p);
  const shirt=mat(cloth),skinM=mat(skin);
  const torso=mesh(new THREE.CapsuleGeometry(.17,.3,4,8),shirt,0,.28,0,p);torso.scale.set(.9,1,.6);
  const head=mesh(new THREE.SphereGeometry(.15,16,12),skinM,0,.62,0,p);
  cube(p,mat('#272b2b'),0,.8,0,.3,.06,.32);
  for(const side of [-1,1]){const arm=mesh(new THREE.CapsuleGeometry(.06,.3,4,8),shirt,side*.2,.32,0,p);arm.rotation.z=side*.15;arm.rotation.x=-.7}
  const wheel=mesh(new THREE.TorusGeometry(.22,.035,8,20),mat('#202b2c'),.42,.32,0,p);wheel.rotation.set(-.4,Math.PI/2,0);
  p.userData.head=head;p.userData.torso=torso;
  return p;
}
export function createPerson(group,cloth,skin='#b98263',pose='walk'){const p=new THREE.Group();group.add(p);const shirt=mat(cloth),skinM=mat(skin),pants=mat('#343c3b');const torso=mesh(new THREE.CapsuleGeometry(.25,.52,4,8),shirt,0,1.12,0,p);torso.scale.set(.85,1,.52);mesh(new THREE.SphereGeometry(.22,16,12),skinM,0,1.72,0,p);cube(p,mat('#272b2b'),0,1.99,0,.45,.09,.48);for(const side of [-1,1]){const arm=mesh(new THREE.CapsuleGeometry(.085,.45,4,8),shirt,side*.33,1.17,0,p);arm.rotation.z=side*-.14;const hand=mesh(new THREE.SphereGeometry(.08,10,8),skinM,side*.4,.87,0,p);hand.userData.armSide=side;const leg=mesh(new THREE.CapsuleGeometry(.105,.47,4,8),pants,side*.14,.49,0,p);leg.userData.legSide=side}p.userData.pose=pose;return p}
// Three crossed blades per tuft, shared by the world grass and the
// lighthouse-hill dressing so both read as the same vegetation.
function grassTuftGeometry(){
  const blade=(rx,ry)=>{
    const g=new THREE.BufferGeometry();
    const w=.07,h=.62+ry*.22,lean=.12;
    const v=new Float32Array([
      -w,0,0,  w,0,0,  w+lean,h,0,
      -w,0,0,  w+lean,h,0,  -w+lean,h,0,
    ]);
    g.setAttribute('position',new THREE.BufferAttribute(v,3));
    g.computeVertexNormals();
    const m=new THREE.Matrix4().makeRotationY(rx);
    g.applyMatrix4(m);
    return g;
  };
  const parts=[];
  for(const a of [0,Math.PI/3,2*Math.PI/3])parts.push(blade(a,a*.3));
  return mergeGeometries(parts.map((geo,i)=>({geo,color:'#ffffff',matrix:new THREE.Matrix4()})));
}
export class CityWorld{
constructor(scene,seed=9){this.scene=scene;this.rand=seeded(seed);this.buildings=[];this.cars=[];this.people=[];this.police=[];this.markers=[];this.createSky();this.createTerrain();this.createRoads();this.createHarbor();this.createBuildings();this.createPlants();this.createGrass();this.dressLighthouseHill();this.createTerrainDetails();this.createProps();this.createTraffic()}
createProps(){
  // Market stalls with striped awnings and visible goods, plus harbor barrels.
  const stripeTex=kind=>{const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');for(let i=0;i<8;i++){x.fillStyle=i%2? '#e8dfc6':'#b6533d';x.fillRect(i*32,0,32,64)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t};
  const awnMat=new THREE.MeshStandardMaterial({map:stripeTex(),roughness:.85});
  const fruitColors=['#c65a35','#e2b85f','#7a9b4a','#b6533d','#d97b2f'];
  for(const [sx,sz] of [[26,48],[46,48],[16,48]]){
    const stall=new THREE.Group();stall.position.set(sx,this.height(sx,sz),sz);this.scene.add(stall);
    for(const [px,pz] of [[-1.4,-.9],[1.4,-.9],[-1.4,.9],[1.4,.9]])cube(stall,mat('#6b4a2f'),px,1.1,pz,.12,2.2,.12);
    cube(stall,mat('#9d7953'),0,.95,0,3.2,.14,2.1);
    const awn=mesh(new THREE.BoxGeometry(3.6,.08,2.6),awnMat,0,2.35,0,stall);awn.rotation.x=-.18;
    for(let i=0;i<9;i++){const fx=-1.2+(i%3)*1.2,fz=-.6+Math.floor(i/3)*.6;const good=mesh(new THREE.SphereGeometry(.16+this.rand()*.06,10,8),mat(fruitColors[i%5]),fx,1.18,fz,stall);good.scale.y=.8}
    for(let i=0;i<3;i++)cube(stall,mat('#c4a574'),-1.1+i*1.1,1.12,.7,.5,.2,.4);
  }
  for(const [bx,bz] of [[34,68],[40,70],[46,68],[32,72],[44,72]]){
    const barrel=new THREE.Group();barrel.position.set(bx,this.height(bx,bz),bz);this.scene.add(barrel);
    const body=mesh(new THREE.CylinderGeometry(.42,.38,1.05,14),mat('#7a5a38'),0,.55,0,barrel);
    for(const by of [.25,.85]){const band=mesh(new THREE.TorusGeometry(.42,.03,6,18),mat('#3a3f3e'),0,by,0,barrel);band.rotation.x=Math.PI/2}
  }
}
createSky(){this.scene.background=new THREE.Color('#2a2350');this.scene.fog=new THREE.FogExp2('#c97ba8',.0014);duskSky(this.scene);this.scene.add(new THREE.HemisphereLight('#ffb8d9','#3a2a55',2.35));const sun=new THREE.DirectionalLight('#ffb27a',3.4);sun.position.set(SUN_DIR.x*180,SUN_DIR.y*180+42,SUN_DIR.z*180);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.left=-180;sun.shadow.camera.right=180;sun.shadow.camera.top=180;sun.shadow.camera.bottom=-180;sun.shadow.bias=-.0004;this.scene.add(sun);const fill=new THREE.DirectionalLight('#ff9ec7',.55);fill.position.set(120,90,140);this.scene.add(fill);const halo=glowSprite('#ff7a5c',220,.9);halo.onBeforeRender=(_renderer,_scene,camera)=>{halo.position.copy(camera.position).addScaledVector(SUN_DIR,380);halo.updateMatrixWorld()};this.scene.add(halo);const halo2=glowSprite('#ff5fa2',380,.4);halo2.onBeforeRender=(_renderer,_scene,camera)=>{halo2.position.copy(camera.position).addScaledVector(SUN_DIR,380);halo2.updateMatrixWorld()};this.scene.add(halo2);this.clouds=[];for(let i=0;i<12;i++){const c=new THREE.Group();for(let j=0;j<6;j++){const b=mesh(new THREE.SphereGeometry(3+this.rand()*4,12,10),new THREE.MeshBasicMaterial({color:i%2?'#ff9ec7':'#c9a7ff',transparent:true,opacity:.32}),j*4,Math.sin(j)*1.5,0,c);b.scale.y=.4}c.position.set(-130+this.rand()*280,34+this.rand()*32,-150+this.rand()*250);this.scene.add(c);this.clouds.push(c)}}
height(x,z){let h=1.2*Math.sin(x*.025)*Math.cos(z*.022)+.5*Math.sin((x+z)*.07);if(z>68)h-=Math.min(4,(z-68)*.06);const hill=Math.max(0,1-Math.hypot(x-100,z+55)/48);h+=hill*hill*31;const coast=Math.max(0,Math.min(1,(z-42)/18));let ground=h*(1-coast)+1.4*coast;
// Road corridors are graded flat so no road ends buried in a bump or a slope.
const nearV=[-80,-45,-5,35,75,115].some(v=>Math.abs(x-v)<6);
const nearH=[-120,-78,-38,2,42,56,112].some(v=>Math.abs(z-v)<5);
if((nearV||nearH)&&hill<0.02)ground=THREE.MathUtils.lerp(ground,1.04,.9);
const shoulder=1-THREE.MathUtils.smoothstep(Math.abs(x-35),5,9);return !preserveShotGround&&z>-45&&z<56?THREE.MathUtils.lerp(ground,1.04,shoulder):ground}
createTerrain(){const g=new THREE.PlaneGeometry(300,280,110,100);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),z=p.getZ(i);p.setY(i,this.height(x,z))}g.computeVertexNormals();const grass=preserveShotGround?textured('grass','#778066',41):detailGround(g);const ground=mesh(g,grass,0,0,0,this.scene);ground.receiveShadow=true;const hillMat=textured('stone','#888377',7);const rockGeo=new THREE.DodecahedronGeometry(1,1);for(let i=0;i<35;i++){let x=84+this.rand()*35,z=-68+this.rand()*35;const sx=1+this.rand()*3,sy=1+this.rand()*2,sz=1+this.rand()*2;if(Math.hypot(x-100,z+52)<10)continue;const rock=mesh(rockGeo,hillMat,x,this.height(x,z)+.8,z,this.scene);rock.scale.set(sx,sy,sz)}}
createRoads(){const roadMat=textured('asphalt','#a8aec0',21);if(!preserveShotGround){roadMat.map.wrapS=roadMat.map.wrapT=THREE.RepeatWrapping;roadMat.map.repeat.set(2,32);roadMat.map.anisotropy=8;M.edge.map=textureCanvas('concrete',44);M.edge.map.wrapS=M.edge.map.wrapT=THREE.RepeatWrapping;M.edge.map.repeat.set(1,45);}
// Vertical roads run the full map and meet the waterfront road and the south ring.
for(let x of [-80,-45,-5,35,75,115]){const cz=x===-80?-4:-8.5,len=x===-80?232:253;cube(this.scene,roadMat,x,1,cz,9,.22,len);for(let z=cz-len/2+6;z<cz+len/2-4;z+=10){cube(this.scene,M.yellow,x,1.13,z, .18,.04,4)}for(let side of [-1,1]){cube(this.scene,M.edge,x+side*5.3,1.13,cz,1.6,.3,len);cube(this.scene,M.stone,x+side*4.62,1.19,cz,.25,.18,len)}}
// Horizontal roads tie every vertical road together; the z=56 road is the waterfront.
for(let z of [-120,-78,-38,2,42,56,112]){cube(this.scene,roadMat,35,1,z,230,.22,8);for(let x=-75;x<145;x+=10)cube(this.scene,M.white,x,1.13,z,4,.035,.14);for(let side of [-1,1]){cube(this.scene,M.edge,35,1.13,z+side*5.3,230,.3,1.6);cube(this.scene,M.stone,35,1.19,z+side*4.62,230,.18,.25)}}
// Zebra crosswalks: stripes run ACROSS the road (long in x, narrow in z), fully on the road.
for(let z of [-42,-2,38,52])for(let i=0;i<5;i++)cube(this.scene,M.white,35,1.14,z+i*1.35-2.7,7.6,.04,.7);
for(let x of [-45,-5,75,115])for(let i=0;i<5;i++)cube(this.scene,M.white,x+i*1.35-2.7,1.14,42,.7,.04,7.6)}
createHarbor(){const water=mesh(new THREE.PlaneGeometry(220,110,50,30),M.water,36,.2,112,this.scene);water.rotation.x=-Math.PI/2;water.position.y=.15;this.waterMesh=water;for(let z=64;z<146;z+=16)cube(this.scene,mat('#776957'),34,1,z,122,.8,3);for(let x=-26;x<92;x+=20){cube(this.scene,mat('#665744'),x,1.3,75,3,.9,44);for(let z=61;z<90;z+=8)cube(this.scene,mat('#8c7252'),x,1.75,z,2,1.6,2)}for(let i=0;i<4;i++){const x=-10+i*29,z=103+i%2*12;this.createBoat(x,z,i)}}
createBoat(x,z,i){const g=new THREE.Group();g.position.set(x,.1,z);this.scene.add(g);const hull=mesh(new THREE.CapsuleGeometry(1.25,5.5,4,12),mat(i%2?'#d6d0b9':'#7d4034'),0,.9,0,g);hull.rotation.z=Math.PI/2;hull.scale.set(.55,.55,1);cube(g,mat('#e8dfc6'),0,1.35,0,2.6,.65,2.2);cube(g,mat('#557680'),-.1,1.68,0,1.6,.5,2.1);const mast=cube(g,M.metal,.7,2.7,0,.08,2.2,.08);const sail=mesh(new THREE.BufferGeometry(),M.cream,0,0,0,g);const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute([.74,3.65,0,.74,1.8,0,-1.4,2.0,0],3));sg.setIndex([0,1,2]);sg.computeVertexNormals();const sailMesh=mesh(sg,mat('#e5d3ab'),0,0,0,g);g.userData.baseY=.1;this.boats??=[];this.boats.push(g)}
createBuildings(){const palette=['brick','plaster','cream','blue','concrete'];
const makeWindow=()=>{const wg=new THREE.Group();
  const litPick=()=>{const r=this.rand();return r>.8?M.litPink:r>.68?M.litCyan:r>.5?M.lit:M.glass};
  cube(wg,M.dark,0,0,0,1.55,2.1,.16);
  cube(wg,litPick(),0,0,.1,1.17,1.66,.035);
  cube(wg,M.plaster,0,-1.05,.12,1.8,.13,.24);
  cube(wg,M.metal,0,0,.19,.055,1.65,.07);
  cube(wg,M.metal,0,0,.2,1.3,.055,.07);
  if(this.rand()>.78){cube(wg,M.metal,0,-1.25,.38,1.95,.08,.8);for(let q=0;q<5;q++)cube(wg,M.metal,-0.8+q*.4,-1.04,.76,.035,.4,.035)}
  return wg};
for(let row=-1;row<4;row++)for(let col=-2;col<5;col++){const x=-59+col*39,z=-56+row*34;if(Math.abs(z)<8||Math.abs(x-35)<9||(Math.abs(x-98)<21&&z>10&&z<65))continue;if(Math.hypot(x-100,z+55)<24)continue;if([-78,-38,2,42,56,112].some(v=>Math.abs(z-v)<6))continue;let w=18+this.rand()*11,d=16+this.rand()*8;for(const vx of [-80,-45,-5,35,75,115]){const gap=Math.abs(x-vx)-6.2;if(w/2>gap)w=Math.max(8,gap*2)}for(const hz of [-78,-38,2,42,56,112]){const gap=Math.abs(z-hz)-5.1;if(d/2>gap)d=Math.max(8,gap*2)}const floors=2+Math.floor(this.rand()*4),h=floors*3.7,kind=palette[Math.floor(this.rand()*palette.length)],g=new THREE.Group();g.position.set(x,this.height(x,z),z);this.scene.add(g);const facade=buildingTexture(kind,Math.floor(this.rand()*10000));const body=cube(g,facade,0,h/2,0,w,h,d);body.material.side=THREE.DoubleSide;const shop=this.rand()>.58;
// Plinth around the base on all four faces.
cube(g,mat('#a99c83'),0,.35,d/2+.06,w,.7,.22);cube(g,mat('#a99c83'),0,.35,-d/2-.06,w,.7,.22);cube(g,mat('#a99c83'),w/2+.06,.35,0,.22,.7,d);cube(g,mat('#a99c83'),-w/2-.06,.35,0,.22,.7,d);
// Windows on every face — no blank wall anywhere the camera looks.
for(let floor=0;floor<floors;floor++){const y=2+floor*3.7;
  for(let wx=-w/2+2;wx<w/2-1;wx+=3.5){if(floor===0&&Math.abs(wx)<2.4)continue;if(!(floor===0&&shop)){const wp=makeWindow();wp.position.set(wx,y,d/2+.12);g.add(wp)}const wn=makeWindow();wn.position.set(wx,y,-d/2-.12);wn.rotation.y=Math.PI;g.add(wn)}
  for(let wz=-d/2+2;wz<d/2-1;wz+=3.5){if(floor===0&&Math.abs(wz)<2.4)continue;const we=makeWindow();we.position.set(w/2+.12,y,wz);we.rotation.y=Math.PI/2;g.add(we);const ww=makeWindow();ww.position.set(-w/2-.12,y,wz);ww.rotation.y=-Math.PI/2;g.add(ww)}
}
// Doors on every face (the +z face gets a shopfront instead when it has one).
const door=(dx,dy,dz,ry)=>{const dg=new THREE.Group();dg.position.set(dx,dy,dz);dg.rotation.y=ry;cube(dg,M.dark,0,0,0,1.7,2.6,.3);cube(dg,M.glass,0,.35,.16,1.3,1.9,.06);cube(dg,mat('#e0d1b0'),0,1.45,.18,2.0,.18,.3);g.add(dg)};
if(!shop)door(0,1.3,d/2+.15,0);door(0,1.3,-d/2-.15,Math.PI);door(w/2+.15,1.3,0,Math.PI/2);door(-w/2-.15,1.3,0,-Math.PI/2);
// Floor band trim on all four faces.
for(let floor=0;floor<floors;floor++){cube(g,mat('#e0d1b0'),0,floor*3.7+.35,d/2+.16,w+.25,.24,.3);cube(g,mat('#e0d1b0'),0,floor*3.7+.35,-d/2-.16,w+.25,.24,.3);cube(g,mat('#e0d1b0'),w/2+.16,floor*3.7+.35,0,.3,.24,d+.25);cube(g,mat('#e0d1b0'),-w/2-.16,floor*3.7+.35,0,.3,.24,d+.25)}
const roofType=Math.floor(this.rand()*3);
if(roofType===0){cube(g,M.roof,0,h+.32,0,w+.8,.65,d+.7);for(let q=-w/2;q<w/2;q+=2)cube(g,M.roof,q,h+.69,0,.08,.12,d+.7)}else if(roofType===1){const roofGeo=new THREE.ConeGeometry(Math.max(w,d)*.68,2.8,4);const roof=mesh(roofGeo,M.roof,0,h+1.35,0,g);roof.rotation.y=Math.PI/4}else{cube(g,M.cream,0,h+.35,0,w+.7,.7,d+.7);cube(g,M.plaster,0,h+.72,0,w+.8,.12,d+.8)}
// Parapet rim on flat roofs, plus an AC unit and an antenna on every roof.
if(roofType!==1){for(const [px,pz,sx,sz] of [[0,d/2,w+.3,.3],[0,-d/2,w+.3,.3],[w/2,0,.3,d+.3],[-w/2,0,.3,d+.3]])cube(g,M.roof,px,h+.28,pz,sx,.55,sz)}
cube(g,M.metal,-w*.3,h+.7,d*.15,.8,.7,.7);cube(g,M.dark,-w*.3,h+1.08,d*.15,.65,.08,.54);
mesh(new THREE.CylinderGeometry(.05,.05,2.2,8),M.metal,w*.32,h+1.1,-d*.2,g);cube(g,M.metal,w*.32,h+1.9,-d*.2,.9,.06,.06);
if(shop){cube(g,M.dark,0,2.05,d/2+.27,w*.46,2.5,.38);const aw=mat(this.rand()>.5?'#b6533d':'#e2b85f');cube(g,aw,0,3.22,d/2+.65,w*.54,.3,1);for(let q=-w*.23;q<w*.24;q+=.7)cube(g,mat('#f1dfb9'),q,3.22,d/2+1.17,.08,.3,.02);const names=['MARKET','HARBOUR CAFE','FISH STALL','BAKERY','TEA HOUSE','BOAT SUPPLY','ANCHOR BAR'];const neons=['#ff5fa2','#37e0ff','#ffd23d','#ff8a3d','#7dff9e','#c97dff','#ff5fa2'];const label=names[(this.shopCount=(this.shopCount||0))%names.length];const neon=neons[this.shopCount%neons.length];this.shopCount++;const signTex=signTexture(label,neon);const signMat=new THREE.MeshStandardMaterial({color:'#ffffff',map:signTex,emissiveMap:signTex,emissive:'#ffffff',emissiveIntensity:1.7,roughness:.85});const sign=cube(g,signMat,0,4.1,d/2+.35,w*.62,.6,.14);const signGlow=glowSprite(neon,7,.35);signGlow.position.set(0,4.1,d/2+.9);g.add(signGlow);this.buildings.push({x,z,sign})}
this.buildings.push({x,z,w,d,h,kind})}
// Lighthouse on its own raised headland
const lx=100,lz=-58;const light=new THREE.Group();light.position.set(lx,this.height(lx,lz),lz);this.scene.add(light);const geo=new THREE.CylinderGeometry(1.8,3.1,18,16);mesh(geo,mat('#e4d4b5'),0,9,0,light);for(let y=4;y<16;y+=5){const band=new THREE.Mesh( new THREE.CylinderGeometry(2.2-y*.018,2.45-y*.018,.7,16),mat('#ad5140'));band.position.y=y;light.add(band)}const top=mesh(new THREE.CylinderGeometry(2.2,2.2,1.2,16),M.dark,0,18.5,0,light);mesh(new THREE.ConeGeometry(2.8,2.4,16),M.roof,0,20.2,0,light);const glow=mesh(new THREE.SphereGeometry(1.1,16,12),new THREE.MeshBasicMaterial({color:'#ffe5a0'}),0,18.5,0,light);this.lighthouse=light}
createPlants(){const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.3,.5,.24,1.1);leafShape.quadraticCurveTo(.2,1.7,0,2.1);leafShape.quadraticCurveTo(-.2,1.7,-.24,1.1);leafShape.quadraticCurveTo(-.3,.5,0,0);const leafGeo=new THREE.ExtrudeGeometry(leafShape,{depth:.04,bevelEnabled:false});const nutGeo=new THREE.SphereGeometry(.18,8,6);const greens=['#3f6b3f','#527a45','#466f42'];for(let i=0;i<95;i++){let x=-90+this.rand()*210,z=-95+this.rand()*195;if(z>68||this.nearRoad(x,z))continue;const tree=new THREE.Group();tree.position.set(x,this.height(x,z),z);tree.userData.palm=true;this.scene.add(tree);const lean=(this.rand()-.5)*.55;const trunkGeo=new THREE.CylinderGeometry(.22,.43,5.5,9,4);const pos=trunkGeo.attributes.position;for(let k=0;k<pos.count;k++)pos.setX(k,pos.getX(k)+Math.max(0,pos.getY(k))*lean);trunkGeo.computeVertexNormals();mesh(trunkGeo,M.trunk,0,2.7,0,tree);
  // Two-segment drooping fronds, merged into one mesh per palm.
  const pieces=[],up=new THREE.Vector3(0,1,0),twist=new THREE.Quaternion().setFromAxisAngle(up,Math.PI/2);
  for(let f=0;f<9;f++){const a=f*Math.PI/4.5+this.rand()*.4,green=greens[f%3];
    const dirA=new THREE.Vector3(Math.cos(a)*Math.cos(.45),Math.sin(.45),Math.sin(a)*Math.cos(.45));
    const baseA=new THREE.Vector3(0,5.35,0).addScaledVector(dirA,1.0);
    const qA=new THREE.Quaternion().setFromUnitVectors(up,dirA).multiply(twist);
    pieces.push({geo:leafGeo,color:green,matrix:new THREE.Matrix4().compose(baseA,qA,new THREE.Vector3(1,1,1))});
    const dirB=new THREE.Vector3(Math.cos(a)*Math.cos(-.85),Math.sin(-.85),Math.sin(a)*Math.cos(-.85));
    const baseB=new THREE.Vector3(0,5.35,0).addScaledVector(dirA,1.9).addScaledVector(dirB,1.0);
    const qB=new THREE.Quaternion().setFromUnitVectors(up,dirB).multiply(twist);
    pieces.push({geo:leafGeo,color:green,matrix:new THREE.Matrix4().compose(baseB,qB,new THREE.Vector3(1,1,1))});
  }
  for(let k=0;k<3;k++){const a=this.rand()*Math.PI*2;pieces.push({geo:nutGeo,color:'#6b4a2f',matrix:new THREE.Matrix4().makeTranslation(Math.cos(a)*.3,5.15,Math.sin(a)*.3)})}
  const crown=new THREE.Mesh(mergeGeometries(pieces),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}));
  crown.castShadow=true;crown.receiveShadow=true;tree.add(crown);}for(let z=-70;z<65;z+=28){for(let side of [-1,1]){let x=35+side*7.5;const lamp=new THREE.Group();lamp.position.set(x,this.height(x,z),z);this.scene.add(lamp);cube(lamp,M.dark,0,3.5,0,.14,7,.14);cube(lamp,M.metal,side*.45,6.7,0,1.1,.1,.1);const bulb=mesh(new THREE.SphereGeometry(.22,12,8),new THREE.MeshBasicMaterial({color:'#ffd38a'}),side*.9,6.5,0,lamp);bulb.userData.lamp=true;this.lamps??=[];this.lamps.push(bulb);const lampGlow=glowSprite('#ffbe70',4.5,.5);lampGlow.position.set(side*.9,6.5,0);lamp.add(lampGlow);const pool=mesh(new THREE.CircleGeometry(3.2,20),new THREE.MeshBasicMaterial({color:'#ffbe70',transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false}),side*.9,.12,0,lamp);pool.rotation.x=-Math.PI/2;pool.castShadow=false;pool.receiveShadow=false;const light=new THREE.PointLight('#ffbe70',1.1,16);light.position.set(side*.9,6.2,0);lamp.add(light)}}}
nearRoad(x,z){return [-78,-38,2,42].some(r=>Math.abs(z-r)<7)||[-45,-5,35,75,115].some(r=>Math.abs(x-r)<8)}
// Clear of every road corridor by the given margin, so grass and rocks never
// sit on asphalt or block a screenshot sightline.
roadClear(x,z,margin=7.5){
  const dz=Math.min(...[-120,-78,-38,2,42,56,112].map(v=>Math.abs(z-v)));
  const dx=Math.min(...[-80,-45,-5,35,75,115].map(v=>Math.abs(x-v)));
  return dz>margin&&dx>margin;
}
insideBuilding(x,z,pad=1){
  return this.buildings.some(b=>b.w&&Math.abs(x-b.x)<b.w/2+pad&&Math.abs(z-b.z)<b.d/2+pad);
}
createGrass(){
  // Instanced grass tufts: three crossed blades per tuft, 2-3 green tones,
  // dense on verges, open ground and the lighthouse hill — never on roads,
  // never inside buildings, never across the victory sightline corridor.
  const tuft=grassTuftGeometry();
  const mat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95,side:THREE.DoubleSide});
  const inst=new THREE.InstancedMesh(tuft,mat,GRASS_TUFTS);
  const tones=[new THREE.Color('#4d6b45'),new THREE.Color('#5d7a4a'),new THREE.Color('#3f5c40')];
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),s=new THREE.Vector3(),p=new THREE.Vector3();
  let placed=0,guard=0;
  while(placed<GRASS_TUFTS&&guard++<GRASS_TUFTS*30){
    const x=-130+this.rand()*275,z=-115+this.rand()*260;
    if(z>58||!this.roadClear(x,z)||this.insideBuilding(x,z))continue;
    if(Math.abs(x-100)<4&&z>-54&&z<-28)continue; // victory sightline corridor
    const sc=.7+this.rand()*.9;
    e.set((this.rand()-.5)*.22,this.rand()*Math.PI,(this.rand()-.5)*.22);q.setFromEuler(e);
    s.set(sc,sc*(0.8+this.rand()*.5),sc);
    p.set(x,this.height(x,z),z);
    m4.compose(p,q,s);inst.setMatrixAt(placed,m4);
    inst.setColorAt(placed,tones[Math.floor(this.rand()*tones.length)]);
    placed++;
  }
  inst.count=placed;this.grassCount=placed;
  inst.receiveShadow=true;inst.instanceMatrix.needsUpdate=true;
  if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  this.scene.add(inst);this.grassMesh=inst;
  // Scattered rocks and pebbles, same placement rules, instanced.
  const rockGeo=new THREE.DodecahedronGeometry(.5,0);
  const rockMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95});
  const rocks=new THREE.InstancedMesh(rockGeo,rockMat,ROCK_COUNT);
  const rockTones=[new THREE.Color('#8a8578'),new THREE.Color('#6f6a62'),new THREE.Color('#9a8f7a')];
  let rplaced=0;guard=0;
  while(rplaced<ROCK_COUNT&&guard++<ROCK_COUNT*30){
    const x=-130+this.rand()*275,z=-115+this.rand()*260;
    if(z>58||!this.roadClear(x,z)||this.insideBuilding(x,z))continue;
    if(Math.abs(x-100)<4&&z>-54&&z<-28)continue;
    const sc=.25+this.rand()*.9;
    e.set(this.rand()*Math.PI,this.rand()*Math.PI,0);q.setFromEuler(e);
    s.set(sc,sc*.7,sc);p.set(x,this.height(x,z)+.08,z);
    m4.compose(p,q,s);rocks.setMatrixAt(rplaced,m4);
    rocks.setColorAt(rplaced,rockTones[Math.floor(this.rand()*rockTones.length)]);
    rplaced++;
  }
  rocks.count=rplaced;this.rockCount=rplaced;
  rocks.receiveShadow=true;rocks.instanceMatrix.needsUpdate=true;
  if(rocks.instanceColor)rocks.instanceColor.needsUpdate=true;
  this.scene.add(rocks);this.rockMesh=rocks;
}
dressLighthouseHill(){
  // Grass tufts + shrubs on the lighthouse hill flanks, in the foreground of
  // the victory shot. Kept out of the 8-wide sightline corridor (x 96..104)
  // so Raka stays clear, and at least 4 units ahead of the victory camera so
  // no blade looms over the lens. The buried z=-38 road climbs the hill, so
  // road clearance is checked against the x=115 road corridor only.
  const HILL_GRASS=220;
  const tuft=grassTuftGeometry();
  const grassMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95,side:THREE.DoubleSide});
  const inst=new THREE.InstancedMesh(tuft,grassMat,HILL_GRASS);
  const tones=[new THREE.Color('#4d6b45'),new THREE.Color('#5d7a4a'),new THREE.Color('#3f5c40')];
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),s=new THREE.Vector3(),p=new THREE.Vector3();
  this.hillGrassPositions=[];
  let placed=0,guard=0;
  while(placed<HILL_GRASS&&guard++<HILL_GRASS*40){
    const left=this.rand()>.5;
    const x=left?86+this.rand()*9:105+this.rand()*4;
    const z=-52+this.rand()*12;
    if(x>109.5)continue;
    const sc=.8+this.rand()*1.0;
    e.set((this.rand()-.5)*.22,this.rand()*Math.PI,(this.rand()-.5)*.22);q.setFromEuler(e);
    s.set(sc,sc*(0.9+this.rand()*.6),sc);
    p.set(x,this.height(x,z),z);
    m4.compose(p,q,s);inst.setMatrixAt(placed,m4);
    inst.setColorAt(placed,tones[Math.floor(this.rand()*tones.length)]);
    this.hillGrassPositions.push([x,p.y,z]);
    placed++;
  }
  inst.count=placed;this.hillGrassCount=placed;
  inst.receiveShadow=true;inst.instanceMatrix.needsUpdate=true;
  if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  this.scene.add(inst);this.hillGrassMesh=inst;
  // Shrubs on the hill flanks, same corridor rules.
  const shrubMat=mat('#3d5c39',.95);
  for(let i=0;i<8;i++){
    const left=this.rand()>.5;
    const sx=left?87+this.rand()*7:106+this.rand()*3;
    const sz=-50+this.rand()*8;
    const shrub=mesh(new THREE.SphereGeometry(.7+this.rand()*.5,10,8),shrubMat,sx,this.height(sx,sz)+.4,sz,this.scene);
    shrub.scale.y=.62;
  }
}
createTerrainDetails(){
  // Glossy puddle patches on the roads: dark, almost mirror-smooth.
  const puddleMat=new THREE.MeshStandardMaterial({color:'#2a2a4e',roughness:.06,metalness:.7,envMapIntensity:1.8,transparent:true,opacity:.85});
  this.puddles=[];
  for(const [px,pz,pr] of [[35,20,1.8],[-5,-60,1.4],[75,10,2.1],[-45,30,1.5],[115,-20,1.7],[35,-100,1.9],[-80,40,1.5]]){
    const puddle=mesh(new THREE.CircleGeometry(pr,24),puddleMat,px,1.16,pz,this.scene);
    puddle.rotation.x=-Math.PI/2;puddle.castShadow=false;puddle.scale.x=1.5;
    this.puddles.push(puddle);
  }
  // Manhole covers and drains along the roads.
  const iron=mat('#2b2b2e',.6,.5);
  this.manholes=[];
  for(const [mx,mz] of [[35,-58],[-5,-18],[75,24],[-45,-62],[115,8],[35,48],[-80,-8],[75,-88]]){
    const cover=mesh(new THREE.CylinderGeometry(.55,.55,.05,20),iron,mx,1.13,mz,this.scene);
    cover.castShadow=false;this.manholes.push(cover);
  }
  for(const [dx,dz] of [[30,-30],[40,-70],[-10,20],[80,60],[-50,90],[110,-40]]){
    const drain=cube(this.scene,iron,dx,1.14,dz,1.2,.05,.5);
    drain.castShadow=false;
    for(let i=0;i<4;i++)cube(this.scene,mat('#151517'),dx-.45+i*.3,1.17,dz,.06,.02,.4).castShadow=false;
  }
  // Painted curb segments: worn yellow blocks on the main avenue curbs.
  for(let i=0;i<10;i++){
    const cz=-100+i*22;
    cube(this.scene,mat('#c9a13d'),35+5.3,1.2,cz,.5,.22,3).castShadow=false;
    cube(this.scene,mat('#c9a13d'),35-5.3,1.2,cz+11,.5,.22,3).castShadow=false;
  }
  // Dirt paths: ribbons following the terrain height, never crossing roads.
  this.dirtPaths=[];
  for(const pts of [[[82,-112],[95,-100],[108,-84]],[[-38,-112],[-25,-100],[-12,-86]],[[58,-8],[70,2],[82,10]]]){
    this.dirtPaths.push(this.dirtPath(pts,2.2));
  }
  // Shrubs and flower tufts near the market.
  const shrubMat=mat('#3d5c39',.95);
  for(let i=0;i<24;i++){
    const sx=12+this.rand()*40,sz=44+this.rand()*10;
    if(Math.abs(sx-35)<7)continue;
    const shrub=mesh(new THREE.SphereGeometry(.7+this.rand()*.5,10,8),shrubMat,sx,this.height(sx,sz)+.4,sz,this.scene);
    shrub.scale.y=.62;
  }
  const flowerColors=['#ff7eb0','#ffd23d','#f2f0e4','#c97dff'];
  for(let i=0;i<40;i++){
    const fx=12+this.rand()*40,fz=44+this.rand()*10;
    if(Math.abs(fx-35)<7)continue;
    const f=mesh(new THREE.ConeGeometry(.09,.34,6),mat(flowerColors[i%4],.8),fx,this.height(fx,fz)+.2,fz,this.scene);
    f.castShadow=false;
  }
}
dirtPath(points,width){
  const pts=points.map(([x,z])=>new THREE.Vector3(x,0,z));
  const positions=[],uvs=[],indices=[];
  let vi=0;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];
    const dir=b.clone().sub(a);const len=dir.length();
    const steps=Math.max(2,Math.round(len));
    const perp=new THREE.Vector3(-dir.z,0,dir.x).normalize().multiplyScalar(width/2);
    for(let s=0;s<=steps;s++){
      const t=s/steps;
      const cx=a.x+dir.x*t,cz=a.z+dir.z*t;
      const y=this.height(cx,cz)+.06;
      positions.push(cx-perp.x,y,cz-perp.z, cx+perp.x,y,cz+perp.z);
      uvs.push(0,t*len, 1,t*len);
      if(s<steps){const o=vi+s*2;indices.push(o,o+1,o+2, o+1,o+3,o+2)}
    }
    vi+= (steps+1)*2;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);g.computeVertexNormals();
  const m=new THREE.Mesh(g,textured('sand','#b59a6e',55));
  m.receiveShadow=true;this.scene.add(m);
  return m;
}
createTraffic(){const colors=['#e84a7f','#e8d27a','#37b8c9','#ff8a3d','#7a4a8a','#d5c5a0'];const types=['coupe','convertible','coupe','sedan'];for(let i=0;i<15;i++){let horizontal=i%2===0;let lane=Math.floor(i/2)%4,coord=[-78,-38,2,42][lane],pos=-90+i*12;let x=horizontal?pos:[-45,-5,35,75][lane],z=horizontal?coord:pos;const car=createCar(this.scene,x,.0,types[i%types.length],colors[i%colors.length]);car.position.y=this.height(x,z)+.2;car.rotation.y=horizontal?0:Math.PI/2;car.userData.traffic={horizontal,coord,dir:i%3===0?-1:1,speed:3.8+(i%5)*.35,phase:i*.25};this.cars.push(car)}for(let i=0;i<24;i++){let side=i%2?1:-1;let x=35+side*(6.6+this.rand()*2);let z=-90+this.rand()*175;const person=createPerson(this.scene,['#9b533d','#456e6d','#b08c49','#64788b','#a07a60'][i%5],['#b98263','#95674f','#d2a17a'][i%3]);person.position.set(x,this.height(x,z),z);person.userData.walk={x,z,phase:this.rand()*7,direction:i%2?1:-1};this.people.push(person)}this.boatTruck=createCar(this.scene,22,68,'truck','#a37a4d');this.boatTruck.position.y=this.height(22,68)+.2;this.boatTruck.userData.parked=true;this.cars.push(this.boatTruck);this.chaseTruck=createCar(this.scene,98,47,'truck','#a37a4d');this.chaseTruck.position.y=this.height(98,47)+.2;this.chaseTruck.userData.parked=true;this.cars.push(this.chaseTruck);const alleyCar=createCar(this.scene,-42,-50,'coupe','#8b5545');alleyCar.position.y=this.height(-42,-50)+.2;alleyCar.userData.parked=true;this.cars.push(alleyCar);this.crates=[];for(const [x,z] of [[29,-5],[39,3],[31,8]]){const crate=new THREE.Group();crate.position.set(x,this.height(x,z),z);this.scene.add(crate);cube(crate,mat('#9d7953'),0,.5,0,1,.9,1);cube(crate,mat('#c4a574'),0,.98,0,1.05,.08,1.05);crate.userData.collected=false;this.crates.push(crate)}this.rivals=[];for(let i=0;i<3;i++){const rival=createPerson(this.scene,['#742f32','#463b49','#6a3d2c'][i],'#966649');rival.position.set(-52+i*3,this.height(-52+i*3,-38),-38);rival.userData.health=3;this.rivals.push(rival)}for(let i=0;i<6;i++){const car=createCar(this.scene,-45+(i%3)*40,55+Math.floor(i/3)*7,['coupe','convertible','sedan','pickup','coupe','truck'][i%6],colors[(i+2)%colors.length]);this.cars.push(car)}}
addPolice(x,z,force=false){const existing=this.police.find(p=>p.userData.alive);if(existing&&!force)return existing;const car=createCar(this.scene,x,z,'coupe','#dedbd0',true);car.userData.alive=true;car.userData.police=true;car.userData.sirenPhase=this.police.length*Math.PI;for(const part of car.children)if(part.geometry?.type==='SphereGeometry'&&part.position.y>1.5)part.userData.siren=true;car.position.y=this.height(x,z)+.2;this.police.push(car);return car}
addDriver(car,side=1){
  // Seated in the cabin: mid-cabin, low enough that the head stays under the
  // raked glasshouse roofline, on the camera side of the car.
  const d=createDriver(car);
  if(car.userData.type==='truck')d.position.set(2.5,.85,side*.45);
  else{d.position.set(-.30,.30,side*.45);d.scale.setScalar(.85)}
  car.userData.driver=d;return d;
}
update(dt,time,player){for(const c of this.clouds){c.position.x+=dt*.7;if(c.position.x>180)c.position.x=-180}for(const b of this.boats){b.position.y=b.userData.baseY+Math.sin(time*1.2+b.position.x)*.14;b.rotation.z=Math.sin(time*.7+b.position.z)*.018}const p=this.waterMesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setZ(i,Math.sin(x*.11+time*1.5)*.18+Math.sin(z*.18-time)*.1)}this.waterMesh.geometry.attributes.position.needsUpdate=true;this.waterMesh.geometry.computeVertexNormals();for(const car of this.cars){if(car===player.vehicle||car.userData.police)continue;const tr=car.userData.traffic;if(tr){let v=tr.speed*tr.dir*dt;if(tr.horizontal){car.position.x+=v;if(car.position.x>120)car.position.x=-120;if(car.position.x< -120)car.position.x=120}else{car.position.z+=v;if(car.position.z>112)car.position.z=-112;if(car.position.z< -112)car.position.z=112}car.position.y=this.height(car.position.x,car.position.z)+.2;let near= Math.abs(player.position.x-car.position.x)<8&&Math.abs(player.position.z-car.position.z)<8;if(near&&tr.phase<.3)tr.speed=0;else tr.speed=Math.min(5,tr.speed+dt*2)}else if(car.userData.parked===undefined)car.userData.parked=true}for(const person of this.people){const w=person.userData.walk;w.phase+=dt*5;let x=w.x+Math.sin(w.phase*.15)*2,z=w.z+Math.sin(w.phase*.09)*9*w.direction;person.position.set(x,this.height(x,z),z);for(const part of person.children)if(part.userData.legSide)part.rotation.x=Math.sin(w.phase+(part.userData.legSide>0?Math.PI:0))*.38;for(const part of person.children)if(part.userData.armSide)part.rotation.x=-Math.sin(w.phase+(part.userData.armSide>0?Math.PI:0))*.22}for(const cop of this.police){if(!cop.userData.alive)continue;const dx=player.position.x-cop.position.x,dz=player.position.z-cop.position.z,d=Math.hypot(dx,dz);cop.rotation.y=Math.atan2(dx,dz);cop.position.x+=dx/d*Math.min(d,dt*(4+player.wanted));cop.position.z+=dz/d*Math.min(d,dt*(4+player.wanted));cop.position.y=this.height(cop.position.x,cop.position.z)+.2;if(d<2.1){player.health-=dt*(4+player.wanted*2);player.shake=.2}for(const part of cop.children)if(part.userData.siren)part.material.color.set(Math.sin(cop.userData.sirenPhase+time*14+(part.position.z<0?0:Math.PI))>0?'#ff4848':'#3d79ff')}}
}
