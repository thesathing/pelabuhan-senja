import * as THREE from './vendor/three.module.min.js';
export { THREE };
export function seeded(seed) { let n = seed >>> 0; return () => ((n = Math.imul(n ^ n >>> 15, 1 | n) + 0x6d2b79f5 | 0) >>> 0) / 4294967296; }
export const roads = [-90,-30,30,90];
export const hideout = {x:-46,z:78};
export const lighthouse = {x:90,z:-171};
export function groundHeight(x,z) { return z < -104 && x > 68 && x < 112 ? Math.min(19,(-z-104)*.29) : 0; }
export function makeWorld(seed) {
  const rand = seeded(seed), scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xd8a587,.0034);
  const camera = new THREE.PerspectiveCamera(57, innerWidth/innerHeight,.15,900);
  const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.querySelector('#view').appendChild(renderer.domElement);
  const materials = new Map(), cube = new THREE.BoxGeometry(1,1,1);
  function mat(color,glow=false) {
    const key = color+':'+glow;
    if (!materials.has(key)) materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.86,emissive:glow?color:0,emissiveIntensity:glow?1.3:0}));
    return materials.get(key);
  }
  const batches = new Map(), colliders = [], buildings = [], boats = [], lamps = [];
  function box(x,y,z,w,h,d,color,parent=scene,staticMesh=false) {
    if (staticMesh) { const key = String(color); if (!batches.has(key)) batches.set(key,[]); batches.get(key).push([x,y,z,w,h,d]); return; }
    const o = new THREE.Mesh(cube,mat(color)); o.position.set(x,y,z); o.scale.set(w,h,d); o.castShadow=true; o.receiveShadow=true; parent.add(o); return o;
  }
  function cylinder(x,y,z,rt,rb,h,color,parent=scene,sides=8) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,sides),mat(color)); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; parent.add(o); return o;
  }
  function sign(text,x,y,z,w=12,color='#f6c77f',bg='#173b40',parent=scene) {
    const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
    g.fillStyle=bg;g.fillRect(0,0,512,128);g.strokeStyle=color;g.lineWidth=4;g.strokeRect(8,8,496,112);
    g.font='bold 45px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;g.fillText(text,256,65,470);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const o=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));o.position.set(x,y,z);parent.add(o);return o;
  }
  const skyGeo=new THREE.SphereGeometry(700,32,16);
  const sky=new THREE.Mesh(skyGeo,new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 v; void main(){float h=normalize(v).y;vec3 c=mix(vec3(1.0,.58,.32),vec3(.21,.35,.49),smoothstep(-.06,.65,h));gl_FragColor=vec4(c,1.0);}'}));scene.add(sky);
  const sun=new THREE.Mesh(new THREE.SphereGeometry(20,32,24),new THREE.MeshBasicMaterial({color:0xffdc94}));sun.position.set(270,80,-370);scene.add(sun);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;const gg=glowCanvas.getContext('2d');const grad=gg.createRadialGradient(64,64,4,64,64,64);grad.addColorStop(0,'rgba(255,207,128,.55)');grad.addColorStop(.3,'rgba(255,180,98,.2)');grad.addColorStop(1,'rgba(255,180,98,0)');gg.fillStyle=grad;gg.fillRect(0,0,128,128);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false}));halo.position.copy(sun.position);halo.scale.set(150,150,1);scene.add(halo);
  scene.add(new THREE.HemisphereLight(0xb9dcf0,0xa16b45,2.1));
  const sunlight=new THREE.DirectionalLight(0xffd09a,3.4);sunlight.position.set(110,160,-130);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);Object.assign(sunlight.shadow.camera,{left:-160,right:160,top:160,bottom:-160,near:1,far:450});sunlight.shadow.bias=-.001;scene.add(sunlight);
  box(-10,-1,0,244,2,248,0x9b9c80,scene,true);
  box(126,-2.4,-25,24,3,300,0xc8b28f,scene,true);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200,1,1),new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 p;uniform float time;void main(){float a=sin(p.x*.48+p.y*.18+time)*sin(p.y*.76-time*.7);float b=pow(max(0.,sin(p.y*.39+p.x*.16+time*.4)),24.);vec3 c=mix(vec3(.025,.22,.25),vec3(.12,.42,.42),a*.25+.45);c+=vec3(.50,.29,.12)*b*.6;gl_FragColor=vec4(c,1.);}'}));water.rotation.x=-Math.PI/2;water.position.set(200,-1.8,0);scene.add(water);
  for (const v of roads) {
    box(v,.02,0,15,.12,240,0x39474b,scene,true);box(0,.03,v,240,.12,15,0x39474b,scene,true);
    for(let i=-114;i<118;i+=10) if(!roads.some(r=>Math.abs(r-i)<11)) {
      box(v,.11,i,.23,.03,4,0xe5ca8b,scene,true);box(i,.12,v,4,.03,.23,0xe5ca8b,scene,true);
    }
    for(const r of roads) for(let k=-5;k<=5;k+=2) {box(v+k,.14,r+8,1,.025,3,0xc6c4ad,scene,true);}
  }
  box(90,.04,-112,16,.12,25,0x39474b,scene,true);
  const ramp=box(90,9.5,-138,16,.4,70,0x4a5351);ramp.rotation.x=.282;
  box(90,18.9,-177,43,.6,24,0xb6ad8a,scene,true);
  for(let z=-112;z>-169;z-=9) box(90,groundHeight(90,z)+.25,z,.25,.08,3.8,0xf2cf88,scene,true);
  for(let j=0;j<3;j++) {const hill=new THREE.Mesh(new THREE.ConeGeometry(36-j*4,35-j*5,7),mat(j===0?0x737c61:0x879475));hill.position.set(92+j*12,-1,-160-j*8);scene.add(hill);}
  const palette=[0xd39b7d,0xd0b591,0x7caaa3,0xe0c292,0xb78e7e,0x8cafa9,0xdaa982];
  const shopNames=['SENJA COFFEE','RADIO BAY','SILVER TIDE','CITRUS & SALT','TANJUNG TEA','BLUE HOUR','PORT HOTEL','REPAIR 24'];
  function building(x,z,w,d,h,index) {
    const color=palette[index%palette.length];const b={x,z,w,d,h};buildings.push(b);colliders.push(b);
    box(x,.25,z,w+3,.5,d+3,0xc1b399,scene,true);box(x,h/2+.5,z,w,h,d,color,scene,true);
    box(x,h+.65,z,w+1,.8,d+1,0x864e41,scene,true);box(x,h+1.25,z,w-1,.5,d-1,0xc0845b,scene,true);
    for(let y=3.7;y<h;y+=3.6) for(let xx=x-w/2+2;xx<x+w/2;xx+=3.8) {
      box(xx,y,z+d/2+.05,1.6,2,.15,0x26494e,scene,true);
      if(rand()>.38) box(xx,y,z+d/2+.15,1.15,1.55,.06,0xf2cd88,scene,true);
      box(xx,y-1.15,z+d/2+.25,2.1,.18,.6,0xe3c9a5,scene,true);
      box(xx,y,z-d/2-.05,1.6,2,.15,0x365258,scene,true);
    }
    for(let zz=z-d/2+2;zz<z+d/2;zz+=4) for(let y=3.7;y<h;y+=3.6) box(x+w/2+.05,y,zz,.15,1.8,1.5,0x32575a,scene,true);
    box(x,1.6,z+d/2+.12,2.5,2.9,.2,0x29494a,scene,true);
    if(index%2===0) {box(x,3.4,z+d/2+1,w,.2,2.7,index%4?0xb96354:0x408c83,scene,true);sign(shopNames[index%8],x,4.3,z+d/2+.25,Math.min(w-1,11));}
    if(index%3===0) box(x+2,h+1.7,z,3,1.4,3,0x728080,scene,true);
  }
  let bi=0;
  for(const x of [-60,0,60]) for(const z of [-60,0,60]) for(const dx of [-11,11]) for(const dz of [-10,10]) building(x+dx,z+dz,17,16,7+Math.floor(rand()*4)*3.5,bi++);
  for(const z of [-64,-13,40,94]) building(-113,z,12,24,10+rand()*7,bi++);
  function palm(x,z,scale=1) {
    const g=new THREE.Group();g.position.set(x,groundHeight(x,z),z);g.scale.setScalar(scale);scene.add(g);
    const trunk=cylinder(0,4.5,0,.22,.44,9,0x8b6f49,g,6);trunk.rotation.z=.07;
    for(let a=0;a<7;a++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(1.5,6,4),mat(a%2?0x466f50:0x688c56));leaf.position.set(Math.sin(a*.9)*2,8.7,Math.cos(a*.9)*2);leaf.rotation.set(Math.cos(a*.9)*1.2,0,-Math.sin(a*.9)*1.2);g.add(leaf);}
  }
  for(let z=-105;z<115;z+=22) {palm(109,z,1.15);palm(-102,z,.8);}
  for(let x=-100;x<100;x+=23) palm(x,105,.9);
  for(let i=0;i<12;i++) palm(72+rand()*35,-145-rand()*35,.6+rand()*.5);
  for(const x of [-40,-20,80,100]) for(let z=-100;z<110;z+=30){
    cylinder(x,4,z,.12,.16,8,0x38474a);box(x+1,8,z,2.3,.18,.2,0x38474a,scene,true);
    const bulb=box(x+1.8,7.8,z,.7,.18,.7,0xffcb72);bulb.material=mat(0xffce82,true);lamps.push(bulb);
    const pool=new THREE.Mesh(new THREE.CircleGeometry(3,16),new THREE.MeshBasicMaterial({color:0xffd089,transparent:true,opacity:.12,depthWrite:false}));pool.rotation.x=-Math.PI/2;pool.position.set(x+1.8,.17,z);scene.add(pool);
  }
  // Stalls flank the north-south market avenue without blocking its driving lanes.
  for(let i=0;i<10;i++) for(const side of [-1,1]) {
    const x=-30+side*11.4,z=-19+i*9;
    box(x,.7,z,4,1.4,3,0x8b694c,scene,true);
    for(const dx of [-1.8,1.8]) cylinder(x+dx,1.8,z,.06,.06,3.6,0x694b39);
    const awning=box(x,3.5,z,5,.3,4.5,i%2?0xcd7156:0x3f948c);awning.rotation.z=side*.08;
    for(let k=0;k<4;k++) {const fruit=new THREE.Mesh(new THREE.IcosahedronGeometry(.3,0),mat(k%2?0xe9b956:0xc97949));fruit.position.set(x-1.3+k*.8,1.7,z);scene.add(fruit);}
  }
  for(const z of [-16,12,42,69]){
    for(const x of [-42,-18]) cylinder(x,6.3,z,.1,.13,12.6,0x665347);
    const cable=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-42,12,z),new THREE.Vector3(-30,10,z),new THREE.Vector3(-18,12,z)]),new THREE.LineBasicMaterial({color:0x554d44}));scene.add(cable);
    for(let i=0;i<9;i++){const x=-41+i*2.8;const b=new THREE.Mesh(new THREE.SphereGeometry(.3,7,6),mat(i%2?0xffb96a:0xf3dba5,true));b.position.set(x,10+Math.abs(x+30)/6,z);scene.add(b);}
  }
  sign('PASAR SENJA',-30,10.2,71,19,'#ffdc9a','#24635e');
  sign('LORONG SENJA',-51,4,79,10,'#9ee7cd','#243c3b');
  box(-46,.15,78,7,.15,6,0x5a9c88,scene,true);
  // Harbor: seawall, piers, cargo cranes and fishing boats.
  for(const z of [-75,-15,45]) {
    box(145,-.25,z,55,1,16,0x8b938b,scene,true);
    for(let x=120;x<170;x+=10) cylinder(x,-2,z+6,.4,.4,4,0x655c4d);
    for(let x=123;x<162;x+=16) box(x,2,z-3,11,4,5, x%3?0xa65f49:0x4d8f8b,scene,true);
    const crane=new THREE.Group();crane.position.set(125,0,z+9);scene.add(crane);
    for(const dx of [-3,3]) for(const dz of [-2,2]) box(dx,12,dz,.65,24,.65,0xc39c50,crane);
    box(4,24,0,28,1,2,0xd9aa50,crane);box(-2,22,0,5,4,4,0x5a7774,crane);
    box(15,17,0,.12,14,.12,0x4a5250,crane);box(15,9.5,0,3,.3,3,0x3d5151,crane);
    for(let k=0;k<5;k++){const brace=box(0,3+k*4,0,6,.3,.3,0xa78243,crane);brace.rotation.z=k%2?.65:-.65;}
    const boat=new THREE.Group();boat.position.set(157,-.6,z+17);boat.rotation.y=.18;scene.add(boat);boats.push(boat);
    const hull=box(0,0,0,5,1.6,14,0x3b777d,boat);box(0,1,1,4.2,.5,10,0xdfb98a,boat);box(0,2.7,2,3,3,4,0xe6d3b0,boat);box(0,3,4.1,2.5,1,.1,0x30626d,boat);cylinder(0,6,0,.1,.12,10,0x6e6556,boat);
    for(const dx of [-3.8,3.8]){box(dx,.5,0,.25,.25,14,0xb49663,boat);box(dx/2,.6,3,4,.2,.2,0xb49663,boat);}
  }
  sign('SENJA • PORT 04',117,7,71,20);
  // Lighthouse balcony is accessible by the ramp.
  cylinder(90,20,-177,12,13,2,0xc8b89a);
  cylinder(90,33,-177,3.5,5,25,0xe6d9b4,scene,16);
  cylinder(90,36,-177,3.8,4,3,0xb2654f,scene,16);
  cylinder(90,46,-177,5.4,5.4,1.2,0x374f50,scene,16);
  cylinder(90,48.3,-177,3.1,3.1,3.4,0xffdc87,scene,12).material=mat(0xffd478,true);
  cylinder(90,51,-177,0,5.3,3,0x536f6c,scene,12);
  sign('TANJUNG API',90,23,-170.8,13);
  const beam=new THREE.Mesh(new THREE.ConeGeometry(17,95,24,1,true),new THREE.MeshBasicMaterial({color:0xffe6ad,transparent:true,opacity:.055,depthWrite:false,side:THREE.DoubleSide}));beam.rotation.z=Math.PI/2;beam.position.set(138,48,-177);scene.add(beam);
  for(const [key,arr] of batches){const mesh=new THREE.InstancedMesh(cube,mat(Number(key)),arr.length);const dummy=new THREE.Object3D();arr.forEach((v,i)=>{dummy.position.set(v[0],v[1],v[2]);dummy.scale.set(v[3],v[4],v[5]);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
  mergeStaticMeshes(scene, new Set(boats));
  function blocked(x,z,r=.6) {if(x < -120+r || x>113-r || z>118-r || z<-190+r) return true;if(z<-114 && (x<72+r||x>108-r)) return true;return colliders.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
  function visible(a,b) {const d=Math.hypot(b.x-a.x,b.z-a.z);for(let t=2;t<d;t+=2){const f=t/d;if(blocked(a.x+(b.x-a.x)*f,a.z+(b.z-a.z)*f,.05))return false;}return true;}
  return {scene,camera,renderer,box,cylinder,mat,sign,rand,colliders,buildings,boats,water,blocked,visible,beam};
}

function mergeStaticMeshes(root,skip=new Set()) {
 root.updateMatrixWorld(true);const groups=new Map();
 const visit=o=>{if(skip.has(o))return;if(o.isMesh&&!o.isInstancedMesh&&o.material.isMeshStandardMaterial&&!o.material.map){const key=o.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}else for(const child of o.children)visit(child);};
 for(const child of root.children)visit(child);
 const inverse=root.matrixWorld.clone().invert();
 for(const list of groups.values()){if(list.length<2)continue;const positions=[],normals=[];for(const o of list){const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(inverse.clone().multiply(o.matrixWorld));positions.push(...geometry.attributes.position.array);normals.push(...geometry.attributes.normal.array);geometry.dispose();o.removeFromParent();}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));const mesh=new THREE.Mesh(geometry,list[0].material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
}

export function makeCar(world,color=0xc9704f,kind='sedan') {
  const {box,cylinder,mat}=world,g=new THREE.Group();const truck=kind==='truck',police=kind==='police';
  box(0,.8,0,2.15,.8,truck?5.3:4.5,police?0xe3dbbc:color,g);
  box(0,.48,0,2.2,.24,4.6,0x283f44,g);
  box(0,1.45,-.1,1.82,.85,2.25,police?0x223b43:color,g);
  box(0,1.55,1.04,1.65,.55,.06,0x284c57,g);
  box(0,1.55,-1.25,1.65,.55,.06,0x284c57,g);
  for(const x of [-.94,.94]) {box(x,1.55,-.12,.055,.55,1.9,0x305561,g);box(x,1.55,0,.07,.6,.09,0xc5b99a,g);box(x*1.22,1.2,.77,.35,.22,.4,color,g);}
  const wheels=[];
  for(const x of [-1.08,1.08]) for(const z of [-1.43,1.43]){const w=cylinder(x,.49,z,.48,.48,.3,0x243239,g,12);w.rotation.z=Math.PI/2;wheels.push(w);const hub=cylinder(x*1.15,.49,z,.23,.23,.04,0x9daca8,g,10);hub.rotation.z=Math.PI/2;}
  for(const x of [-.75,.75]) {box(x,.92,2.27,.55,.28,.06,0xf8dfa2,g).material=mat(0xffe1a1,true);}
  const brakes=[];for(const x of [-.78,.78]){const b=box(x,.92,-2.27,.46,.22,.06,0xae3a31,g);brakes.push(b);}
  if(police){box(0,1.99,0,1.5,.15,.4,0x35464b,g);box(-.5,2.1,0,.5,.2,.4,0x368be7,g).material=mat(0x3e91ff,true);box(.5,2.1,0,.5,.2,.4,0xff524b,g).material=mat(0xff524b,true);world.sign('POLICE',0,1,2.32,1.5,'#f4e7c8','#254750',g);}
  if(truck){box(0,1.55,-1.3,2.25,1.6,2.7,0x829587,g);for(let z=-2.5;z<0;z+=.45)box(0,2.38,z,2.4,.1,.12,0xc9bb93,g);}
  const lights=new THREE.Object3D();g.add(lights);
  mergeStaticMeshes(g,new Set([...wheels,...brakes]));
  world.scene.add(g);
  return {mesh:g,x:0,z:0,angle:Math.PI,speed:0,health:100,kind,wheels,brakes,lights,ai:false,stolen:false,occupied:true,stop:0,routeIndex:0};
}
export function makePerson(world,color=0x4b9b98,type='civilian') {
  const g=new THREE.Group(),{box}=world;box(0,1.25,0,.68,.85,.4,color,g);box(0,1.98,0,.42,.45,.4,0xc39870,g);box(0,2.23,-.03,.46,.13,.42,type==='police'?0x273e50:0x343d3e,g);
  const legs=[box(-.19,.46,0,.25,.85,.3,0x344b51,g),box(.19,.46,0,.25,.85,.3,0x344b51,g)];
  const arms=[box(-.46,1.25,0,.22,.75,.27,color,g),box(.46,1.25,0,.22,.75,.27,color,g)];
  if(type==='player'){box(0,1.3,-.3,.6,.7,.3,0xb87d4b,g);box(0,1.5,-.48,.42,.12,.05,0xf2d69b,g);}
  if(type==='police'||type==='rival') box(.49,1,.3,.16,.17,.6,0x26363b,g);
  world.scene.add(g);return {mesh:g,x:0,z:0,angle:0,legs,arms,health:type==='rival'?70:100,type,flee:0,cooldown:0,phase:world.rand()*6};
}
