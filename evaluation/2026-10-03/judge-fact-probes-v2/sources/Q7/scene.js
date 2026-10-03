import {createMathFrame} from './math-frame.mjs';
import {createMathTimeline} from './math-timeline.mjs';
const cfg={"caseId": "residual", "inputs": {"x": [0.7, -0.4, 0.2], "residual": [-0.2, 0.15, -0.3]}},canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const names=cfg.caseId==='residual'?['input','branches','merging','output']:['logits','exponential','shared-total','normalizing','normalized'];
const duration=18,span=duration/names.length,colors=['#57c7ef','#af87ff','#ffb65b'];
const timeline=createMathTimeline({caseId:cfg.caseId,duration,entries:names.map((stage,i)=>({stage,start:i*span,end:(i+1)*span,settledAt:(i+1)*span-.9}))});
window.C2M={meta:{version:1,caseId:cfg.caseId,width:854,height:480,duration,fps:15,renderer:'canvas2d',stageTimeline:timeline.meta},render(t){
 const stage=timeline.at(t).stage,f=createMathFrame(canvas,{caseId:cfg.caseId,time:t,stage,inputs:cfg.inputs});
 f.text('title',cfg.caseId==='residual'?'直通输入与分量相加':'三项指数质量，共享同一个总量',28,36,{size:22});
 f.text('phase',stage,28,68,{size:14});
 if(cfg.caseId==='residual'){
  const {x,residual:r}=cfg.inputs,scale=cfg.scale??160,sx=350;
  f.text('claim','蓝色保留输入；橙色从蓝色终点开始；紫色表示两者的和',28,100,{size:17});
  for(let i=0;i<3;i++){
   const y=150+i*80;
   f.text(`numbers-${i}`,`x=${x[i]}，修正=${r[i]}，和=${(x[i]+r[i]).toFixed(2)}`,28,y-15,{size:16});
   if(!cfg.hide){
    const a=f.vector('identity',i,{start:{x:sx,y},value:x[i],unitScale:scale,color:colors[0],reveal:timeline.reveal('input',t)});
    if(stage!=='input')f.vector('correction',i,{start:{x:a.targetEnd.x+(cfg.joinOffset??0),y},value:r[i],unitScale:scale,color:colors[2],reveal:timeline.reveal('branches',t)});
    if(stage==='output')f.vector('output',i,{start:{x:sx,y:y+30},value:x[i]+r[i]+(cfg.outputOffset??0),unitScale:scale,color:colors[1],reveal:cfg.outputReveal??timeline.reveal('output',t)});
   }
  }
  f.text('scale-label',`${scale} 像素代表 1 个单位；正值向右，负值向左`,28,410,{size:16});
  if(!cfg.hide){ctx.fillStyle='#b8c3d5';ctx.fillRect(350,433,scale,3);ctx.fillRect(350,427,2,14);ctx.fillRect(350+scale-2,427,2,14);}
 }else{
  const z=cfg.inputs.logits,m=z.map(Math.exp),d=m.reduce((a,b)=>a+b,0),p=m.map(v=>v/d);
  f.text('claim','指数条长度与标出的指数质量成比例；三项最终组成总量 1',28,100,{size:17});
  if(stage==='logits')z.forEach((value,i)=>f.text(`logit-${i}`,`类别 ${i+1}，输入 ${value}`,28,155+i*70,{size:17,color:colors[i]}));
  if(stage==='exponential')m.forEach((value,i)=>{
   f.text(`mass-${i}`,`exp(${z[i]}) = ${value.toFixed(3)}`,28,155+i*70,{size:17,color:colors[i]});
   if(!cfg.hide)f.massBar(i,{x:270,y:137+i*70,width:(cfg.massScale??65)*value+(cfg.massOffset??0),height:22,color:colors[i],reveal:timeline.reveal('exponential',t)});
  });
  if(stage==='shared-total')f.text('total',`三项共同总量 = ${d.toFixed(3)}`,28,190,{size:22});
  if(stage==='normalizing')m.forEach((value,i)=>f.text(`division-${i}`,`${value.toFixed(3)} ÷ ${d.toFixed(3)} = ${p[i].toFixed(3)}`,28,155+i*70,{size:18,color:colors[i]}));
  if(stage==='normalized'){
   p.forEach((value,i)=>f.text(`probability-${i}`,`类别 ${i+1}：${value.toFixed(3)}`,28,155+i*50,{size:17,color:colors[i]}));
   if(!cfg.hide)f.partition({x:270,y:310,width:500,height:30},p.map((probability,i)=>({probability,color:colors[i]})));
   f.text('capacity','三项概率填满同一总量 1',270,380,{size:20});
  }
 }
 const result=f.finish();
 if(cfg.caseId==='residual'&&!cfg.hide)result.bounds.push({id:'unit-scale',kind:'shape',x:350,y:427,width:(cfg.scale??160),height:14,opacity:1});
 return result;
}};