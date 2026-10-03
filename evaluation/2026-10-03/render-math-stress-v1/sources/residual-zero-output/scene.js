import {createMathFrame} from './math-frame.mjs';
import {createMathTimeline} from './math-timeline.mjs';
const cfg={"id": "residual-zero-output", "caseId": "residual", "inputs": {"x": [0.2, -0.4, 0.1], "residual": [-0.2, 0.4, -0.1]}},canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const names=cfg.caseId==='residual'?['input','branches','merging','output']:['logits','exponential','shared-total','normalizing','normalized'];
const duration=18,span=duration/names.length;
const timeline=createMathTimeline({caseId:cfg.caseId,duration,entries:names.map((stage,i)=>({stage,start:i*span,end:(i+1)*span,settledAt:(i+1)*span-.9}))});
const colors=['#57c7ef','#af87ff','#ffb65b'];
window.C2M={meta:{version:1,caseId:cfg.caseId,renderer:'canvas2d',width:854,height:480,duration,fps:15,
 ...(cfg.id==='residual-no-timeline'?{}:{stageTimeline:timeline.meta})},render(t){
 const phase=timeline.at(t),stage=phase.stage,f=createMathFrame(canvas,{caseId:cfg.caseId,time:t,stage,inputs:cfg.inputs});
 f.text('title','Controlled explicit-progress fixture',28,35,{size:22});
 f.text('case',cfg.id,28,63,{size:15});
 f.text('stage',stage,28,90,{size:15});
 if(cfg.caseId==='residual'){
  const {x,residual:r}=cfg.inputs;
  for(let i=0;i<3;i++){
   const y=150+i*90;
   f.text(`input-label-${i}`,`x=${x[i]}, correction=${r[i]}`,28,y-15,{size:15});
   const a=f.vector('identity',i,{start:{x:320,y},value:x[i],unitScale:110,color:colors[0],reveal:timeline.reveal('input',t)});
   if(stage!=='input')f.vector('correction',i,{start:{x:a.end.x+(cfg.id==='residual-wrong-merge'?30:0),y},
    value:cfg.id==='residual-wrong-target'?r[i]*2:r[i],unitScale:110,color:colors[2],reveal:timeline.reveal('branches',t)});
   if(stage==='output'){
    f.vector('output',i,{start:{x:320,y:y+30},value:x[i]+r[i],unitScale:110,color:colors[1],
     opacity:cfg.id==='residual-invisible-output'?0:1,reveal:cfg.id==='residual-never-finished'?.4:timeline.reveal('output',t)});
    f.text(`output-label-${i}`,`result=${(x[i]+r[i]).toFixed(2)}`,520,y+35,{size:15});
   }
  }
 }else{
  const z=cfg.inputs.logits,m=z.map(Math.exp),d=m.reduce((a,b)=>a+b,0),p=m.map(v=>v/d);
  if(stage==='logits')z.forEach((value,i)=>f.text(`logit-${i}`,`class ${i}: logit ${value}`,28,155+i*70,{size:17,color:colors[i]}));
  if(stage==='exponential')z.forEach((value,i)=>{
   const amount=cfg.id==='softmax-never-finished'?.4:Math.max(0,Math.min(1,3*timeline.reveal('exponential',t)-i));
   f.text(`mass-label-${i}`,`exp(${value})=${m[i].toFixed(3)}`,28,145+i*70,{size:16,color:colors[i]});
   f.massBar(i,{x:220,y:132+i*70,width:220*Math.exp(value-Math.max(...z))+(cfg.id==='softmax-affine-target'?34:0),height:18,color:colors[i],reveal:amount});
  });
  if(stage==='shared-total')f.text('shared-total',`All three masses share total ${d.toFixed(3)}`,28,170,{size:20});
  if(stage==='normalizing')p.forEach((value,i)=>f.text(`division-${i}`,`${m[i].toFixed(3)} / ${d.toFixed(3)} = ${value.toFixed(3)}`,28,155+i*70,{size:17,color:colors[i]}));
  if(stage==='normalized'){
   f.partition({x:140,y:255,width:550,height:25,opacity:cfg.id==='softmax-hidden-partition'?0:1},p.map((probability,i)=>({probability,color:colors[i]})));
   f.text('sum','The three probabilities fill one total-one capacity',28,335,{size:19});
   if(cfg.id==='softmax-overpaint'){ctx.fillStyle='#ff00ff';ctx.fillRect(140+550*p[0]/2-3,264,6,6);}
  }
  if(cfg.id==='softmax-opacity-groups'||cfg.id==='softmax-phase-overlap'){
   f.layer(timeline.opacity('exponential',t,{persist:cfg.id==='softmax-phase-overlap'}),()=>f.text('earlier-caption','Earlier phase caption',470,425,{size:17}));
   f.layer(timeline.opacity('normalized',t),()=>f.text('later-caption','Final phase caption',470,425,{size:17}));
  }
 }
 const state=f.finish();
 if(cfg.id==='residual-forged-geometry'&&state.geometry.correction.length)state.geometry.correction[0].end.x+=3;
 if(cfg.id==='softmax-forged-width'&&state.geometry.massBars.length)state.geometry.massBars[0].width+=3;
 return state;
}};
