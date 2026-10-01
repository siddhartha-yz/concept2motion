/* Original signed-vector choreography, evaluated at an explicit frame time. */
(() => {
  const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
  const input=[1,-0.5,0.25],correction=[0.2,0.4,-0.1],output=input.map((v,i)=>v+correction[i]);
  const colors=['#64dcca','#8ba4ff','#ffba82'],unitScale=240;
  const meta={version:1,caseId:'residual',renderer:'canvas2d',width:1920,height:1080,duration:12,fps:60};
  const lerp=(a,b,u)=>a+(b-a)*u;
  const smooth=(t,a,b)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*u*(10-15*u+6*u*u);};
  function render(time){
    const t=Math.max(0,Math.min(12,time));
    const split=smooth(t,2.2,3.8),merge=smooth(t,6.2,8.8),resultAlpha=smooth(t,8.8,9.2);
    const branchAlpha=smooth(t,2.8,3.8)*(1-smooth(t,6.0,6.2));
    const correctionAlpha=smooth(t,2.4,2.8),inputAlpha=1-smooth(t,2.0,2.2);
    const stage=t<2.8?'input':t<6.2?'branches':t<9.2?'merging':'output';
    const bounds=[],geometry={unitScale,identity:[],correction:[],output:[]};
    ctx.clearRect(0,0,1920,1080);
    const bg=ctx.createRadialGradient(960,520,0,960,520,1100);
    bg.addColorStop(0,'#14253a');bg.addColorStop(1,'#070d18');ctx.fillStyle=bg;ctx.fillRect(0,0,1920,1080);
    function text(id,value,x,y,size=30,color='#e8eef8',opacity=1,align='center'){
      if(opacity<0.001)return;
      ctx.save();ctx.globalAlpha=opacity;ctx.font=`${size}px "DejaVu Sans", Arial, sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;
      const m=ctx.measureText(value),left=align==='center'?x-m.width/2:align==='right'?x-m.width:x;
      bounds.push({id,kind:'text',x:left,y:y-m.actualBoundingBoxAscent,width:m.width,height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent,opacity});
      ctx.fillText(value,x,y);ctx.restore();
    }
    function vector(id,x,y,value,color,style,opacity=1){
      const end=x+value*unitScale,direction=Math.sign(value),height=style==='bar'?18:6;
      ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=height;
      if(style==='bar')ctx.fillRect(Math.min(x,end),y-height/2,Math.abs(end-x),height);
      else{
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(end,y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(end,y);ctx.lineTo(end-direction*10,y-8);ctx.lineTo(end-direction*10,y+8);ctx.closePath();ctx.fill();
      }
      ctx.restore();bounds.push({id,kind:'shape',x:Math.min(x,end)-3,y:y-10,width:Math.abs(end-x)+6,height:20,opacity});
      return {id,start:{x,y},end:{x:end,y},color};
    }
    text('title','RESIDUAL CONNECTION',130,120,24,'#879cb9',1,'left');
    text('equation','y = x + F(x)',960,235,50);
    text('input-caption','x',960,355,36,'#e8eef8',inputAlpha);
    text('identity-caption','x · unchanged',960,305,30,'#b6c6de',branchAlpha);
    text('correction-caption','F(x) · correction',960,635,30,'#b6c6de',branchAlpha);
    text('merge-caption','ADD CORRESPONDING COMPONENTS',960,365,23,'#b6c6de',smooth(t,6.2,6.6));
    for(let i=0;i<3;i++){
      const zero=lerp(750,850,split),initialY=460+i*100,upperY=350+i*65,finalY=470+i*100;
      const identityY=lerp(lerp(initialY,upperY,split),finalY,merge);
      const identity=vector(`identity-${i}`,zero,identityY,input[i],colors[i],'bar',1-resultAlpha*0.6);
      geometry.identity.push(identity);
      const correctionX=lerp(850,identity.end.x,merge),correctionY=lerp(690+i*65,finalY,merge);
      const change=vector(`correction-${i}`,correctionX,correctionY,correction[i],colors[i],'arrow',correctionAlpha*(1-resultAlpha*0.25));
      if(stage!=='input')geometry.correction.push(change);
      const result=vector(`output-${i}`,850,finalY+32,output[i],colors[i],'arrow',resultAlpha);
      if(stage==='output')geometry.output.push(result);
      // Zero ticks make signed directions visible, including the nearly cancelled second component.
      ctx.save();ctx.strokeStyle='#57708f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(zero,identityY-16);ctx.lineTo(zero,identityY+16);ctx.stroke();ctx.restore();
      text(`input-value-${i}`,input[i].toFixed(2),1360,initialY+10,34,colors[i],inputAlpha);
      text(`identity-value-${i}`,input[i].toFixed(2),1360,upperY+10,30,colors[i],branchAlpha);
      text(`correction-value-${i}`,correction[i].toFixed(2),1360,690+i*65+10,30,colors[i],branchAlpha);
      text(`component-${i}`,`${i+1}`,600,finalY+15,25,colors[i],smooth(t,6.2,6.6));
      text(`result-value-${i}`,`${input[i].toFixed(2)} + (${correction[i].toFixed(2)}) = ${output[i].toFixed(2)}`,1440,finalY+18,28,colors[i],resultAlpha);
    }
    text('legend','SOLID: IDENTITY     ARROW: CORRECTION',960,930,22,'#879cb9',branchAlpha);
    text('result-legend','FAINT: ORIGINAL + CORRECTION     BRIGHT ARROW: SUM',960,930,22,'#879cb9',resultAlpha);
    text('footer','HAND-SELECTED CORRECTION · NO TRAINED WEIGHTS',960,1005,21,'#748ba9');
    return {time:t,stage,bounds,geometry,mechanism:{input,identity:input,correction,output},
      note:'The fixed F(x) values are illustrative. This scene shows residual addition, not a trained network.'};
  }
  window.C2M={meta,render};
  const seek=document.getElementById('seek'),play=document.getElementById('play'),clockOutput=document.getElementById('time');
  let playing=!new URLSearchParams(location.search).has('export'),current=0,lastClock;
  const update=t=>{current=t;render(t);seek.value=t;clockOutput.value=`${t.toFixed(2)} / 12`;};
  play.onclick=()=>{playing=!playing;lastClock=undefined;play.textContent=playing?'Pause':'Play';if(current>=12)current=0;};
  seek.oninput=()=>{playing=false;play.textContent='Play';update(Number(seek.value));};
  function tick(clock){if(playing){if(lastClock!==undefined)current+=(clock-lastClock)/1000;if(current>12)current=0;update(current);}lastClock=clock;requestAnimationFrame(tick);}
  update(0);requestAnimationFrame(tick);
})();
