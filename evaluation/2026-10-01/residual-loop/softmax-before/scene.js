/* Original deterministic Canvas scene. Every capture uses an explicit time. */
(() => {
  const canvas=document.getElementById('scene'), ctx=canvas.getContext('2d');
  const logits=[-1,0.6,1.8], masses=logits.map(Math.exp), denominator=masses.reduce((a,b)=>a+b,0);
  const probabilities=masses.map(v=>v/denominator), colors=['#64dcca','#8ba4ff','#ffba82'];
  const meta={version:1,caseId:'softmax',renderer:'canvas2d',width:1920,height:1080,duration:12,fps:60};
  const lerp=(a,b,u)=>a+(b-a)*u;
  const smooth=(t,a,b)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*u*(10-15*u+6*u*u);};
  let lastState;

  function render(time) {
    const t=Math.max(0,Math.min(12,time)), exp=smooth(t,2.5,4.2), gather=smooth(t,5.3,7.2), normalize=smooth(t,8.3,10.2);
    const sourceLabelAlpha=1-smooth(t,5.2,5.8),probabilityAlpha=smooth(t,10.05,10.3);
    const bounds=[],segments=[];
    ctx.clearRect(0,0,1920,1080);
    const bg=ctx.createRadialGradient(960,480,0,960,480,1100);
    bg.addColorStop(0,'#14253a');bg.addColorStop(1,'#070d18');ctx.fillStyle=bg;ctx.fillRect(0,0,1920,1080);
    const text=(id,value,x,y,size,color='#e8eef8',opacity=1,align='center')=>{
      if(opacity<0.001)return;
      ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.font=`${size}px "DejaVu Sans", Arial, sans-serif`;ctx.textAlign=align;ctx.textBaseline='alphabetic';
      const m=ctx.measureText(value), bx=align==='center'?x-m.width/2:align==='right'?x-m.width:x;
      bounds.push({id,kind:'text',x:bx,y:y-m.actualBoundingBoxAscent,width:m.width,
        height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent,opacity});
      ctx.fillText(value,x,y);ctx.restore();
    };
    const shape=(id,r,color,opacity=1)=>{
      ctx.save();ctx.globalAlpha=opacity;ctx.shadowColor=color;ctx.shadowBlur=20;
      ctx.fillStyle=color;ctx.fillRect(r.x,r.y,r.width,r.height);ctx.restore();
      bounds.push({id,kind:'shape',...r,opacity});
    };
    text('title','SOFTMAX',130,120,24,'#879cb9',1,'left');
    const stage=t<2.5?'logits':t<5.3?'exponential':t<8.3?'shared-total':t<10.2?'normalizing':'normalized';
    const headings={logits:'zᵢ',exponential:'exp(zᵢ)', 'shared-total':'Σ exp(zⱼ)',normalizing:'exp(zᵢ) / Σ exp(zⱼ)',normalized:'pᵢ = exp(zᵢ) / Σ exp(zⱼ)'};
    text('heading',headings[stage],960,215,50);
    ctx.save();ctx.globalAlpha=1-gather;ctx.strokeStyle='#4b6080';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(310,735);ctx.lineTo(1610,735);ctx.stroke();ctx.restore();
    let stackBottom=840,partitionLeft=400;
    for(let i=0;i<3;i++) {
      const signed=logits[i]*140, positive=masses[i]*65, height=lerp(signed,positive,exp);
      const start={x:480+i*480-55,y:Math.min(735,735-height),width:110,height:Math.abs(height)};
      const stack={x:790,y:stackBottom-positive,width:130,height:positive};stackBottom-=positive;
      const final={id:`class-${i}`,x:partitionLeft,y:580,width:probabilities[i]*1120,height:140};partitionLeft+=final.width;
      const r={};for(const k of ['x','y','width','height'])r[k]=lerp(lerp(start[k],stack[k],gather),final[k],normalize);
      shape(`class-${i}`,r,colors[i]);segments.push({...final,color:colors[i]});
      const value=lerp(logits[i],masses[i],exp);
      text(`value-${i}`,value.toFixed(2),480+i*480,945,34,colors[i],sourceLabelAlpha);
      text(`class-label-${i}`,`z${i+1}`,480+i*480,1005,25,'#7c91ae',sourceLabelAlpha);
      text(`probability-${i}`,`${(probabilities[i]*100).toFixed(1)}%`,final.x+final.width/2,535,34,colors[i],probabilityAlpha);
    }
    const totalOpacity=smooth(t,7.0,7.3)*(1-smooth(t,8.2,8.55));
    const top=840-denominator*65;
    ctx.save();ctx.globalAlpha=totalOpacity;ctx.strokeStyle='#b6c6de';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(962,top);ctx.lineTo(980,top);ctx.lineTo(980,840);ctx.lineTo(962,840);ctx.stroke();ctx.restore();
    text('total-symbol','Σ',1130,510,35,'#b6c6de',totalOpacity);
    text('total-value',denominator.toFixed(2),1130,580,64,'#e8eef8',totalOpacity);
    const capacity={x:400,y:580,width:1120,height:140};
    ctx.save();ctx.globalAlpha=smooth(t,9.8,10.2);ctx.strokeStyle='#f0f5ff';ctx.lineWidth=2;ctx.strokeRect(capacity.x,capacity.y,capacity.width,capacity.height);ctx.restore();
    text('division',`÷ (${masses.map(v=>v.toFixed(2)).join(' + ')})`,960,340,32,'#b6c6de',smooth(t,8.25,8.55));
    text('sum-one','Σ pᵢ = 1',960,825,46,'#e8eef8',probabilityAlpha);
    text('footer','ONE SHARED DENOMINATOR',960,1005,22,'#748ba9',smooth(t,6.9,7.3));
    lastState={time:t,stage,mechanism:{logits,masses,denominator,probabilities},
      bounds,geometry:{segments:stage==='normalized'?segments:[],capacity},
      note:'Shape interpolation between valid stages is choreography, not an intermediate softmax computation.'};
    return lastState;
  }
  window.C2M={meta,render,inspect:()=>lastState};
  const seek=document.getElementById('seek'),play=document.getElementById('play'),output=document.getElementById('time');
  let playing=!new URLSearchParams(location.search).has('export'),current=0,lastClock;
  function update(t){current=t;render(t);seek.value=t;output.value=`${t.toFixed(2)} / 12`;}
  play.onclick=()=>{playing=!playing;lastClock=undefined;play.textContent=playing?'Pause':'Play';if(current>=12)current=0;};
  seek.oninput=()=>{playing=false;play.textContent='Play';update(Number(seek.value));};
  function tick(clock){if(playing){if(lastClock!==undefined)current+=(clock-lastClock)/1000;if(current>12)current=0;update(current);}lastClock=clock;requestAnimationFrame(tick);}
  update(0);requestAnimationFrame(tick);
})();
