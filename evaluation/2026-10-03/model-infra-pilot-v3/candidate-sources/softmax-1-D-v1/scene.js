import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.getElementById('scene');
const colors=['#57c7ef','#af87ff','#ffb65b'];
const names=['A','B','C'];
const timeline=createMathTimeline({caseId:'softmax',duration:18,entries:[
 {stage:'logits',start:0,end:3,settledAt:0.7},
 {stage:'exponential',start:3,end:6.5,settledAt:4.5},
 {stage:'shared-total',start:6.5,end:10,settledAt:7.8},
 {stage:'normalizing',start:10,end:14,settledAt:11.5},
 {stage:'normalized',start:14,end:18,settledAt:14.8}
]});
const captions={logits:'三个分数，为什么要共用一个分母？',exponential:'先取指数：负分数也变成正的质量。','shared-total':'把三份质量合起来，只求一次总量 S。',normalizing:'每份都除以同一个 S：一起缩放到总量 1。',normalized:'共同分母，让三个输出成为同一整体的份额。'};
function render(time){
 const t=Math.max(0,Math.min(18,Number.isFinite(time)?time:0));
 const phase=timeline.at(t),stage=phase.stage;
 const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits:[-1,0.7,1.3]}});
 const v=f.values;
 f.text('title','Softmax · 为什么共用分母？',40,48,{size:27,color:'#f1f5fb'});
 f.layer(timeline.opacity(stage,t,{fade:0.2,persist:false}),()=>{
  f.text('phase-caption',captions[stage],40,89,{size:21,color:'#d6dfeb'});
 });
 if(stage==='logits'||stage==='exponential'){
  const exponential=stage==='exponential';
  v.logits.forEach((z,i)=>{
   const y=163+i*92;
   const tag=f.text('identity-'+i,names[i],55,y,{size:25,color:colors[i]});
   const label=f.text('input-'+i,(z>0?'+':'')+z.toFixed(1),tag.x+tag.width+25,y,{size:29,color:colors[i]});
   if(exponential){
    const arrow=f.text('transform-'+i,'→ exp →',label.x+label.width+26,y,{size:21,color:'#aebbd0'});
    const mass=f.text('mass-value-'+i,v.masses[i].toFixed(3),arrow.x+arrow.width+28,y,{size:25,color:colors[i]});
    f.massBar(i,{x:mass.x,y:mass.y+mass.height+12,width:v.masses[i]*85,height:20,color:colors[i],reveal:timeline.reveal('exponential',t)});
   }else{
    f.text('sign-'+i,z<0?'负分数':'正分数',290,y,{size:21,color:'#aebbd0'});
   }
  });
  f.layer(timeline.opacity(stage,t,{fade:0.2,persist:false}),()=>{
   f.text('early-note',exponential?'同一尺度：条越长，指数质量越大。':'A、B、C 是三个类别；分数还不是概率。',55,442,{size:19,color:'#aebbd0'});
  });
 }else{
  const sum=f.text('sum','S = '+v.masses.map(n=>n.toFixed(3)).join(' + ')+' ≈ '+v.denominator.toFixed(3),70,151,{size:23,color:'#f1f5fb'});
  const labelY=sum.y+sum.height+37;
  let x=100;
  const barY=labelY+17;
  v.masses.forEach((m,i)=>{
   const width=m*85;
   f.text('total-class-'+i,names[i],x+width/2,labelY,{size:19,align:'center',color:colors[i]});
   f.massBar(i,{x,y:barY,width,height:29,color:colors[i],reveal:stage==='shared-total'?timeline.reveal('shared-total',t):1});
   x+=width;
  });
  f.text('total-end','总量 S',x+16,barY+23,{size:19,color:'#d6dfeb'});
  if(stage==='shared-total'){
   f.layer(timeline.opacity(stage,t,{fade:0.2,persist:false}),()=>{
    f.text('pool-note','三种颜色，三份贡献，共同组成一个总量。',100,309,{size:22,color:'#d6dfeb'});
    f.text('pool-question','接下来：把这整个总量变成 1。',100,353,{size:22,color:'#aebbd0'});
   });
  }else{
   const capacityLabel=f.text('capacity-label','↓ 每一份 ÷ S                         一个整体 = 1',100,293,{size:22,color:'#f1f5fb'});
   const py=capacityLabel.y+capacityLabel.height+20;
   f.partition({x:100,y:py,width:654,height:38,opacity:1},v.probabilities.map((probability,i)=>({probability,color:colors[i]})));
   v.probabilities.forEach((p,i)=>{
    f.text('probability-'+i,names[i]+'  '+(p*100).toFixed(1)+'%',100+i*230,py+78,{size:24,color:colors[i]});
   });
   f.layer(timeline.opacity(stage,t,{fade:0.2,persist:false}),()=>{
    f.text('closing',stage==='normalized'?'份额相加 = S ÷ S = 1；各用各的分母，就不再是同一整体。':'颜色与比例保留，统一换成“占总量多少”。',40,453,{size:19,color:'#d6dfeb'});
   });
  }
 }
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render};
render(0);
if(new URLSearchParams(location.search).get('export')!=='1'){
 let origin;
 function tick(now){if(origin===undefined)origin=now;const t=Math.min(18,(now-origin)/1000);render(Math.floor(t*15)/15);if(t<18)requestAnimationFrame(tick);}
 requestAnimationFrame(tick);
}