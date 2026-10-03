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
function draw(t){
 const p=timeline.at(t), f=createMathFrame(canvas,{caseId:'softmax',time:t,stage:p.stage,inputs:{logits}});
 const alpha=s=>timeline.opacity(s,t,{fade:.2,persist:false});
 const txt=(id,s,x,y,o={})=>f.text(id,s,x,y,{size:18,color:'#e9eef8',...o});
 txt('question','Why must all classes share one denominator?',30,38,{size:23,color:'#f5f7ff'});
 txt('cause','One common total makes the three outputs sum to 1.',30,68,{size:16,color:'#aebbd0'});
 const names=['Class A','Class B','Class C'], ys=[150,225,300];
 f.layer(alpha('logits'),()=>{
  txt('input-title','Signed input logits',30,112,{size:17,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   txt('name-'+i,names[i],38,ys[i],{color:colors[i]});
   txt('logit-'+i,(z>0?'+':'')+z.toFixed(1),155,ys[i],{size:20,color:colors[i]});
   txt('sign-'+i,z<0?'negative':'positive',220,ys[i],{size:15,color:'#b9c5d8'});
  });
 });
 f.layer(alpha('exponential'),()=>{
  txt('exp-title','Each signed input becomes a positive exp mass',30,112,{size:17,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=150+i*75,w=90*Math.exp(z);
   txt('exp-'+i,'exp('+z.toFixed(1)+')',38,y,{size:17,color:colors[i]});
   f.massBar(i,{x:165,y:y-17,width:w,height:20,color:colors[i],reveal:timeline.reveal('exponential',t)});
   txt('mass-label-'+i,'positive mass',165+w+8,y,{size:14,color:'#b9c5d8'});
  });
 });
 f.layer(alpha('shared-total'),()=>{
  txt('sum-title','All three masses contribute to one sum',30,112,{size:18,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=157+i*48,w=68*Math.exp(z);
   txt('sum-class-'+i,names[i],38,y,{size:15,color:colors[i]});
   f.massBar(i,{x:135,y:y-15,width:w,height:17,color:colors[i],reveal:timeline.reveal('shared-total',t)});
  });
  txt('sigma','ONE SHARED TOTAL',470,202,{size:21,color:'#f0f3fa'});
  txt('sigma-formula','Σ exp(zⱼ) = exp(−1) + exp(0.7) + exp(1.3)',470,234,{size:16,color:'#d3dceb'});
  txt('join','Each class contributes once.',470,266,{size:15,color:'#aebbd0'});
 });
 f.layer(alpha('normalizing'),()=>{
  txt('divide-title','Divide each mass by that same total',30,112,{size:18,color:'#9aa9c1'});
  logits.forEach((z,i)=>{
   const y=160+i*58;
   txt('div-class-'+i,names[i],38,y,{size:17,color:colors[i]});
   txt('divide-'+i,'exp('+z.toFixed(1)+')',155,y,{size:17,color:colors[i]});
   txt('slash-'+i,'÷',276,y,{size:18,color:'#eff2f8'});
   txt('denom-'+i,'same Σ exp(zⱼ)',310,y,{size:17,color:'#eff2f8'});
  });
 });
 f.layer(alpha('normalized'),()=>{
  txt('part-title','The outputs partition one total-one capacity',30,112,{size:18,color:'#9aa9c1'});
  f.partition({x:42,y:170,width:770,height:54,opacity:1},f.values.probabilities.map((probability,i)=>({probability,color:colors[i]})));
  txt('cap-zero','0',42,248,{size:14,color:'#aebbd0'});
  txt('cap-one','1',804,248,{size:14,color:'#aebbd0',align:'right'});
  f.values.probabilities.forEach((q,i)=>{
   const y=286+i*40;
   txt('final-name-'+i,names[i],48,y,{size:17,color:colors[i]});
   txt('final-prob-'+i,q.toFixed(3),170,y,{size:19,color:colors[i]});
   txt('final-eq-'+i,'exp('+logits[i].toFixed(1)+') / same sum',260,y,{size:16,color:'#d3dceb'});
  });
  txt('total-one','All three = 1',665,286,{size:16,color:'#f5f7ff'});
 });
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render:draw};
if(!new URLSearchParams(location.search).has('export')){let start=performance.now();function tick(now){draw(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}