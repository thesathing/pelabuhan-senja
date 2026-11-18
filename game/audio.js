export class Soundscape{
constructor(){this.ctx=null;this.master=null;this.lastEngine=0;this.siren=null;this.sirenTimer=0;this.sirenHigh=false;this.radioTimer=0;this.radioStep=0;this.lastScreech=0;this.noiseBuf=null}
start(){if(this.ctx)return;const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.13;this.master.connect(this.ctx.destination);const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='triangle';osc.frequency.value=74;gain.gain.value=.022;osc.connect(gain);gain.connect(this.master);osc.start();this.ambience={osc,gain};
  // Shared noise buffer for tire screeches.
  const len=this.ctx.sampleRate*.3,buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  this.noiseBuf=buf;
}
tone(freq,duration=.13,wave='sine',volume=.13){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),now=this.ctx.currentTime;o.type=wave;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(38,freq*.48),now+duration);g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(this.master);o.start(now);o.stop(now+duration)}
note(freq,duration=.5,volume=.028){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),now=this.ctx.currentTime;o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.04);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(this.master);o.start(now);o.stop(now+duration+.05)}
shot(){this.tone(180,.19,'sawtooth',.22)}impact(){this.tone(92,.16,'triangle',.18)}pickup(){this.tone(510,.18,'sine',.1)}blip(){this.tone(660,.07,'sine',.08)}engine(speed){if(!this.ctx||!this.ambience)return;const t=this.ctx.currentTime;if(t-this.lastEngine<.08)return;this.lastEngine=t;this.ambience.osc.frequency.setTargetAtTime(62+speed*7,t,.06)}
// Tire screech: short filtered noise burst, quiet, throttled.
screech(){if(!this.ctx||!this.noiseBuf)return;const t=this.ctx.currentTime;if(t-this.lastScreech<.35)return;this.lastScreech=t;const src=this.ctx.createBufferSource();src.buffer=this.noiseBuf;const bp=this.ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=950;bp.Q.value=1.1;const g=this.ctx.createGain();g.gain.setValueAtTime(.13,t);g.gain.exponentialRampToValueAtTime(.001,t+.28);src.connect(bp);bp.connect(g);g.connect(this.master);src.start(t);src.stop(t+.3)}
// Per-frame audio director: two-tone siren while wanted, quiet radio
// arpeggio while driving. Called from the game loop; silent before start().
update(dt,state){
  if(!this.ctx)return;
  const t=this.ctx.currentTime;
  if(state.wanted>0){
    if(!this.siren){
      const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type='sine';o.frequency.value=660;g.gain.value=.04;
      o.connect(g);g.connect(this.master);o.start();
      this.siren={osc:o,gain:g};this.sirenTimer=0;this.sirenHigh=false;
    }
    this.sirenTimer+=dt;
    if(this.sirenTimer>.45){
      this.sirenTimer=0;this.sirenHigh=!this.sirenHigh;
      this.siren.osc.frequency.setTargetAtTime(this.sirenHigh?920:660,t,.06);
    }
  }else if(this.siren){
    try{this.siren.osc.stop()}catch(e){}
    this.siren=null;
  }
  if(state.driving){
    this.radioTimer-=dt;
    if(this.radioTimer<=0){
      this.radioTimer=.27;
      // A minor pentatonic walk, up then down, quiet under the engine.
      const scale=[220,261.63,293.66,329.63,392,440,392,329.63,293.66,261.63];
      this.note(scale[this.radioStep%scale.length],.5,.026);
      this.radioStep++;
    }
  }else{
    this.radioTimer=0;
  }
}
}
