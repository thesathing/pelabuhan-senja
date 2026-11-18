const map=document.querySelector('#map'),ctx=map.getContext('2d');map.style.zIndex='1';
const CALLSIGNS=['IBIS-43','TARPON-10','HERON-17','KESTREL-31','MARLIN-26'];
const $=id=>document.querySelector('#'+id);

function drawPortrait(name){
  const c=$('portrait');if(!c)return;const x=c.getContext('2d');
  x.clearRect(0,0,96,96);
  const bg=x.createLinearGradient(0,0,0,96);bg.addColorStop(0,'#2a1a4e');bg.addColorStop(1,'#120a24');
  x.fillStyle=bg;x.fillRect(0,0,96,96);
  const skin=name==='Dimas'?'#966649':'#c98a5f';
  const shirt=name==='Mira'?'#2f8f7a':name==='Dimas'?'#c96a2f':'#273e43';
  x.fillStyle=shirt;x.beginPath();x.moveTo(18,96);x.quadraticCurveTo(20,66,48,64);x.quadraticCurveTo(76,66,78,96);x.closePath();x.fill();
  x.fillStyle=skin;x.beginPath();x.arc(48,44,20,0,Math.PI*2);x.fill();
  x.fillStyle='#1c1a20';
  if(name==='Mira'){x.beginPath();x.arc(48,38,22,Math.PI,0);x.fill();x.fillRect(24,36,10,34);x.fillRect(62,36,10,34);x.fillStyle='#ffd23d';x.beginPath();x.arc(30,52,2.5,0,Math.PI*2);x.fill()}
  else if(name==='Dimas'){x.beginPath();x.arc(48,30,21,Math.PI,0);x.fill();x.fillRect(26,26,44,7);x.fillStyle='#c96a2f';x.fillRect(26,26,44,7);x.fillStyle='#3a2a1a';x.fillRect(40,58,16,6)}
  else{x.beginPath();x.arc(48,34,20,Math.PI,0);x.fill();x.fillRect(28,30,40,6)}
  x.fillStyle='#120a24';x.beginPath();x.arc(40,44,3,0,Math.PI*2);x.arc(56,44,3,0,Math.PI*2);x.fill();
  x.strokeStyle='rgba(255,95,162,.55)';x.lineWidth=2;x.strokeRect(1,1,94,94);
}

