(() => {
'use strict';
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', {alpha:false});
const W=1920, H=1080, D=12;
const logits=[-1,0.6,1.8];
const masses=logits.map(Math.exp);
const denominator=masses.reduce((a,b)=>a+b,0);
const probabilities=masses.map(v=>v/denominator);
const colors=['#42C8F5','#F5B34C','#BD91FF'];
const names=['Class A','Class B','Class C'];
const stages=['logits','exponential','shared-total','normalizing','normalized'];
const headings=[
 'Signed scores, with a common origin',
 'Exponentiation makes every mass positive',
 'All three masses form one shared total',
 'Divide every mass by that same total',
 'Three probabilities occupy one fixed capacity'
];
const rowY=[386,516,646];
const left=520, rawWidth=1140, capacityWidth=840;
const rawWidths=probabilities.map(p=>p*rawWidth);
const rawPrefix=[0,rawWidths[0],rawWidths[0]+rawWidths[1]];
let bounds=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
const mix=(a,b,u)=>a+(b-a)*u;

function record(id,primitive,x,y,width,height,opacity){
 bounds.push({id,kind:'shape',primitive,x,y,width,height,opacity});
}
function rect(id,x,y,width,height,color,opacity=1){
 if(width<=0 || height<=0 || opacity<=0) return;
 ctx.globalAlpha=opacity;
 ctx.fillStyle=color;
 ctx.fillRect(x,y,width,height);
 record(id,'rect',x,y,width,height,opacity);
 ctx.globalAlpha=1;
}
function circle(id,x,y,r,color,opacity=1){
 if(opacity<=0) return;
 ctx.globalAlpha=opacity;
 ctx.fillStyle=color;
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 record(id,'circle',x-r,y-r,r*2,r*2,opacity);
 ctx.globalAlpha=1;
}
function line(id,x1,y1,x2,y2,color,width=2,opacity=1){
 if(opacity<=0) return;
 ctx.globalAlpha=opacity;
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='butt';
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
 const pad=width/2;
 record(id,'line',Math.min(x1,x2)-pad,Math.min(y1,y2)-pad,
        Math.abs(x2-x1)+width,Math.abs(y2-y1)+width,opacity);
 ctx.globalAlpha=1;
}
function text(id,value,x,y,size=30,color='#E8EDF4',opacity=1,center=false){
 if(opacity<=0) return;
 ctx.font=`${size}px Arial, sans-serif`;
 ctx.textAlign='left';ctx.textBaseline='alphabetic';
 const m=ctx.measureText(value);
 if(center) x-=m.width/2;
 ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.fillText(value,x,y);
 bounds.push({id,kind:'text',text:value,
  x:x-m.actualBoundingBoxLeft,
  y:y-m.actualBoundingBoxAscent,
  width:m.actualBoundingBoxLeft+m.actualBoundingBoxRight,
  height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent,
  opacity});
 ctx.globalAlpha=1;
}
function bracket(x,y,width,opacity){
 line('total-bracket',x,y,x+width,y,'#8B99AC',2,opacity);
 line('total-left-tick',x,y-7,x,y+7,'#8B99AC',2,opacity);
 line('total-right-tick',x+width,y-7,x+width,y+7,'#8B99AC',2,opacity);
}
function capacityOutline(x,y,width,height){
 // The four strokes lie outside the solid probability interiors.
 line('capacity-top',x-1,y-2,x+width+1,y-2,'#E8EDF4',2);
 line('capacity-bottom',x-1,y+height+2,x+width+1,y+height+2,'#E8EDF4',2);
 line('capacity-left',x-2,y-2,x-2,y+height+2,'#E8EDF4',2);
 line('capacity-right',x+width+2,y-2,x+width+2,y+height+2,'#E8EDF4',2);
}

function render(timeInSeconds){
 const t=clamp(Number.isFinite(timeInSeconds)?timeInSeconds:0,0,D);
 const index=Math.min(4,Math.floor(t/2.4));
 const stage=stages[index];
 const u=ease((t-index*2.4)/2.4);
 bounds=[];
 ctx.setTransform(1,0,0,1,0,0);
 ctx.globalAlpha=1;
 ctx.globalCompositeOperation='source-over';
 // An opaque canvas clears to its black background; no background shape
 // is drawn over, or included among, the foreground components.
 ctx.clearRect(0,0,W,H);

 text('title','Shared denominator',140,104,52);
 text('stage-heading',headings[index],140,177,30,'#A8B6C9');
 text('stage-number',`${String(index+1).padStart(2,'0')} / 05`,1660,101,25,'#8B99AC');

 const legendX=[270,785,1300];
 for(let i=0;i<3;i++){
  circle(`legend-dot-${i}`,legendX[i],263,8,colors[i]);
  text(`class-name-${i}`,names[i],legendX[i]+26,274,30,colors[i]);
  let value;
  if(index===0) value=`z = ${logits[i].toFixed(2)}`;
  else if(index===1 || index===2) value=`exp(z) = ${masses[i].toFixed(3)}`;
  else if(index===3) value=`${masses[i].toFixed(3)} / ${denominator.toFixed(3)}`;
  else value=`p = ${probabilities[i].toFixed(4)}`;
  text(`class-value-${i}`,value,legendX[i]+26,320,26,'#D4DEEC');
 }

 let geometry={};
 if(index===0 || index===1){
  const origin=index===0?740:mix(740,left,u);
  const originOpacity=index===0?1:1-u;
  line('signed-origin',origin,363,origin,719,'#64748B',2,originOpacity);
  if(index===0){
   text('origin-label','0',origin,759,25,'#A8B6C9',1,true);
  }else{
   text('origin-label','0',origin,759,25,'#A8B6C9',originOpacity,true);
  }
  for(let i=0;i<3;i++){
   const displacement=index===0
    ?logits[i]*190*mix(0.35,1,u)
    :mix(logits[i]*190,rawWidths[i],u);
   rect(`class-${i}`,Math.min(origin,origin+displacement),rowY[i],
        Math.abs(displacement),46,colors[i]);
  }
 }else if(index===2){
  for(let i=0;i<3;i++){
   rect(`class-${i}`,left+rawPrefix[i]*u,mix(rowY[i],790,u),
        rawWidths[i],mix(46,70,u),colors[i]);
  }
  bracket(left,894,rawWidth,u);
 }else{
  const width=index===3?mix(rawWidth,capacityWidth,u):capacityWidth;
  const y=index===3?mix(790,650,u):650;
  const segments=[];
  let x=left;
  for(let i=0;i<3;i++){
   // The last edge is computed from the fixed right boundary.
   const sw=i===2?left+width-x:width*probabilities[i];
   rect(`class-${i}`,x,y,sw,70,colors[i]);
   segments.push({id:`class-${i}`,x,y,width:sw,height:70,color:colors[i]});
   x+=sw;
  }
  bracket(left,y+104,width,1);
  if(index===4){
   capacityOutline(left,y,width,70);
   geometry={capacity:{x:left,y,width,height:70},segments};
   text('capacity-value','Total capacity = 1',left+width/2,827,36,'#E8EDF4',1,true);
  }
 }

 const captions=[
  'A negative score extends to the left of zero.',
  'exp(z) > 0 for every class',
  `${masses.map(v=>v.toFixed(3)).join(' + ')} = ${denominator.toFixed(3)}`,
  `Every mass shares the denominator ${denominator.toFixed(3)}`,
  `${probabilities.map(v=>v.toFixed(4)).join(' + ')} = 1`
 ];
 text('mechanism-caption',captions[index],960,958,30,'#B6C3D6',1,true);
 // A deterministic time ruler continues through the final held partition.
 rect('time-track',140,1028,1640,3,'#263140');
 rect('time-progress',140,1028,1640*t/D,3,'#8B99AC');

 return {
  time:t,
  stage,
  mechanism:{logits:[...logits],masses:[...masses],denominator,
             probabilities:[...probabilities]},
  geometry,
  bounds
 };
}

window.C2M={
 meta:{version:1,caseId:'softmax',renderer:'canvas2d',
       width:1920,height:1080,duration:12,fps:60},
 render
};
render(0);
if(new URLSearchParams(window.location.search).get('export')!=='1'){
 let start=null,lastFrame=0;
 function playback(timestamp){
  if(start===null) start=timestamp;
  const frame=Math.min(720,Math.floor((timestamp-start)*60/1000));
  if(frame!==lastFrame){render(frame/60);lastFrame=frame;}
  if(frame<720) requestAnimationFrame(playback);
 }
 requestAnimationFrame(playback);
}
})();