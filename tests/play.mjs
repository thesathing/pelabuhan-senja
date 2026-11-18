import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,statSync} from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[],external=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push(r.url()));page.on('request',r=>{if(!r.url().startsWith('http://localhost:8080')&&!r.url().startsWith('data:'))external.push(r.url());});
mkdirSync('test-artifacts',{recursive:true});
function check(name,value,detail){checks.push({name,pass:!!value,detail});console.log((value?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));if(!value)throw new Error(name);}
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const step=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const hold=async(key,ms)=>{await page.keyboard.down(key);await step(ms);await page.keyboard.up(key);};
try{
 for(const [i,name] of ['start','drive','chase','victory'].entries()){
  await page.goto('http://localhost:8080/?shot='+name+'&seed=2601');await page.waitForFunction(()=>window.gameReady);await page.waitForTimeout(350);const s=await state();
  check(name+' loads correct state',s.mode===({start:'title',drive:'playing',chase:'playing',victory:'victory'}[name]));
  check(name+' HUD and minimap',await page.evaluate(()=>{const c=document.getElementById('minimap'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return document.getElementById('hud').getBoundingClientRect().width===1280&&d.some(v=>v>0);}));
  if(name==='chase')check('chase has 3 stars and police',s.wanted===3&&s.police.length>=3);
  await page.screenshot({path:`screenshots/${i+1}-${name}.jpg`,type:'jpeg',quality:83});check(name+' JPEG within cap',statSync(`screenshots/${i+1}-${name}.jpg`).size<262144);
 }
 await page.goto('http://localhost:8080/?test=1&seed=2601');await page.waitForFunction(()=>window.gameReady);await page.click('#start-btn');let s=await state();check('mission 1 starts',s.mode==='playing'&&s.mission===1);check('world population',s.buildings===40&&s.traffic===12&&s.civilians===20);
 const before=s.player.z;await hold('w',500);s=await state();check('walk via keyboard',s.player.z<before-1);
 await hold('Space',150);s=await state();check('jump rises',s.player.jump>.2);await step(1000);
 await page.keyboard.press('e');s=await state();check('enter courier',!!s.car);
 await hold('w',2600);s=await state();check('drive acceleration',s.car.speed>20&&s.player.z<50,s.car);
 await hold('a',200);const heading=(await state()).player.angle;check('steering changes heading',Math.abs(heading-Math.PI)>.1);
 await hold('d',200);await hold('Space',1500);check('handbrake slows car',Math.abs((await state()).car.speed)<2);
 // Continue the first job with real throttle/brake input on its market route.
 await page.evaluate(()=>{const g=window.__game;g.car.x=-30;g.car.angle=Math.PI;g.player.x=-30;});
 for(let i=0;i<35;i++){s=await state();if(s.player.z<-73)break;await hold('w',250);}
 await hold('Space',1800);s=await state();if(s.mode==='playing'){
  for(let i=0;i<40;i++){s=await state();if(s.mode==='complete')break;await hold('w',100);if(s.player.z<-79)await hold('Space',350);}
 }
 s=await state();check('mission 1 completes with driving inputs',s.mode==='complete'&&s.completed===1,s);check('mission reward saved',await page.evaluate(()=>JSON.parse(localStorage.getItem('pelabuhan-senja-v1')).completed===1));
 await page.click('#next-btn');check('mission 2 unlocked',(await state()).mission===2);
 await page.evaluate(()=>{const g=window.__game;g.car=null;g.player.x=-81;g.player.z=39;});await page.keyboard.press('e');s=await state();check('theft raises wanted and spawns patrols',!!s.car&&s.wanted>0&&s.police.length>0);
 check('driver exits car',s.civilians===21);
 await page.keyboard.press('e');check('exit stolen car',!(await state()).car);
 await page.keyboard.press('Escape');check('pause',(await state()).mode==='paused');const paused=(await state()).player.z;await hold('w',500);check('pause freezes movement',(await state()).player.z===paused);await page.click('#resume-btn');
 for(let i=0;i<3;i++){await page.evaluate(i=>{const g=window.__game,c=g.book.crates[i];g.player.x=c.x;g.player.z=c.z+1.5;},i);await page.keyboard.press('e');}
 check('all market crates complete mission',(await state()).completed===2);await page.click('#next-btn');
 await page.evaluate(()=>{const g=window.__game;g.player.x=104;g.player.z=47;});await page.keyboard.press('e');await step(40);s=await state();check('harbor truck theft triggers chase',s.car?.kind==='truck'&&s.stage===1&&s.wanted>=2);
 await page.evaluate(()=>{const g=window.__game;g.car.x=-46;g.car.z=84;g.player.x=-46;g.player.z=84;for(const p of g.police){p.x=94;p.z=-90;}});await page.keyboard.press('e');await page.keyboard.press('e');
 // Lay-low interaction tested apart from truck entry priority.
 await page.evaluate(()=>{const g=window.__game;g.car=null;g.player.x=-49;g.player.z=81;g.truck.x=-39;g.truck.z=85;});await page.keyboard.press('e');check('paid lay low clears pursuit',(await state()).wanted===0);
 await page.evaluate(()=>{const g=window.__game;g.player.x=-39;g.player.z=87;});await page.keyboard.press('e');await step(30);check('cargo return completes job',(await state()).completed===3);await page.click('#next-btn');await step(30);check('ambush spawns five rivals',(await state()).rivals.length===5);
 // Aim actual shots at rivals, with controlled spacing for hit/miss assertions.
 await page.evaluate(()=>{const g=window.__game;g.car=null;g.player.x=-30;g.player.z=90;g.lookAngle=Math.PI;g.player.angle=Math.PI;g.orbit=0;g.rivals.forEach((e,i)=>{e.x=-30;e.z=82-i*4;});});
 const ammo=(await state()).ammo;await page.mouse.click(640,360);check('pistol consumes ammo',(await state()).ammo===ammo-1);check('bullet hits aimed rival',(await state()).rivals.some(e=>e.health<70));
 for(let i=0;i<14;i++){await step(300);if((await state()).ammo===0){await page.keyboard.press('r');await step(1400);}await page.mouse.click(640,360);if((await state()).completed===4)break;}
 s=await state();check('combat resolves ambush',s.completed===4,s.rivals);await page.click('#next-btn');check('final run starts with three stars',(await state()).wanted===3);
 await page.evaluate(()=>{const g=window.__game;g.car=g.courier;g.car.x=90;g.car.z=-169;g.car.speed=0;g.player.x=90;g.player.z=-169;});await step(30);check('lighthouse delivery wins',(await state()).mode==='victory'&&(await state()).completed===5);
 await page.click('#next-btn');check('victory allows free roam',(await state()).mission===6);
 await page.evaluate(()=>{window.__game.hitCooldown=0;window.__game.damage(1000);});check('wasted screen',(await state()).mode==='failed');await page.click('#retry-btn');check('retry retains saved progress',(await state()).completed===5&&(await state()).health===100);
 await page.reload();await page.waitForFunction(()=>window.gameReady);await page.click('#continue-btn');check('continue restores completed story',(await state()).completed===5);
 check('zero console errors',errors.length===0,errors);check('zero failed requests',failed.length===0,failed);check('zero external requests',external.length===0,external);
}catch(e){await page.screenshot({path:'test-artifacts/failure.png'});console.error(e);process.exitCode=1;}finally{writeFileSync('test-artifacts/playwright-report.json',JSON.stringify({checks,errors,failed,external},null,2));await browser.close();}