export function drawHUD(player,missions,time,difficulty,world){
  $('health').textContent=`♥ ${Math.max(0,Math.ceil(player.health))}`;
  $('health-fill').style.width=`${Math.max(0,player.health)}%`;
  $('money').textContent=`$ ${player.money.toLocaleString('en-US')}`;
  $('ammo').textContent=`▣ ${player.ammo} / ${player.reserve}`;
  $('wanted').textContent='★'.repeat(player.wanted)+'☆'.repeat(5-player.wanted);
  const speed=player.vehicle?Math.round(Math.abs(player.vehicle.userData.speed||0)*5):0;
  $('speed').textContent=speed?`${speed}`:'0';
  $('gear').textContent=speed<6?'G1':speed<11?'G2':speed<17?'G3':'G4';
  $('objective').textContent=missions.objective;
  $('chapter').textContent=`CH ${Math.min(missions.index+1,5)} · ${missions.current.title.toUpperCase()}`;
  $('stage-fill').style.width=`${Math.round(missions.progress*100)}%`;
  $('stage-label').textContent=missions.index===1?`CRATES ${missions.crates} / 3`:`STAGE ${missions.index+1} / 5`;
  const next=missions.nextTitle;
  $('next').textContent=next?`NEXT ${next.toUpperCase()}`:'NEXT — FINAL RUN';
  $('clock').textContent=`18:${String(42+Math.floor(time/2)%18).padStart(2,'0')}`;
  const x=player.position.x;
  $('district').textContent=x>80?'TANJUNG API':player.position.z>58?'THE HARBOR':Math.abs(x-35)<18?'PASAR SENJA':'OLD TOWN';
  $('hint').textContent=player.mode==='drive'?'W/S DRIVE · A/D STEER · E EXIT · SPACE HANDBRAKE':'WASD MOVE · E INTERACT · F MELEE · CLICK FIRE · SHIFT RUN';
  // Police response list: live units, distances and status. Chase only.
  const list=$('police-list');
  const alive=(world?.police||[]).filter(c=>c.userData.alive);
  if(player.wanted>0&&alive.length){
    list.classList.remove('hidden');
    $('police-head').textContent=`POLICE RESPONSE · ${alive.length} UNIT${alive.length===1?'':'S'} · CODE ${player.wanted}`;
    list.querySelectorAll('.police-row').forEach(r=>r.remove());
    alive.slice(0,5).forEach((cop,i)=>{
      const d=Math.round(Math.hypot(player.position.x-cop.position.x,player.position.z-cop.position.z));
      const status=d<8?'RAMMING':d<45?'PURSUIT':'ROADBLOCK';
      const row=document.createElement('div');row.className='police-row';
      row.innerHTML=`<span class="police-unit">▸ ${CALLSIGNS[i%CALLSIGNS.length]}</span><span class="police-dist">${d} m</span><span class="police-status ${status.toLowerCase()}">${status}</span>`;
      list.appendChild(row);
    });
  }else list.classList.add('hidden');
  // Dialogue card: current speaker, canvas portrait, one story line.
  const speaker=missions.speaker;
  if($('dialogue-name').textContent!==speaker){$('dialogue-name').textContent=speaker;drawPortrait(speaker)}
  $('dialogue-text').textContent=missions.dialogueLine;
  $('respect').textContent=`RESPECT ${missions.respect}`;
  $('respect-fill').style.width=`${Math.round((player.money%400)/4)}%`;
}
export function drawMinimap(player,world,missions){
  ctx.save();
  ctx.beginPath();ctx.arc(100,100,99,0,Math.PI*2);ctx.clip();
  const mx=x=>12+(x+135)*.61,my=z=>10+(z+120)*.61;
  ctx.fillStyle='#48514d';ctx.fillRect(0,0,200,200);
  ctx.fillStyle='#32656b';ctx.fillRect(0,my(60),200,200-my(60));
  ctx.fillStyle='#636452';for(const b of world.buildings)if(b.w)ctx.fillRect(mx(b.x-b.w/2),my(b.z-b.d/2),b.w*.61,b.d*.61);
  ctx.strokeStyle='#d1bc8e';ctx.lineWidth=3;
  for(const z of [-78,-38,2,42]){ctx.beginPath();ctx.moveTo(mx(-80),my(z));ctx.lineTo(mx(150),my(z));ctx.stroke()}
  for(const x of [-45,-5,35,75,115]){ctx.beginPath();ctx.moveTo(mx(x),my(-120));ctx.lineTo(mx(x),my(100));ctx.stroke()}
  ctx.strokeStyle='#a58c65';ctx.lineWidth=2;for(const z of [64,80,96,112,128]){ctx.beginPath();ctx.moveTo(mx(-27),my(z));ctx.lineTo(mx(95),my(z));ctx.stroke()}
  ctx.fillStyle='#e9ece1';for(const c of world.cars)ctx.fillRect(mx(c.position.x)-1.3,my(c.position.z)-2,2.6,4);
  ctx.fillStyle='#ff4d43';for(const p of world.police)if(p.userData.alive){ctx.beginPath();ctx.arc(mx(p.position.x),my(p.position.z),3,0,Math.PI*2);ctx.fill()}
  const goal=missions.markerPosition();if(goal){const x=mx(goal[0]),y=my(goal[1]);ctx.fillStyle='#ffcf68';ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill()}
  ctx.save();ctx.translate(mx(player.position.x),my(player.position.z));ctx.rotate(-player.rotation);ctx.fillStyle='#fff4d4';ctx.strokeStyle='#243238';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(5,-6);ctx.lineTo(0,-3);ctx.lineTo(-5,-6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  ctx.restore();
  ctx.strokeStyle='#ff5fa2';ctx.lineWidth=3;ctx.beginPath();ctx.arc(100,100,98,0,Math.PI*2);ctx.stroke();
}

// Full city map: the real world layout, drawn from live world data.
export function drawCityMap(player,world,missions){
  const c=$('bigmap'),x=c.getContext('2d'),W=c.width,H=c.height;
  const s=1.72,ox=(W-300*s)/2,oy=(H-280*s)/2;
  const mx=v=>ox+(v+135)*s,my=v=>oy+(v+120)*s;
  x.fillStyle='#1d4e6b';x.fillRect(0,0,W,H);
  x.fillStyle='#2b3a55';x.fillRect(mx(-135),my(-120),300*s,180*s);
  x.fillStyle='#31435f';x.fillRect(mx(84),my(-74),32*s,32*s);
  x.fillStyle='#3a2a4e';x.fillRect(mx(-135),my(56),300*s,4*s);
  x.strokeStyle='#d1bc8e';x.lineWidth=5;
  for(const z of [-120,-78,-38,2,42,56,112]){x.beginPath();x.moveTo(mx(-135),my(z));x.lineTo(mx(165),my(z));x.stroke()}
  for(const vx of [-80,-45,-5,35,75,115]){x.beginPath();x.moveTo(mx(vx),my(-120));x.lineTo(mx(vx),my(112));x.stroke()}
  x.fillStyle='#4a5a78';
  for(const b of world.buildings)if(b.w)x.fillRect(mx(b.x-b.w/2),my(b.z-b.d/2),b.w*s,b.d*s);
  x.strokeStyle='#8a6a7a';x.lineWidth=2;
  for(const z of [64,80,96,112,128]){x.beginPath();x.moveTo(mx(-27),my(z));x.lineTo(mx(95),my(z));x.stroke()}
  x.font='700 15px Inter, system-ui, sans-serif';x.textAlign='center';
  const label=(t,wx,wz,color='#ffd23d')=>{x.strokeStyle='rgba(10,8,20,.9)';x.lineWidth=4;x.strokeText(t,mx(wx),my(wz));x.fillStyle=color;x.fillText(t,mx(wx),my(wz))};
  label('PASAR SENJA',35,-14);label('THE HARBOR',35,84,'#7dd8ff');label('OLD TOWN',-62,-52);label('TANJUNG API',100,-72,'#ff8ad0');label('DERMAGA',62,68,'#7dd8ff');label('PERGUDANGAN',104,26);
  c.dataset.districts='PASAR SENJA|THE HARBOR|OLD TOWN|TANJUNG API|DERMAGA|PERGUDANGAN';
  const goal=missions.markerPosition();
  if(goal){x.fillStyle='#ffcf68';x.beginPath();const gx=mx(goal[0]),gy=my(goal[1]);x.moveTo(gx,gy-9);x.lineTo(gx+9,gy);x.lineTo(gx,gy+9);x.lineTo(gx-9,gy);x.closePath();x.fill();x.strokeStyle='#120a24';x.lineWidth=2;x.stroke()}
  x.fillStyle='#fff3c4';x.beginPath();x.arc(mx(100),my(-58),6,0,Math.PI*2);x.fill();
  x.save();x.translate(mx(player.position.x),my(player.position.z));x.rotate(-player.rotation);x.fillStyle='#ffffff';x.strokeStyle='#120a24';x.lineWidth=2;x.beginPath();x.moveTo(0,11);x.lineTo(8,-9);x.lineTo(0,-4);x.lineTo(-8,-9);x.closePath();x.fill();x.stroke();x.restore();
  // Job list and stats, all live from mission state.
  const jobs=$('map-jobs');jobs.innerHTML='';
  const names=['First Delivery','Market Pickup','Harbor Heist','Rival Ambush','The Lighthouse Run'];
  names.forEach((name,i)=>{
    const li=document.createElement('li');
    const status=i<missions.index?'Complete':i===missions.index?(missions.state==='mission-complete'?'Stage done':'In progress'):'Locked';
    li.className=i<missions.index?'done':i===missions.index?'current':'locked';
    li.innerHTML=`<span class="job-num">${i+1}</span><span class="job-name">${name.toUpperCase()}</span><span class="job-cash">$${missions.rewardFor(i).toLocaleString('en-US')}</span><span class="job-status">${status}</span>`;
    jobs.appendChild(li);
  });
  $('map-stats').innerHTML=`<span>Cash <b>$${player.money.toLocaleString('en-US')}</b></span><span>Respect level <b>${missions.respect}</b></span><span>Deliveries <b>${missions.index} / 5</b></span>`;
  const cur=names[Math.min(missions.index,4)];
  $('map-current').innerHTML=`<span class="job-num">${Math.min(missions.index+1,5)}</span><span class="job-name">${cur.toUpperCase()}</span><span class="job-status">${missions.objective}</span>`;
}
export function showCard(title,body,action,callback){const el=document.querySelector('#overlay');el.innerHTML=`<div class="panel end"><div class="eyebrow">LORONG SENJA</div><h2>${title}</h2><p>${body}</p><button class="primary">${action}</button></div>`;el.classList.remove('hidden');el.querySelector('button').onclick=callback}
