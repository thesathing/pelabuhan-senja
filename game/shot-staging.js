import * as THREE from './vendor/three.module.min.js';
import {SUN_DIR} from './scene-detail.js';

// Only the two cinematic URL presets use this loop; normal play is untouched.
export function stageVehicleShot(name, {world, player, actor, camera, missions}) {
  const chase = name === 'chase';
  // Low hero angles: drive is a TRUE front-3/4 at ~37 degrees off the nose
  // (camera ahead of the nose and 4.5 to its left, FOV 40) so the long hood,
  // LED strips, splitter and grille all face the camera; chase is a rear
  // chase cam pulled back and up (FOV 46) so the container no longer fills
  // half the frame and both interceptors read separately.
  camera.fov=chase?46:40;camera.updateProjectionMatrix();
  const car = chase ? world.chaseTruck : world.cars.find(c => c.userData.traffic);
  player.vehicle = car;
  player.mode = 'drive';
  player.wanted = chase ? 3 : 0;
  actor.visible = false;
  car.userData.traffic = null;
  car.userData.parked = false;
  car.userData.speed = chase ? 10.8 : 13.4;
  missions.index = chase ? 2 : 0;
  missions.state = 'active';
  // Raka drives: seat him in the driver's seat before the model is aligned.
  world.shotDriver = world.addDriver(car, 1);
  if(!chase){
    // Lit cabin so Raka reads through the lighter glass: a warm point light
    // above the driver, carried by the driver group itself.
    const cabinLight=new THREE.PointLight('#ffe2b0',0.9,3,2);
    cabinLight.position.set(0,1.0,0.15);
    world.shotDriver.add(cabinLight);
  }
  // Vehicle geometry was authored along +X, while driving uses +Z.
  const align = object => {
    const model = new THREE.Group();
    for (const child of [...object.children]) model.add(child);
    model.rotation.y = -Math.PI / 2;
    object.add(model);
    return model;
  };
  align(car);
  const cops = chase ? [world.addPolice(30.5,40,true),world.addPolice(39.5,41,true)] : [];
  cops.forEach(align);
  const traffic = world.cars.find(c => c !== car && c.userData.traffic);
  traffic.userData.traffic = null;
  align(traffic);
  const props = new THREE.Group();
  props.name = 'harbor-shot-details';
  world.scene.add(props);
  // Place existing drifting cloud banks on the horizon of these two presets.
  world.clouds[0].position.set(-20,28,165);
  world.clouds[1].position.set(66,34,192);
  world.clouds[2].position.set(8,41,210);
  function box(color,x,y,z,w,h,d) {
    const item = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.8}));
    item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;props.add(item);return item;
  }
  if(chase) {
    // Crates and a dock crane ahead of the truck, inside the rear chase
    // camera's view down the waterfront road.
    for(let i=0;i<4;i++) {
      const x=15+i*13,z=58+(i%2)*8,gy=world.height(x,z),color=['#9a5140','#557b7d','#b79b59','#65765b'][i];
      box(color,x,gy+1.7,z,10,3.4,4);
      for(let rib=0;rib<15;rib++)box('#394f4e',x-4.6+rib*.66,gy+1.7,z-2.03,.055,3.1,.06);
    }
    box('#b18c50',70,12,62,.7,22,.7);box('#c4a269',58,23,62,26,.7,.7);
    box('#917447',46,17,62,.1,12,.1);box('#514b3d',46,10.7,62,1.2,.7,.3);
    const brace=box('#b18c50',64,18,62,.35,14,.35);brace.rotation.z=-.85;
  }
  let time=0;
  const tick = dt => {
    time+=dt;
    const z=(chase?36:-23)+(time*car.userData.speed)%8;
    car.position.set(35,1.28,z);car.rotation.y=0;
    player.position.copy(car.position);player.rotation=0;
    if(chase){
      // Oncoming car ahead in the right lane, facing the camera. It sits
      // four units ahead of the harbor crates so its center ray clears the
      // crate ribs, and in the gap between the trailing interceptor and the
      // truck so no vehicle hides another.
      traffic.position.set(38,1.28,z+12);traffic.rotation.y=Math.PI;
    }else{
      // Traffic car behind the hero coupe, facing the camera, inside the
      // FOV 40 frame as a full body in the background.
      traffic.position.set(34,1.28,z-8);traffic.rotation.y=0;
    }
    cops.forEach((cop,i)=>{
      // Interceptors split across the truck: one ahead in the left lane, one
      // trailing in the right lane, so each center ray clears the container
      // and the two cars never overlap in frame.
      cop.position.set(i?39.5:30.5,1.28,z+(i?-2:6));cop.rotation.y=0;
      cop.traverse(part=>{if(part.userData.siren){
        const on=Math.sin(time*14+i*Math.PI+(part.position.z<0?0:Math.PI))>0;
        part.material.color.set(part.position.z<0?'#ff3434':'#3884ff');
        part.material.color.multiplyScalar(on?3:.28);
      }});
    });
    // Low cameras, close to the action: the driver reads large through the
    // windshield and side glass, and the truck cab past the container.
    // Drive: camera ahead of the nose, 4.5 to its left — a true front-3/4.
    // Chase: pulled back and up so the container shrinks and both cops fit.
    if(chase){camera.position.set(36,3.0,z-14);camera.lookAt(35,1.8,z+3)}
    else{camera.position.set(30.5,1.7,z+6);camera.lookAt(35,1.2,z+0.5)}
    camera.updateMatrixWorld(true);
  };
  tick(0);
  return {tick,car,cops,traffic,props};
}

