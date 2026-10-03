import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.querySelector('#scene');
const logits=[-1,.7,1.3], colors=['#55c8ef','#b891ff','#ffb85c'];
const classes=['class A','class B','class C'];
const masses=logits.map(Math.exp), denominator=masses.reduce((a,b)=>a+b,0);
const entries=[
 {stage:'logits',start:0,end:3,settledAt:2.2},
 {stage:'exponential',start:3,end:6.3,settledAt:5.5},
 {stage:'shared-total',start:6.3,end:9.6,settledAt:8.8},
 {stage:'normalizing',start:9.6,end:13,settledAt:12.2},
 {stage:'normalized',start:13,end:18,settledAt:14.5}
];
const timeline=createMathTimeline({caseId:'softmax',duration:18,entries});
const widthScale=300/Math.exp(1.3), rowY=[174,236,298];
function draw(t){
 const phase=timeline.at(t), stage=phase.stage;
 const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits}});
 const opacity=(name,persist=false)=>timeline.opacity(name,t,{fade:.22,persist});
 const reveal=name=>timeline.reveal(name,t);
 f.text('title','Why do all three outputs share one denominator?',427,38,{size:21,color:'#f3f6ff',align:'center'});
 f.text('question','One class list enters one sum; each probability uses that same total.',427,62,{size:13,color:'#9eabc0',align:'center'});
 const captions={
  logits:'Start with three signed class scores',
  exponential:'Exponentiation turns each score into a positive mass',
  'shared-total':'Every mass contributes to this one shared sum',
  normalizing:'Divide each class mass by that same sum',
  normalized:'The three probabilities partition one total-one capacity'
 };
 Object.entries(captions).forEach(([key,label])=>f.layer(opacity(key,key==='normalized'),()=>f.text('caption-'+key,label,427,101,{size:16,color:'#e7edf8',align:'center'})));
 // Stable class identity is shown beside every row. Keep labels left of all bars.
 logits.forEach((z,i)=>{
  const y=rowY[i], classRect=f.text('class-label-'+i,classes[i],92,y+14,{size:14,color:colors[i]});
  f.text('score-'+i,`${z>0?'+':''}${z.toFixed(1)}`,classRect.x+classRect.width+12,y+14,{size:14,color:'#dce5f4'});
  const active=Math.max(opacity('exponential'),opacity('shared-total'),opacity('normalizing'),opacity('normalized',true));
  if(active>0) f.layer(active,()=>{
   f.text('exp-label-'+i,`exp(${z.toFixed(1)})`,245,y-5,{size:12,color:colors[i]});
   f.massBar(i,{x:344,y,width:masses[i]*widthScale,height:22,color:colors[i],reveal:stage==='exponential'?reveal('exponential'):1});
  });
 });
 const totalAlpha=Math.max(opacity('shared-total'),opacity('normalizing'),opacity('normalized',true));
 f.layer(totalAlpha,()=>{
  // Three distinct guide lines make the shared contribution path explicit.
  f.text('arrow-0','↘',423,329,{size:15,color:colors[0],align:'center'});
  f.text('arrow-1','↓',427,329,{size:15,color:colors[1],align:'center'});
  f.text('arrow-2','↙',431,329,{size:15,color:colors[2],align:'center'});
  f.text('sum-label','ONE shared denominator = exp(−1.0) + exp(0.7) + exp(1.3)',427,354,{size:13,color:'#e7edf8',align:'center'});
  f.text('sum-value',`= ${denominator.toFixed(3)}`,427,376,{size:15,color:'#ffffff',align:'center'});
 });
 f.layer(opacity('normalizing'),()=>{
  f.text('divide-label','For each class: its own mass  ÷  the same shared sum',427,402,{size:13,color:'#b6c2d5',align:'center'});
 });
 f.layer(opacity('normalized',true),()=>{
  f.partition({x:146,y:425,width:562,height:25,opacity:1},masses.map((m,i)=>({probability:m/denominator,color:colors[i]})));
  let x=146;
  masses.forEach((m,i)=>{
   const w=562*m/denominator;
   f.text('prob-'+i,`${classes[i]}  ${(m/denominator).toFixed(3)}`,x+w/2,470,{size:12,color:colors[i],align:'center'});
   x+=w;
  });
  f.text('capacity-total','P(A) + P(B) + P(C) = 1',427,414,{size:12,color:'#bdc8d9',align:'center'});
 });
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render:draw};
if(!new URLSearchParams(location.search).has('export')){
 const start=performance.now();
 function tick(now){const t=Math.min(18,(now-start)/1000);draw(t);if(t<18)requestAnimationFrame(tick)}
 requestAnimationFrame(tick);
}