export class HarborAudio {
  constructor(){this.ctx=null;this.muted=false;}
  start(){
    if(this.ctx){this.ctx.resume();return;}
    const ctx=this.ctx=new AudioContext(),master=this.master=ctx.createGain();master.gain.value=.22;master.connect(ctx.destination);
    this.engine=ctx.createOscillator();this.engine.type='sawtooth';this.engineGain=ctx.createGain();this.engineGain.gain.value=0;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=260;
    this.engine.connect(filter).connect(this.engineGain).connect(master);this.engine.start();
    const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);let r=17;
    for(let i=0;i<data.length;i++){r=(r*16807)%2147483647;data[i]=(r/2147483647-.5)*.12;}
    const sea=ctx.createBufferSource();sea.buffer=buffer;sea.loop=true;const wind=ctx.createBiquadFilter();wind.type='lowpass';wind.frequency.value=450;sea.connect(wind).connect(master);sea.start();
  }
  tone(freq,duration=.1,type='sine',volume=.2,end=freq){if(!this.ctx||this.muted)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(10,end),t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(this.master);o.start();o.stop(t+duration);}
  impact(){this.tone(95,.22,'triangle',.65,20);}
  shot(){this.tone(190,.11,'sawtooth',.5,28);this.tone(1300,.025,'square',.18,200);}
  success(){[330,440,550,660].forEach((f,i)=>setTimeout(()=>this.tone(f,.4,'sine',.2),i*100));}
  update(speed,driving,active,time,wanted){if(!this.ctx)return;this.engine.frequency.setTargetAtTime(38+Math.abs(speed)*4,this.ctx.currentTime,.08);this.engineGain.gain.setTargetAtTime(driving&&active&&!this.muted?.11:0,this.ctx.currentTime,.1);if(active&&wanted&&Math.floor(time*3)!==this.lastSiren){this.lastSiren=Math.floor(time*3);this.tone(this.lastSiren%2?540:720,.22,'sine',.025);}if(active&&Math.floor(time/14)!==this.lastBell){this.lastBell=Math.floor(time/14);this.tone(440+(this.lastBell%3)*110,1.5,'sine',.05);}}
  toggle(){this.muted=!this.muted;if(this.master)this.master.gain.value=this.muted?0:.22;return this.muted;}
}
