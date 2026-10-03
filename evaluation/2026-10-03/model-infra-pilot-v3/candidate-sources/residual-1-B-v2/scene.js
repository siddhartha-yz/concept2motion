import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.querySelector('#scene');
const inputs={x:[.7,-.4,.2],residual:[-.2,.15,-.3]};
const entries=[
 {stage:'input',start:0,end:3.2,settledAt:2.3},
 {stage:'branches',start:3.2,end:7.5,settledAt:6.6},
 {stage:'merging',start:7.5,end:12.1,settledAt:11.2},
 {stage:'output',start:12.1,end:18,settledAt:17}
];
const timeline=createMathTimeline({caseId:'residual',duration:18,entries});
const colors=['#60d7ff','#bd9cff','#70e0b0'];
const fmt=n=>(n>0?'+':'')+n.toFixed(2);
function render(t){
 t=Math.max(0,Math.min(18,t));
 const phase=timeline.at(t);
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage:phase.stage,inputs});
 const text=(id,s,x,y,size=14,color='#dbe5f6',align='left',opacity=1)=>f.text(id,s,x,y,{size,color,align,opacity,font:'system-ui, sans-serif'});
 text('eyebrow','残差连接  /  分量示意',38,34,12,'#91a2bd');
 text('question','恒等路径上，什么保持不变？',38,70,23,'#f2f6ff');
 text('subtitle','x 原样前行；修正量 F(x) 在合流处逐项相加。',38,96,14,'#aab8cf');
 const scale=170, sx=278, ys=[190,260,330], corrY=ys.map(y=>y+23);
 const inputReveal=timeline.reveal('input',t), branchReveal=timeline.reveal('branches',t);
 const mergeReveal=timeline.reveal('merging',t), outputReveal=timeline.reveal('output',t);
 text('input-head','输入  x',38,135,14,'#60d7ff');
 text('merge-head','合流点',sx,135,13,'#a7b5cc','center');
 text('correction-head','独立修正  F(x)',538,135,14,'#ffbf73');
 const identity=[];
 for(let i=0;i<3;i++){
   const y=ys[i];
   text('input-'+i,`x${i+1} = ${fmt(inputs.x[i])}`,38,y+5,13,colors[i]);
   identity.push(f.vector('identity',i,{start:{x:sx,y},value:f.values.input[i],unitScale:scale,color:colors[i],strokeWidth:4,reveal:inputReveal}));
   text('correction-'+i,`F${i+1} = ${fmt(inputs.residual[i])}`,538,corrY[i]+5,13,'#ffbf73');
 }
 // Corrections visibly attach to the corresponding identity endpoints.
 for(let i=0;i<3;i++){
   const y=corrY[i],end=identity[i].targetEnd;
   f.vector('correction',i,{start:{x:end.x,y},value:f.values.correction[i],unitScale:scale,color:'#ffb65b',strokeWidth:3,opacity:.98,reveal:branchReveal});
 }
 // Output uses a separate lane so each signed sum remains legible.
 const resultY=[425,445,465];
 text('output-head','输出  y = x + F(x)',38,405,15,'#f2f6ff', 'left',Math.max(mergeReveal,outputReveal));
 for(let i=0;i<3;i++){
   const value=f.values.output[i];
   text('sum-'+i,`${fmt(inputs.x[i])} + (${fmt(inputs.residual[i])}) = ${fmt(value)}`,538,resultY[i]-3,12,'#dbe5f6','left',Math.max(mergeReveal,outputReveal));
   f.vector('output',i,{start:{x:sx,y:resultY[i]},value,unitScale:scale,color:colors[i],strokeWidth:3,opacity:Math.max(mergeReveal,outputReveal),reveal:outputReveal});
 }
 const captions=[
  ['input','三项带符号输入沿恒等路径前行。'],
  ['branches','琥珀色箭头表示独立修正量。'],
  ['merging','每项修正都接在对应的 x 末端。'],
  ['output','对应位移相加，得到逐项输出。']
 ];
 for(const [stage,caption] of captions){
   const alpha=timeline.opacity(stage,t,{fade:.2,persist:false});
   f.layer(alpha,()=>text('caption-'+stage,caption,38,117,12,'#91a2bd'));
 }
 const result=f.finish();
 return {...result,geometry:{...result.geometry,unitScale:scale}};
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render};
if(!new URLSearchParams(location.search).has('export')){
 let start;
 function tick(now){if(start===undefined)start=now;render(((now-start)/1000)%18);requestAnimationFrame(tick)}
 requestAnimationFrame(tick);
}
