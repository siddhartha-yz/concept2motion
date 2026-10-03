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
function text(f,id,s,x,y,o={}){return f.text(id,s,x,y,{size:18,color:'#e9eef8',...o});}
function draw(t){
 const p=timeline.at(t);
 const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage:p.stage,inputs:{logits}});
 const alpha=s=>timeline.opacity(s,t,{fade:.2,persist:false});
 const reveal=s=>timeline.reveal(s,t);
 const names=['Class A','Class B','Class C'], ys=[154,228,302];
 // The adapter clears the canvas on every call; use only its semantic draw API.
 text(f,'question','Why one shared denominator?',32,43,{size:25,color:'#f5f7ff'});
 text(f,'cause','All three masses contribute to one total, used by every class.',32,75,{size:16,color:'#aebbd0'});
 f.layer(alpha('logits'),()=>{
  text(f,'input-title','Signed input logits',32,119,{size:17,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   text(f,'name-'+i,names[i],42,ys[i],{size:18,color:colors[i]});
   text(f,'logit-'+i,(z>0?'+':'')+z.toFixed(1),188,ys[i],{size:20,color:colors[i]});
   text(f,'sign-'+i,z<0?'negative':'positive',253,ys[i],{size:15,color:'#b9c5d8'});
  });
 });
 f.layer(alpha('exponential'),()=>{
  text(f,'exp-title','Each signed input becomes a positive exp mass',32,119,{size:17,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=ys[i], w=60*Math.exp(z);
   text(f,'exp-'+i,'exp('+z.toFixed(1)+')',42,y,{size:17,color:colors[i]});
   const r=f.massBar(i,{x:180,y:y-20,width:w,height:21,color:colors[i],reveal:reveal('exponential')});
   text(f,'mass-label-'+i,'positive mass',r.x+r.width+10,y,{size:14,color:'#b9c5d8'});
  });
 });
 f.layer(alpha('shared-total'),()=>{
  text(f,'sum-title','All three masses join once',32,119,{size:18,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=151+i*49,w=42*Math.exp(z);
   text(f,'sum-class-'+i,names[i],42,y,{size:15,color:colors[i]});
   f.massBar(i,{x:150,y:y-16,width:w,height:18,color:colors[i],reveal:reveal('shared-total')});
  });
  text(f,'sigma','Σ exp(zᵢ) = one shared total',470,204,{size:21,color:'#f0f3fa'});
  text(f,'join','Every class contributes to this same sum.',470,239,{size:16,color:'#aebbd0'});
 });
 f.layer(alpha('normalizing'),()=>{
  text(f,'divide-title','Divide each mass by that same total',32,119,{size:18,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=166+i*58;
   text(f,'div-class-'+i,names[i],42,y,{size:17,color:colors[i]});
   text(f,'divide-'+i,'exp('+z.toFixed(1)+')',165,y,{size:17,color:colors[i]});
   text(f,'slash-'+i,'÷  Σ exp(zⱼ)',300,y,{size:18,color:'#eff2f8'});
   text(f,'same-'+i,'same total',460,y,{size:14,color:'#aebbd0'});
  });
 });
 f.layer(alpha('normalized'),()=>{
  text(f,'part-title','Three probabilities fill one total-one capacity',32,119,{size:18,color:'#9aa9c1'});
  f.partition({x:42,y:178,width:770,height:52,opacity:1},f.values.probabilities.map((probability,i)=>({probability,color:colors[i]})));
  f.values.probabilities.forEach((q,i)=>{
   const y=276+i*41;
   text(f,'final-name-'+i,names[i],48,y,{size:17,color:colors[i]});
   text(f,'final-prob-'+i,q.toFixed(3),170,y,{size:19,color:colors[i]});
   text(f,'final-eq-'+i,'exp('+logits[i].toFixed(1)+') / same sum',265,y,{size:16,color:'#d3dceb'});
  });
  text(f,'total-one','total capacity = 1',650,257,{size:16,color:'#f5f7ff'});
 });
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render:draw};
if(!new URLSearchParams(location.search).has('export')){const start=performance.now();function tick(now){draw(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}