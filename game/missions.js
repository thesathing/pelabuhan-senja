const scripts=[
{title:'First Delivery',name:'First Delivery',from:'Mira: Take the package from our alley. No questions on the road.',task:'Deliver the parcel to the Pasar Senja night market.',goal:[35,0]},
{title:'Market Pickup',name:'Market Pickup',from:'Dimas: Three sealed crates. Bring them back on foot and keep the uniforms guessing.',task:'Collect three crates from the market stalls.',goal:[35,0]},
{title:'Harbor Heist',name:'Harbor Heist',from:'Mira: A truck is waiting by the water. Borrow it and disappear.',task:'Reach the boat-side truck and escape the two-star search.',goal:[-5,65]},
{title:'Rival Ambush',name:'Rival Ambush',from:'Dimas: The rival crew found the hideout. Hold the alley until the coast is clear.',task:'Defend the Lorong Senja hideout.',goal:[-45,-38]},
{title:'The Lighthouse Run',name:'The Lighthouse Run',from:'Mira: One final package. Take it to Tanjung Api, then outrun the response.',task:'Make the final delivery at the lighthouse.',goal:[100,-58]}
];
export class Missions{
constructor(game){this.game=game;this.index=0;this.crates=0;this.state='ready';this.timer=0;this.dialogue=scripts[0].from;this.marker=null}
start(){this.state='active';this.dialogue=scripts[this.index].from;this.timer=4;this.game.toast(this.dialogue);this.game.save()}
get current(){return scripts[Math.min(this.index,scripts.length-1)]}
get nextTitle(){return this.index<4?scripts[this.index+1].title:null}
get dialogueLine(){return scripts[Math.min(this.index,scripts.length-1)].from.split(':').slice(1).join(':').trim()}
rewardFor(i){return i===4?1200:350}
// Live stage progress, 0..1: crates for the market run, rivals for the
// ambush, distance to the goal otherwise, full once the stage is done.
get progress(){
  if(this.state==='mission-complete'||this.state==='complete')return 1;
  if(this.index===1)return Math.min(1,this.crates/3);
  if(this.index===3)return Math.min(1,this.game.rivalsDefeated()/3);
  if(this.index===2&&this.escapeStarted)return this.game.player.wanted===0?1:.6;
  const p=this.game.player,goal=this.current.goal;
  return Math.max(0,Math.min(1,1-Math.hypot(p.position.x-goal[0],p.position.z-goal[1])/120));
}
get respect(){return Math.min(5,this.index+1)}
get objective(){if(this.state==='complete')return 'All five deliveries complete. The harbor lights are yours.';if(this.index===1&&this.state==='active')return `Collect sealed crates: ${this.crates} / 3`;return this.current.task}
update(dt){if(this.state!=='active')return;this.timer=Math.max(0,this.timer-dt);const p=this.game.player,pos=this.current.goal,d=Math.hypot(p.position.x-pos[0],p.position.z-pos[1]);if(this.index===0&&d<7&&p.vehicle){this.finish()}if(this.index===1&&this.crates>=3){this.finish()}if(this.index===2&&p.vehicle?.userData.type==='truck'&&p.wanted<2){this.game.raiseWanted(2-p.wanted);this.escapeStarted=true}if(this.index===2&&this.escapeStarted&&p.wanted===0)this.finish();if(this.index===3&&this.game.rivalsDefeated()>=3)this.finish();if(this.index===4&&d<10&&p.vehicle&&p.wanted===0)this.finish();if((this.index===2&&p.wanted===0&&p.vehicle?.userData.type==='truck')||(this.index===4&&p.wanted===0&&d<10&&p.vehicle))this.finish()}
collect(){if(this.state!=='active'||this.index!==1)return false;const crate=this.game.world.crates.find(c=>!c.userData.collected&&c.position.distanceTo(this.game.player.position)<3);if(!crate)return false;crate.userData.collected=true;crate.visible=false;this.crates++;this.game.toast(`Sealed crate secured (${this.crates}/3)`);if(this.crates>=3)this.finish();return true}
finish(){this.state='mission-complete';this.game.player.money+=this.index===4?1200:350;this.game.player.wanted=Math.min(this.game.player.wanted,this.index===2?2:this.index===4?3:0);this.game.save();this.game.showMissionCard(this.current.title);this.timer=5}
advance(){if(this.state!=='mission-complete')return;this.index++;if(this.index>=scripts.length){this.state='complete';this.game.save();this.game.victory();return}this.crates=0;this.state='active';this.dialogue=scripts[this.index].from;this.game.toast(this.dialogue);this.game.save()}
fail(reason='Raka is down. The delivery can wait.'){this.state='failed';this.game.showFail(reason)}
restart(){this.state='active';this.crates=0;this.game.player.health=100;this.game.player.position.set(-45,1,-38);this.game.player.wanted=0;this.game.toast(scripts[this.index].from);this.game.save()}
markerPosition(){if(this.index===1&&this.state==='active'){return [35,0]}return this.current.goal}
}