// Read-only visibility evidence for the capture harness; no pixels are modified.
export function inspectShot(world,camera,player,shot) {
  world.scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const project=v=>{const p=v.clone().project(camera);return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2,p.z]};
  const inspect=object=>{
    if(!object)return null;
    const b=new THREE.Box3().setFromObject(object),points=[];
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push(project(new THREE.Vector3(x,y,z)));
    const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
    const center=b.getCenter(new THREE.Vector3()),ray=new THREE.Raycaster(camera.position,center.clone().sub(camera.position).normalize());ray.camera=camera;
    const hit=ray.intersectObjects(world.scene.children,true).find(h=>h.object.visible&&h.object.material?.depthWrite!==false);
    let belongs=false;for(let o=hit?.object;o;o=o.parent)if(o===object)belongs=true;
    let blockedBy=null;
    if(hit&&!belongs){const chain=[];for(let o=hit.object;o;o=o.parent){const p=new THREE.Vector3();o.getWorldPosition?.(p);chain.push(`${o.type}@${p.toArray().map(v=>+v.toFixed(1)).join(',')}`);if(!o.parent||o.parent===world.scene)break}blockedBy={dist:+hit.distance.toFixed(2),point:hit.point.toArray().map(v=>+v.toFixed(2)),chain,mat:hit.object.material?.color?('#'+hit.object.material.color.getHexString()):null,transparent:!!hit.object.material?.transparent}}
    return {bounds:bounds.map(v=>+v.toFixed(2)),center:project(center),visible:belongs,position:object.position.toArray(),blockedBy};
  };
  const lights=[];for(const cop of shot?.cops||[])cop.traverse(p=>{if(p.userData.siren)lights.push(p.material.color.toArray())});
  const inFrame=o=>o&&o.visible&&o.center[2]>-1&&o.center[2]<1&&o.center[0]>0&&o.center[0]<innerWidth&&o.center[1]>0&&o.center[1]<innerHeight;
  const trees=world.scene.children.filter(g=>g.isGroup&&g.userData.palm);
  const buildings=world.scene.children.filter(g=>g.isGroup&&world.buildings.some(b=>b.w&&b.x===g.position.x&&b.z===g.position.z));
  const markings=world.scene.children.filter(m=>m.isMesh&&m.geometry?.type==='BoxGeometry'&&m.position.y>=1.13&&m.position.y<=1.15);
  const landmarks={palms:trees.map(inspect).filter(inFrame).length,buildings:buildings.map(inspect).filter(inFrame).length,laneMarkings:markings.map(inspect).filter(inFrame).length,harborProps:(shot?.props.children||[]).map(inspect).filter(inFrame).length,clouds:world.clouds.map(inspect).filter(inFrame).length,hillGrass:(world.hillGrassPositions||[]).map(p=>project(new THREE.Vector3(p[0],p[1]+.4,p[2]))).filter(v=>v[0]>0&&v[0]<innerWidth&&v[1]>0&&v[1]<innerHeight&&v[2]>-1&&v[2]<1).length};
  // Raka: project head + torso and check line-of-sight (transparent glass does not block).
  const rakaObj=world.shotDriver;
  let headWorld,torsoWorld;
  if(rakaObj&&rakaObj.userData.head){headWorld=new THREE.Vector3();rakaObj.userData.head.getWorldPosition(headWorld);torsoWorld=new THREE.Vector3();rakaObj.userData.torso.getWorldPosition(torsoWorld)}
  else{headWorld=new THREE.Vector3(player.position.x,player.position.y+1.72,player.position.z);torsoWorld=new THREE.Vector3(player.position.x,player.position.y+1.12,player.position.z)}
  const head2d=project(headWorld),torso2d=project(torsoWorld);
  const rayDir=headWorld.clone().sub(camera.position).normalize();
  const ray=new THREE.Raycaster(camera.position,rayDir);ray.camera=camera;ray.far=camera.position.distanceTo(headWorld);
  const blocker=ray.intersectObjects(world.scene.children,true).find(h=>{if(!h.object.visible)return false;const m=h.object.material;if(m&&m.transparent)return false;if(h.point.distanceTo(headWorld)<0.35)return false;for(let o=h.object;o;o=o.parent)if(o===rakaObj)return false;return true});
  const raka={head:head2d.slice(0,2).map(v=>+v.toFixed(1)),torso:torso2d.slice(0,2).map(v=>+v.toFixed(1)),headWorld:headWorld.toArray().map(v=>+v.toFixed(2)),inFrame:head2d[0]>=0&&head2d[0]<=innerWidth&&head2d[1]>=0&&head2d[1]<=innerHeight&&head2d[2]>-1&&head2d[2]<1,visible:!blocker};
  // Nose vs tail screen positions: the staged car's forward is world +Z
  // (rotation.y=0 after align), so the nose is the +Z end. A front-3/4 hero
  // reads with the nose on the camera side of the frame, ahead of the tail.
  let nose=null,tail=null;
  if(shot?.car){const half=(shot.car.userData.length||5.2)/2;const cp=shot.car.position;
    nose=project(new THREE.Vector3(cp.x,cp.y+.6,cp.z+half)).map(v=>+v.toFixed(1));
    tail=project(new THREE.Vector3(cp.x,cp.y+.6,cp.z-half)).map(v=>+v.toFixed(1));}
  return {camera:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,car:inspect(shot?.car),police:(shot?.cops||[]).map(inspect),traffic:inspect(shot?.traffic),nose,tail,speed:player.vehicle?.userData.speed||0,wanted:player.wanted,lights,landmarks,clouds:world.clouds.map(c=>c.position.toArray()),sun:project(camera.position.clone().add(SUN_DIR.clone().multiplyScalar(400))),raka};
}
