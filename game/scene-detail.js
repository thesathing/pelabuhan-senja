import * as THREE from './vendor/three.module.min.js';

// Neon-dusk sun direction: low in the sky, nearly straight ahead (-Z) so it
// sits in frame for the title, drive, chase and victory cameras.
export const SUN_DIR = new THREE.Vector3(0.10, 0.09, -0.99).normalize();

export function facadeTexture(kind,seed) {
  const palette={brick:[155,115,96],plaster:[193,180,157],cream:[205,194,172],concrete:[155,154,146],blue:[148,151,149]};
  const base=palette[kind]||palette.concrete;
  const S=1024;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=S;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(S,S);
  // Precomputed weather tables keep the 1024px loop fast.
  const sinX=new Float32Array(S),cosY=new Float32Array(S);
  for(let x=0;x<S;x++)sinX[x]=Math.sin(x*.013);
  for(let y=0;y<S;y++)cosY[y]=Math.cos(y*.0095);
  let state=(seed%2147483646)+1;
  const brickRow=[],brickCol=[];
  for(let r=0;r<32;r++)brickRow.push(Math.sin(r*7+seed)*4);
  for(let c=0;c<32;c++)brickCol.push(Math.sin(c*13+seed)*4);
  for(let y=0;y<S;y++) {
    const row=Math.floor(y/32),weatherY=cosY[y]*3;
    for(let x=0;x<S;x++) {
      state=state*48271%2147483647;
      const grain=(state/2147483647-.5)*8;
      const weather=sinX[x]*weatherY;
      const column=Math.floor((x+(row%2)*40)/80);
      const mortar=kind==='brick'&&(y%32<2||(x+(row%2)*40)%80<2);
      const brickVariation=kind==='brick'?brickRow[row]+brickCol[column%32]:0;
      const i=(y*S+x)*4;
      const m=mortar?[148,137,121]:base;
      image.data[i]=m[0]+grain+weather+brickVariation;
      image.data[i+1]=m[1]+grain+weather+brickVariation;
      image.data[i+2]=m[2]+grain+weather+brickVariation;
      image.data[i+3]=255;
    }
  }
  ctx.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=16;
  texture.name=`facade-${kind}`;
  return texture;
}

// Neon shop sign: dark board, glowing neon border and text in the given hue.
// The same canvas drives both the map and the emissive map, so the sign
// glows after dark without any postprocessing pass.
export function signTexture(text, neon='#ff5fa2') {
  const c=document.createElement('canvas');c.width=2048;c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#160a1a';x.fillRect(0,0,2048,128);
  x.shadowColor=neon;x.shadowBlur=26;
  x.strokeStyle=neon;x.lineWidth=7;x.strokeRect(10,10,2028,108);
  x.fillStyle=neon;x.font='700 72px Georgia, serif';x.textAlign='center';x.textBaseline='middle';
  x.fillText(text,1024,68);
  x.shadowBlur=10;x.fillStyle='#ffffff';x.font='700 72px Georgia, serif';
  x.fillText(text,1024,68);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;
  return t;
}

// Soft radial glow used for the sun halo, lamp glows and neon pools.
// Fake bloom: additive sprites, no postprocessing, fully offline.
export function glowTexture() {
  const c=document.createElement('canvas');c.width=c.height=128;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(.25,'rgba(255,255,255,.55)');
  g.addColorStop(.6,'rgba(255,255,255,.14)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
let glowTex=null;
export function glowSprite(color, scale, opacity=.85) {
  if(!glowTex)glowTex=glowTexture();
  const m=new THREE.SpriteMaterial({map:glowTex,color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  const s=new THREE.Sprite(m);s.scale.set(scale,scale,1);
  return s;
}

// Environment reflections: bake the dusk sky alone into a PMREM map once,
// so paint and glass reflect the sky without paying for a full-scene capture.
export function applyEnvironment(renderer,scene) {
  const skyScene=new THREE.Scene();
  duskSky(skyScene);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const env=pmrem.fromScene(skyScene,.04);
  scene.environment=env.texture;
  pmrem.dispose();
}

export function duskSky(scene) {
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{
      horizon:{value:new THREE.Color('#ff5e8a')},
      violet:{value:new THREE.Color('#7a3fd4')},
      zenith:{value:new THREE.Color('#1b2a6b')},
      sunDir:{value:SUN_DIR.clone()},
    },
    vertexShader:'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform vec3 horizon; uniform vec3 violet; uniform vec3 zenith; uniform vec3 sunDir; varying vec3 direction;
      void main(){
        vec3 ray=normalize(direction);
        float h=smoothstep(-.035,.62,ray.y);
        vec3 color=mix(horizon,violet,smoothstep(.02,.30,ray.y));
        color=mix(color,zenith,smoothstep(.28,.62,ray.y));
        float sunDistance=distance(ray,normalize(sunDir));
        color+=vec3(1.0,.45,.20)*.55*exp(-sunDistance*sunDistance/.008);
        color+=vec3(1.0,.30,.55)*.30*exp(-sunDistance*sunDistance/.05);
        color=mix(color,vec3(1.0,.93,.66),1.0-smoothstep(.055,.08,sunDistance));
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(480,32,20),material);
  sky.name='dusk-sky';sky.renderOrder=-100;sky.frustumCulled=false;
  sky.onBeforeRender=(_renderer,_scene,camera)=>{sky.position.copy(camera.position);sky.updateMatrixWorld()};
  scene.add(sky);
}

export function detailGround(geometry) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const context=canvas.getContext('2d'),image=context.createImageData(512,512);
  let seed=8341;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    // Soft low-contrast grain over large blotches: the ground must read as
    // asphalt and sidewalk, never as TV static.
    const grain=(seed/4294967296-.5)*16;
    const variation=Math.sin(x*.035)*Math.cos(y*.045)*14+Math.sin((x+y)*.012)*16;
    const i=(y*512+x)*4;
    image.data[i]=128+grain+variation;image.data[i+1]=118+grain+variation;image.data[i+2]=138+grain+variation;image.data[i+3]=255;
  }
  context.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(24,22);texture.anisotropy=8;
  const colors=[],p=geometry.attributes.position,grass=new THREE.Color('#6a6a7a'),dirt=new THREE.Color('#7d6a72'),sand=new THREE.Color('#b59a6e');
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i);
    const distance=Math.min(...[-45,-5,35,75,115].map(v=>Math.abs(x-v)),...[-78,-38,2,42].map(v=>Math.abs(z-v)));
    const blend=1-THREE.MathUtils.smoothstep(distance,4,12);
    const c=grass.clone().lerp(dirt,blend).multiplyScalar(.94+.06*Math.sin(x*.24+z*.13));
    // Sand near the harbor waterfront: the ground warms toward the water.
    const sandBlend=THREE.MathUtils.smoothstep(z,56,68);
    c.lerp(sand,sandBlend*.85);
    colors.push(c.r,c.g,c.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  return new THREE.MeshStandardMaterial({map:texture,vertexColors:true,roughness:.98});
}
