import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.querySelector('#scene');
const inputs={x:[.7,-.4,.2],residual:[-.2,.15,-.3]};
const entries=[
 {stage:'input',start:0,end:3.2,settledAt:2.25},
 {stage:'branches',start:3.2,end:7.5,settledAt:6.5},
 {stage:'merging',start:7.5,end:12.1,settledAt:11.1},
 {stage:'output',start:12.1,end:18,settledAt:16.9}
];
const timeline=createMathTimeline({caseId:'residual',duration:18,entries});
const C=['#60d7ff','#bd9cff','#70e0b0'];
function render(t){
 t=Math.max(0,Math.min(18,t));const p=timeline.at(t);
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage:p.stage,inputs});
 const text=(id,s,x,y,size=15,color='#dbe5f6',align='left',opacity=1)=>f.text(id,s,x,y,{size,color,align,opacity,font:'system-ui, sans-serif'});
 text('eyebrow','RESIDUAL ADDITION  /  COMPONENTWISE',38,35,12,'#8da1bf');
 text('question','What survives the identity path?',38,73,24,'#f2f6ff');
 text('subtitle','x travels unchanged; F(x) joins it at the merge.',38,99,14,'#aab8cf');
 const sx=264, scale=190, ys=[195,267,339];
 text('input-head','INPUT  x',38,139,14,'#60d7ff');
 text('corr-head','CORRECTION  F(x)',538,139,14,'#ffb65b');
 text('merge-head','MERGE',388,139,13,'#9eacc4','center');
 // The input objects remain present; identity is the unchanged horizontal transport.
 const ir=timeline.reveal('input',t);
 const identity=[];
 for(let i=0;i<3;i++){
   text('component-'+i,`x${i+1} = ${inputs.x[i]>0?'+':''}${inputs.x[i].toFixed(2)}`,38,ys[i]+5,13,C[i]);
   identity.push(f.vector('identity',i,{start:{x:sx,y:ys[i]},value:f.values.input[i],unitScale:scale,color:C[i],strokeWidth:4,opacity:1,reveal:ir}));
 }
 // Correction arrows begin at the identity endpoints, so the componentwise join is literal.
 const br=timeline.reveal('branches',t);
 const labelRects=[];
 for(let i=0;i<3;i++){
   const end=identity[i].targetEnd;
   const y=ys[i]+23;
   text('corr-value-'+i,`F${i+1} = ${inputs.residual[i]>0?'+':''}${inputs.residual[i].toFixed(2)}`,538,y+5,13,'#ffbf73');
   f.vector('correction',i,{start:{x:end.x,y},value:f.values.correction[i],unitScale:scale,color:'#ffb65b',strokeWidth:3,opacity:.96,reveal:br});
 }
 const mm=timeline.reveal('merging',t);
 const op=timeline.reveal('output',t);
 // Final result occupies its own lane; arrows encode the signed sum from zero.
 text('output-head','RESULT  y = x + F(x)',38,411,15,'#f2f6ff', 'left',Math.max(mm,op));
 const oy=[431,451,471];
 for(let i=0;i<3;i++){
   const val=f.values.output[i];
   text('sum-'+i,`${inputs.x[i].toFixed(2)} ${inputs.residual[i]<0?'−':'+'} ${Math.abs(inputs.residual[i]).toFixed(2)} = ${val.toFixed(2)}`,538,oy[i]-2,12,'#dbe5f6','left',Math.max(mm,op));
   f.vector('output',i,{start:{x:sx,y:oy[i]},value:val,unitScale:scale,color:C[i],strokeWidth:3,opacity:Math.max(mm,op),reveal:op});
 }
 // Phase captions fade out as each explanation hands off to the next.
 const phases=[['input','Three signed components enter.'],['branches','Identity carries x; a separate F(x) is added.'],['merging','Each correction starts at its matching identity endpoint.'],['output','The signed displacements sum component by component.']];
 for(const [stage,caption] of phases){const a=timeline.opacity(stage,t,{fade:.2,persist:false});f.layer(a,()=>text('phase-'+stage,caption,38,119,12,'#8fa1bc'));}
 const result=f.finish();
 return {...result,geometry:{...result.geometry,unitScale:scale}};
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render};
if(!new URLSearchParams(location.search).has('export')){let start;function tick(now){if(start===undefined)start=now;render(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}
