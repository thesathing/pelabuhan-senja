import {THREE,makeWorld,groundHeight} from './world.js';
import {Simulation} from './simulation.js';
import {updateSimulation,syncWorld} from './traffic.js';
import {Interface} from './ui.js';
import {jobs} from './missions.js';
const params=new URLSearchParams(location.search),seed=Number(params.get('seed')||2601),world=makeWorld(seed),g=new Simulation(world),ui=new Interface(g);
const headlight=new THREE.SpotLight(0xffd998,0,38,.52,.65,1);world.scene.add(headlight,headlight.target);
const marker=new THREE.Mesh(new THREE.OctahedronGeometry(1.4),new THREE.MeshStandardMaterial({color:0xffd080,emissive:0xf0ac47,emissiveIntensity:.8,metalness:.3,roughness:.3}));world.scene.add(marker);
const ring=new THREE.Mesh(new THREE.RingGeometry(3,3.2,48),new THREE.MeshBasicMaterial({color:0xffd282,side:THREE.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;world.scene.add(ring);
const cameraTarget=new THREE.Vector3(),desired=new THREE.Vector3(),look=new THREE.Vector3();let cameraReady=false,last=performance.now(),manualUntil=0;
function screenshotSetup(name){g.shot=name;g.time=20;if(name==='start'){g.mode='title';g.player.x=-30;g.player.z=70;g.fixedCamera={position:[62,61,119],target:[18,5,-38]};}
 if(name==='drive'){g.mode='playing';g.book.begin(0);g.dialogue=null;g.car=g.courier;Object.assign(g.car,{x:-30,z:55,angle:Math.PI,speed:17});Object.assign(g.player,{x:-30,z:55,angle:Math.PI});g.fixedCamera={position:[-22,8,70],target:[-32,3,27]};}
 if(name==='chase'){g.mode='playing';g.book.begin(2);g.book.stage=1;g.car=g.truck;Object.assign(g.car,{x:90,z:36,angle:Math.PI,speed:23});Object.assign(g.player,{x:90,z:36,angle:Math.PI});g.wanted=3;g.ensurePolice();g.police.forEach((p,i)=>{p.x=86+(i%2)*8;p.z=48+Math.floor(i/2)*10;p.angle=Math.PI;});g.dialogue=null;g.target={x:-46,z:78};g.objective='Lose the patrols · bring the cargo home';g.fixedCamera={position:[62,44,76],target:[98,2,38]};}
 if(name==='victory'){g.book.index=4;g.completed=5;g.money=4450;g.mode='victory';g.player.x=87;g.player.z=-174;g.target=null;g.objective='The ledger is delivered. Lorong Senja is free.';g.fixedCamera={position:[127,39,-131],target:[81,31,-177]};g.showResult(jobs[4]);}
 ui.panels();}
const shot=params.get('shot');if(['start','drive','chase','victory'].includes(shot))screenshotSetup(shot);
function camera(dt){const p=g.player;if(g.fixedCamera){world.camera.position.set(...g.fixedCamera.position);world.camera.lookAt(...g.fixedCamera.target);return;}if(g.mode==='title'){world.camera.position.set(62,61,119);world.camera.lookAt(18,5,-38);return;}
 const y=groundHeight(p.x,p.z)+g.jump;const angle=(g.car?g.car.angle:Math.PI)+g.orbit;g.lookAngle=angle;const distance=g.car?11:6.8,height=g.car?4.8:3.3;desired.set(p.x-Math.sin(angle)*distance,y+height+g.pitch*3,p.z-Math.cos(angle)*distance);look.set(p.x+Math.sin(angle)*3,y+1.7,p.z+Math.cos(angle)*3);
 // Pull the camera forward if a building is behind the player.
 for(let t=1;t>0.16;t-=.1){const x=p.x+(desired.x-p.x)*t,z=p.z+(desired.z-p.z)*t;if(!world.blocked(x,z,.2)){desired.x=x;desired.z=z;break;}}
 if(!cameraReady){world.camera.position.copy(desired);cameraTarget.copy(look);cameraReady=true;}world.camera.position.lerp(desired,1-Math.exp(-dt*7));cameraTarget.lerp(look,1-Math.exp(-dt*12));if(g.shake>0)world.camera.position.x+=Math.sin(g.time*90)*g.shake*.15;world.camera.lookAt(cameraTarget);world.camera.fov=57+Math.min(9,Math.abs(g.car?.speed||0)*.25);world.camera.updateProjectionMatrix();}
function render(dt=1/60){headlight.intensity=g.car?18:0;if(g.car){const c=g.car,y=groundHeight(c.x,c.z);headlight.position.set(c.x+Math.sin(c.angle)*2,y+1.2,c.z+Math.cos(c.angle)*2);headlight.target.position.set(c.x+Math.sin(c.angle)*25,y,c.z+Math.cos(c.angle)*25);}syncWorld(g,dt);g.player.mesh.visible=!g.car;marker.visible=ring.visible=!!g.target;if(g.target){marker.position.set(g.target.x,groundHeight(g.target.x,g.target.z)+4+Math.sin(g.time*2)*.35,g.target.z);marker.rotation.y=g.time*.8;ring.position.set(g.target.x,groundHeight(g.target.x,g.target.z)+.2,g.target.z);}camera(dt);ui.update();world.renderer.render(world.scene,world.camera);}
function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;if(!g.shot&&!params.has('test')&&now>manualUntil)updateSimulation(g,dt);if(!g.shot&&!params.has('test'))render(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
function releaseShot(){if(g.shot){g.shot=null;g.fixedCamera=null;cameraReady=false;}}
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'){ui.pause();g.keys.clear();return;}if(g.mode!=='playing')return;releaseShot();g.keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE')g.interact();if(e.code==='KeyF')g.attack(true);if(e.code==='KeyR')g.reloadWeapon();});
addEventListener('keyup',e=>g.keys.delete(e.code));addEventListener('blur',()=>{g.keys.clear();if(g.mode==='playing'&&!g.shot)ui.pause();});
world.renderer.domElement.addEventListener('mousedown',e=>{if(g.mode!=='playing')return;g.audio.start();if(e.button===0){releaseShot();g.attack();}});addEventListener('contextmenu',e=>e.preventDefault());
let previousX=null,previousY=null;addEventListener('mousemove',e=>{if(g.mode!=='playing'){previousX=e.clientX;previousY=e.clientY;return;}if(previousX!==null){const dx=e.clientX-previousX,dy=e.clientY-previousY;if(Math.abs(dx)<150){g.orbit-=dx*.004;g.pitch=Math.max(-.4,Math.min(1.3,g.pitch+dy*.003));}}previousX=e.clientX;previousY=e.clientY;});
addEventListener('resize',()=>{world.renderer.setSize(innerWidth,innerHeight);world.camera.aspect=innerWidth/innerHeight;world.camera.updateProjectionMatrix();});
window.advanceTime=ms=>{manualUntil=performance.now()+100;for(let i=0;i<Math.max(1,Math.round(ms/16.6667));i++)updateSimulation(g,1/60);render(1/60);};
window.render_game_to_text=()=>JSON.stringify({mode:g.mode,coordinates:'x east, z south; meters; north is negative z',player:{x:g.player.x,z:g.player.z,angle:g.player.angle,jump:g.jump},car:g.car?{kind:g.car.kind,x:g.car.x,z:g.car.z,speed:g.car.speed,health:g.car.health}:null,health:g.health,money:g.money,ammo:g.ammo,reserve:g.reserve,wanted:g.wanted,hidden:g.hidden,police:g.police.map(p=>({x:p.x,z:p.z,health:p.health,car:p.car})),mission:g.book.index+1,stage:g.book.stage,objective:g.objective,target:g.target,completed:g.completed,traffic:g.cars.filter(c=>c.ai).length,civilians:g.people.filter(p=>p.health>0).length,buildings:world.buildings.length,rivals:g.rivals.map(p=>({x:p.x,z:p.z,health:p.health})),crates:g.book.crates.map(c=>({x:c.x,z:c.z,collected:c.collected})),difficulty:g.difficulty});
// Explicit inspection access for reproducible browser integration tests.
if(params.has('test'))window.__game=g;
window.gameReady=true;render();
