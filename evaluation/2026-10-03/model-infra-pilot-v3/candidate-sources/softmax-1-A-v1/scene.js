import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.getElementById('scene');
const logits=[-1,.7,1.3], colors=['#58c9ef','#b795ff','#ffb85c'];
const entries=[
 {start:0,end:3,stage:'logits',settledAt:2.1},
 {start:3,end:7,stage:'exponential',settledAt:6.1},
 {start:7,end:10,stage:'shared-total',settledAt:9.1},
 {start:10,end:13,stage:'normalizing',settledAt:12.1},
 {start:13,end:18,stage:'normalized',settledAt:14.2}
];
const timeline=createMathTimeline({caseId:'softmax',duration:18,entries});
function label(f,id,s,x,y,o={}){return f.text(id,s,x,y,{size:19,color:'#e9eef8',...o});}
function draw(t){
 const p=timeline.at(t), f=createMathFrame(canvas,{caseId:'softmax',time:t,stage:p.stage,inputs:{logits}});
 const alpha=s=>timeline.opacity(s,t,{fade:.2,persist:false});
 f.ctx.fillStyle='#0b1020'; f.ctx.fillRect(0,0,854,480);
 f.text('question','Why one shared denominator?',34,42,{size:24,color:'#f5f7ff'});
 f.text('cause','One total is shared by all three classes.',34,72,{size:16,color:'#aebbd0'});
 const names=['Class A','Class B','Class C'], ys=[145,220,295];
 f.layer(alpha('logits'),()=>{
  label(f,'input-title','Signed input logits',34,112,{size:17,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   f.text('name-'+i,names[i],42,ys[i],{size:18,color:colors[i]});
   f.text('logit-'+i,(z>0?'+':'')+z.toFixed(1),170,ys[i],{size:20,color:colors[i]});
   f.text('sign-'+i,z<0?'negative':'positive',235,ys[i],{size:15,color:'#b9c5d8'});
  });
 });
 f.layer(alpha('exponential'),()=>{
  f.text('exp-title','Each signed value becomes positive exp mass',34,112,{size:17,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=145+i*75, w=90*Math.exp(z);
   f.text('exp-'+i,'exp('+z.toFixed(1)+')',42,y,{size:17,color:colors[i]});
   f.massBar(i,{x:195,y:y-17,width:w,height:20,color:colors[i],reveal:timeline.reveal('exponential',t)});
   f.text('mass-'+i,'positive mass',200+w+10,y,{size:14,color:'#b9c5d8'});
  });
 });
 f.layer(alpha('shared-total'),()=>{
  f.text('sum-title','All three masses join once',34,112,{size:18,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=153+i*48,w=68*Math.exp(z);
   f.text('sum-class-'+i,names[i],42,y,{size:15,color:colors[i]});
   f.massBar(i,{x:142,y:y-15,width:w,height:17,color:colors[i],reveal:timeline.reveal('shared-total',t)});
  });
  f.text('sigma','one shared sum  Σ exp(zᵢ)',485,222,{size:22,color:'#f0f3fa'});
  f.text('join','three contributions → one denominator',485,252,{size:16,color:'#aebbd0'});
 });
 f.layer(alpha('normalizing'),()=>{
  f.text('divide-title','Divide every mass by that same sum',34,112,{size:18,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=160+i*58;
   f.text('div-class-'+i,names[i],42,y,{size:17,color:colors[i]});
   f.text('divide-'+i,'exp('+z.toFixed(1)+')',165,y,{size:17,color:colors[i]});
   f.text('slash-'+i,'÷  Σ exp(zⱼ)',300,y,{size:18,color:'#eff2f8'});
   f.text('same-'+i,'same total',455,y,{size:14,color:'#aebbd0'});
  });
 });
 f.layer(alpha('normalized'),()=>{
  f.text('part-title','Three probabilities partition one total-one capacity',34,112,{size:18,color:'#9aa9c1'});
  f.partition({x:42,y:183,width:770,height:54,opacity:1},f.values.probabilities.map((probability,i)=>({probability,color:colors[i]})));
  f.values.probabilities.forEach((q,i)=>{
   const y=278+i*42;
   f.text('final-name-'+i,names[i],48,y,{size:17,color:colors[i]});
   f.text('final-prob-'+i,q.toFixed(3),170,y,{size:19,color:colors[i]});
   f.text('final-eq-'+i,'exp('+logits[i].toFixed(1)+') / same sum',265,y,{size:16,color:'#d3dceb'});
  });
  f.text('total-one','capacity = 1',672,266,{size:17,color:'#f5f7ff'});
 });
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render:draw};
if(!new URLSearchParams(location.search).has('export')){let start=performance.now();function tick(now){draw(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}