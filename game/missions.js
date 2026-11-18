export const jobs = [
 {title:'First Delivery',contact:'NARA / LORONG SENJA',line:'Welcome back, Raka. The blue courier car is yours. Take the sealed package to the north market. Keep it quiet.',objective:'Take the courier car to the north market',reward:350,target:{x:-30,z:-86},end:'Clean run. You kept your word. There is more work at the market.'},
 {title:'Market Pickup',contact:'NARA / LORONG SENJA',line:'Three crates, three stalls. Leave the car, pick them up by hand. The port police are watching the market tonight.',objective:'Collect the three marked crates on foot',reward:500,target:{x:-40,z:-14},end:'All three accounted for. These supplies keep our neighborhood running.'},
 {title:'Harbor Heist',contact:'BIMA / DOCKSIDE',line:'Our shipment is locked in a green truck beside berth four. Take it. Lose the patrols, then bring it to our garage.',objective:'Steal the cargo truck at the harbor',reward:850,target:{x:104,z:44},end:'That cargo was ours before they seized it. Now it is home again.'},
 {title:'Rival Ambush',contact:'NARA / LORONG SENJA',line:'The Ash Tide crew followed the truck. They are coming for the hideout. Get back here and hold them off.',objective:'Return to the hideout and defend the crew',reward:1000,target:{x:-46,z:78},end:'The street is safe. One final parcel, Raka. Take it to the light.'},
 {title:'The Lighthouse Run',contact:'NARA / FINAL TRANSMISSION',line:'The harbor ledger exposes the whole racket. Bring it to Tanjung Api before the patrols close in. We will signal from the tower.',objective:'Deliver the ledger to Tanjung Api lighthouse',reward:1500,target:{x:90,z:-174},end:'The ledger is out. The city will hear our story. For once, the horizon belongs to us.'}
];
export class MissionBook {
 constructor(game){this.g=game;this.index=0;this.stage=0;this.crates=[];this.timer=0;this.kills=0;this.defense=100;}
 begin(index){const g=this.g;this.index=index;this.stage=0;this.timer=0;this.kills=0;this.defense=100;for(const c of this.crates)g.world.scene.remove(c.mesh);this.crates=[];for(const e of g.rivals)g.world.scene.remove(e.mesh);g.rivals=[];
   if(index>=5){g.objective='The city is yours. Explore, drive, and stay free.';g.target=null;return;}
   const job=jobs[index];g.target={...job.target};g.objective=job.objective;g.say(job.contact,job.line,12);
   if(index===1){for(const [x,z] of [[-40,-14],[-20,20],[-40,53]]){const mesh=g.world.box(x,.7,z,1.4,1.4,1.4,0xcda451);this.crates.push({x,z,mesh,collected:false});}}
   if(index===2){g.truck.x=104;g.truck.z=44;g.truck.health=100;g.truck.stolen=false;g.truck.occupied=true;g.truck.speed=0;}
   if(index===4)g.crime(3,'Final run: road patrols alerted');
 }
 interact(){const g=this.g;if(this.index===1&&!g.car){const c=this.crates.find(c=>!c.collected&&g.distance(c)<3.5);if(c){c.collected=true;c.mesh.visible=false;this.stage++;g.audio.tone(660,.2);g.toast('Crate secured · '+this.stage+'/3');if(this.stage===1)g.crime(1,'Market patrol alerted');const next=this.crates.find(c=>!c.collected);g.target=next?{x:next.x,z:next.z}:null;if(this.stage===3)this.complete();return true;}}return false;}
 update(dt){const g=this.g;if(this.index>=5||g.mode!=='playing')return;this.timer+=dt;
   if(this.index===0&&g.car&&g.distance(g.target)<8&&Math.abs(g.car.speed)<11)this.complete();
   if(this.index===1)g.objective='Collect crates on foot · '+this.stage+'/3 · Press E nearby';
   if(this.index===2){if(this.stage===0&&g.car===g.truck){this.stage=1;g.crime(2,'Cargo truck reported stolen');g.target={x:-46,z:78};g.say('BIMA / DOCKSIDE','They saw you. Break their sight, lose the heat, then bring the truck home.',9);}
     if(this.stage===1){g.objective=g.wanted?'Lose the police · keep the cargo truck intact':'Return the cargo truck to the hideout';if(g.truck.health<=0){g.fail('Mission failed','The cargo truck was destroyed.');return;}if(g.car===g.truck&&g.distance(g.target)<10&&g.wanted===0)this.complete();}}
   if(this.index===3){if(this.stage===0&&g.distance(g.target)<22){this.stage=1;g.car&&(g.car.speed=0);g.spawnRivals();g.toast('Ambush! Defend the hideout');}
     if(this.stage===1){g.objective='Defend Lorong Senja · '+g.rivals.filter(e=>e.health<=0).length+'/5 rivals down · hideout '+Math.ceil(this.defense)+'%';if(g.rivals.length&&g.rivals.every(e=>e.health<=0))this.complete();if(this.defense<=0)g.fail('Mission failed','The rivals overran the hideout.');}}
   if(this.index===4&&g.distance(g.target)<9&&g.car&&Math.abs(g.car.speed)<12)this.complete();
 }
 complete(){const g=this.g;if(g.mode!=='playing')return;const job=jobs[this.index];g.money+=job.reward;g.health=Math.min(100,g.health+30);g.reserve+=24;g.wanted=0;g.clearPolice();g.completed=this.index+1;g.save();g.mode=this.index===4?'victory':'complete';g.audio.success();g.showResult(job);}
}
