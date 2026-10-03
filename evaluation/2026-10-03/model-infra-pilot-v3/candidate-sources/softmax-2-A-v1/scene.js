import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.querySelector('#scene');
const logits=[-1,.7,1.3], colors=['#55c8ef','#b891ff','#ffb85c'];
const entries=[
{stage:'logits',start:0,end:3,settledAt:2.2},
{stage:'exponential',start:3,end:6.3,settledAt:5.45},
{stage:'shared-total',start:6.3,end:9.6,settledAt:8.75},
{stage:'normalizing',start:9.6,end:13,end:13,settledAt:12.15},
{stage:'normalized',start:13,end:18,settledAt:14.2}
];
const timeline=createMathTimeline({caseId:'softmax',duration:18,entries});
function draw(t){
 const p=timeline.at(t), s=p.stage;
 const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage:s,inputs:{logits}});
 const op=name=>timeline.opacity(name,t,{fade:.22,persist:name==='normalized'});
 const rev=name=>timeline.reveal(name,t);
 const header=(id,txt,y,stage)=>f.layer(op(stage),()=>f.text(id,txt,427,y,{size:17,color:'#e7edf8',align:'center'}));
 f.text('title','Why one shared denominator?',427,39,{size:22,color:'#f3f6ff',align:'center'});
 f.text('prompt','Three classes • one probability budget',427,64,{size:13,color:'#91a1bb',align:'center'});
 header('caption-logits','Signed scores (logits)',100,'logits');
 header('caption-exp','Each score becomes positive exp mass',100,'exponential');
 header('caption-sum','All three masses feed one sum',100,'shared-total');
 header('caption-div','Divide every mass by that same total',100,'normalizing');
 header('caption-final','One total-one capacity, partitioned three ways',100,'normalized');
 const ys=[158,220,282], xs=[205,205,205], rowLabels=['class A','class B','class C'];
 const massMax=290, scale=massMax/Math.exp(1.3);
 logits.forEach((z,i)=>{
   f.layer(Math.max(op('logits'),op('exponential'),op('shared-total'),op('normalizing'),op('normalized')),()=>{
    const label=f.text('row-'+i,`${rowLabels[i]}   ${z<0?'−':''}${Math.abs(z).toFixed(1)}`,xs[i],ys[i]-7,{size:14,color:colors[i]});
    f.text('score-tag-'+i,'score',label.x+label.width+9,ys[i]-7,{size:11,color:'#8290a7'});
   });
   f.layer(op('exponential'),()=>{
     f.text('exp-label-'+i,`exp(${z.toFixed(1)})`,204,ys[i]-9,{size:12,color:colors[i]});
     f.massBar(i,{x:316,y:ys[i],width:Math.exp(z)*scale,height:20,color:colors[i],reveal:rev('exponential')});
   });
   f.layer(Math.max(op('shared-total'),op('normalizing'),op('normalized')),()=>{
     f.massBar(i,{x:316,y:ys[i],width:Math.exp(z)*scale,height:20,color:colors[i],opacity:Math.max(op('shared-total'),op('normalizing'),op('normalized'))});
   });
 });
 const masses=logits.map(Math.exp), den=masses.reduce((a,b)=>a+b,0);
 const sumAlpha=Math.max(op('shared-total'),op('normalizing'),op('normalized'));
 f.layer(sumAlpha,()=>{
   f.text('sum-equals','shared denominator  Σ exp(score)',427,333,{size:14,color:'#e7edf8',align:'center'});
   f.text('sum-number',`= ${den.toFixed(3)}`,427,354,{size:15,color:'#ffffff',align:'center'});
   f.text('contrib-0','↘',370,311,{size:14,color:colors[0],align:'center'});
   f.text('contrib-1','↓',427,311,{size:14,color:colors[1],align:'center'});
   f.text('contrib-2','↙',484,311,{size:14,color:colors[2],align:'center'});
 });
 f.layer(op('normalizing'),()=>{
   f.text('divide-each','mass ÷ shared sum',427,382,{size:12,color:'#9eabc0',align:'center'});
 });
 f.layer(op('normalized'),()=>{
   f.partition({x:146,y:415,width:562,height:28,opacity:1},masses.map((m,i)=>({probability:m/den,color:colors[i]})));
   let x=146;
   masses.forEach((m,i)=>{const w=562*m/den;f.text('prob-'+i,`${rowLabels[i]}  ${(m/den).toFixed(3)}`,x+w/2,465,{size:12,color:colors[i],align:'center'});x+=w;});
   f.text('capacity-note','P(A)+P(B)+P(C) = 1',427,397,{size:12,color:'#bdc8d9',align:'center'});
 });
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render:draw};
if(!new URLSearchParams(location.search).has('export')){let start=performance.now();function tick(now){draw(Math.min(18,(now-start)/1000));if((now-start)/1000<18)requestAnimationFrame(tick)}requestAnimationFrame(tick)}