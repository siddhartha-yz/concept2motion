import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.querySelector('#scene');
const logits=[-1,.7,1.3], colors=['#55c8ef','#b891ff','#ffb85c'];
const names=['class A','class B','class C'];
const entries=[
 {stage:'logits',start:0,end:3,settledAt:2.2},
 {stage:'exponential',start:3,end:6.3,settledAt:5.45},
 {stage:'shared-total',start:6.3,end:9.6,settledAt:8.75},
 {stage:'normalizing',start:9.6,end:13,settledAt:12.15},
 {stage:'normalized',start:13,end:18,settledAt:14.2}
];
const timeline=createMathTimeline({caseId:'softmax',duration:18,entries});
function draw(t){
 const stage=timeline.at(t).stage;
 const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits}});
 const phase=n=>timeline.opacity(n,t,{fade:.22,persist:n==='normalized'});
 const reveal=n=>timeline.reveal(n,t);
 const maxPrior=Math.max(...entries.slice(0,entries.findIndex(e=>e.stage===stage)+1).map(e=>phase(e.stage)));
 f.text('title','Why do all three outputs share one denominator?',427,38,{size:20,color:'#f3f6ff',align:'center'});
 f.text('prompt','Three class scores must share one probability budget',427,62,{size:12,color:'#91a1bb',align:'center'});
 const captions={logits:'Signed scores identify three classes',exponential:'Each signed score becomes a positive exp mass','shared-total':'All three masses feed one shared sum',normalizing:'Divide each mass by that same shared sum',normalized:'The three probabilities partition one total-one capacity'};
 for(const e of entries) f.layer(phase(e.stage),()=>f.text('caption-'+e.stage,captions[e.stage],427,99,{size:15,color:'#e7edf8',align:'center'}));
 const ys=[158,220,282], baseX=278, barScale=230/Math.exp(1.3);
 const masses=logits.map(Math.exp), denominator=masses.reduce((a,b)=>a+b,0);
 logits.forEach((z,i)=>{
   const prior=Math.max(phase('logits'),phase('exponential'),phase('shared-total'),phase('normalizing'),phase('normalized'));
   f.layer(prior,()=>{
     f.text('identity-'+i,`${names[i]}   score ${z>0?'+':''}${z.toFixed(1)}`,105,ys[i]+5,{size:14,color:colors[i]});
   });
   const massOpacity=Math.max(phase('shared-total'),phase('normalizing'),phase('normalized'));
   if(phase('exponential')>massOpacity){
     f.layer(phase('exponential'),()=>{
       const label=f.text('exp-label-'+i,`exp(${z.toFixed(1)})`,baseX,ys[i]-8,{size:12,color:colors[i]});
       f.massBar(i,{x:baseX,y:ys[i],width:masses[i]*barScale,height:20,color:colors[i],reveal:reveal('exponential')});
     });
   } else {
     f.layer(massOpacity,()=>f.massBar(i,{x:baseX,y:ys[i],width:masses[i]*barScale,height:20,color:colors[i]}));
   }
 });
 const sumOpacity=Math.max(phase('shared-total'),phase('normalizing'),phase('normalized'));
 f.layer(sumOpacity,()=>{
   f.text('contribute-0','↘',365,316,{size:15,color:colors[0],align:'center'});
   f.text('contribute-1','↓',427,316,{size:15,color:colors[1],align:'center'});
   f.text('contribute-2','↙',489,316,{size:15,color:colors[2],align:'center'});
   f.text('sum-label','ONE shared denominator = sum of all three exp masses',427,344,{size:13,color:'#e7edf8',align:'center'});
   f.text('sum-value',`Σ = ${denominator.toFixed(3)}`,427,365,{size:15,color:'#ffffff',align:'center'});
 });
 f.layer(phase('normalizing'),()=>f.text('same-denominator','Each class: its own mass ÷ this same sum',427,393,{size:12,color:'#aab7ca',align:'center'}));
 f.layer(phase('normalized'),()=>{
   f.partition({x:146,y:418,width:562,height:26,opacity:1},masses.map((m,i)=>({probability:m/denominator,color:colors[i]})));
   f.text('capacity-note','ONE capacity  •  probabilities add to 1',427,399,{size:12,color:'#bdc8d9',align:'center'});
   let x=146;
   masses.forEach((m,i)=>{const w=562*m/denominator;f.text('probability-'+i,`${names[i]}  ${(m/denominator).toFixed(3)}`,x+w/2,466,{size:11,color:colors[i],align:'center'});x+=w;});
 });
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render:draw};
if(!new URLSearchParams(location.search).has('export')){const start=performance.now();function tick(now){const t=Math.min(18,(now-start)/1000);draw(t);if(t<18)requestAnimationFrame(tick)}requestAnimationFrame(tick)}