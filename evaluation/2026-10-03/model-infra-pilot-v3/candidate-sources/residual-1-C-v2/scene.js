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
const C=['#60d7ff','#bd9cff','#70e0b0'], scale=190;
function render(t){
 t=Math.max(0,Math.min(18,t));const p=timeline.at(t);
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage:p.stage,inputs});
 const text=(id,s,x,y,size=15,color='#dbe5f6',align='left',opacity=1)=>f.text(id,s,x,y,{size,color,align,opacity,font:'system-ui, sans-serif'});
 text('eyebrow','RESIDUAL ADDITION  /  COMPONENTWISE',38,35,12,'#8da1bf');
 text('question','What survives the identity path?',38,73,24,'#f2f6ff');
 text('subtitle','x travels unchanged; F(x) joins at the merge.',38,99,14,'#aab8cf');
 text('input-head','INPUT  x',38,139,14,'#60d7ff');
 text('merge-head','MERGE',388,139,13,'#9eacc4','center');
 text('corr-head','CORRECTION  F(x)',538,139,14,'#ffb65b');
 const sx=264, ys=[195,267,339];
 const identity=[];
 for(let i=0;i<3;i++){
   text('component-'+i,`x${i+1} = ${inputs.x[i]>0?'+':''}${inputs.x[i].toFixed(2)}`,38,ys[i]+5,13,C[i]);
   identity.push(f.vector('identity',i,{start:{x:sx,y:ys[i]},value:f.values.input[i],unitScale:scale,color:C[i],strokeWidth:4,reveal:timeline.reveal('input',t)}));
 }
 // The correction begins exactly at the identity endpoint; keep that same y lane for a verifiable head-to-tail merge.
 for(let i=0;i<3;i++){
   const origin=identity[i].targetEnd;
   text('corr-value-'+i,`F${i+1} = ${inputs.residual[i]>0?'+':''}${inputs.residual[i].toFixed(2)}`,538,ys[i]+29,13,'#ffbf73');
   f.vector('correction',i,{start:origin,value:f.values.correction[i],unitScale:scale,color:'#ffb65b',strokeWidth:3,opacity:.96,reveal:timeline.reveal('branches',t)});
 }
 const mergeOpacity=timeline.opacity('merging',t,{fade:.2,persist:false});
 const outputOpacity=timeline.opacity('output',t,{fade:.2,persist:true});
 const resultOpacity=Math.max(mergeOpacity,outputOpacity);
 text('output-head','RESULT  y = x + F(x)',38,411,15,'#f2f6ff','left',resultOpacity);
 const oy=[431,451,471];
 for(let i=0;i<3;i++){
   const val=f.values.output[i];
   text('sum-'+i,`${inputs.x[i].toFixed(2)} ${inputs.residual[i]<0?'−':'+'} ${Math.abs(inputs.residual[i]).toFixed(2)} = ${val.toFixed(2)}`,538,oy[i]-2,12,'#dbe5f6','left',outputOpacity);
   f.vector('output',i,{start:{x:sx,y:oy[i]},value:val,unitScale:scale,color:C[i],strokeWidth:3,opacity:outputOpacity,reveal:timeline.reveal('output',t)});
 }
 const phases=[['input','Three signed components enter.'],['branches','Identity carries x; a separate correction F(x) joins.'],['merging','Each correction starts at its matching identity endpoint.'],['output','The signed displacements sum component by component.']];
 for(const [stage,caption] of phases){const a=timeline.opacity(stage,t,{fade:.2,persist:false});f.layer(a,()=>text('phase-'+stage,caption,38,119,12,'#8fa1bc'));}
 const result=f.finish();
 return {...result,geometry:{...result.geometry,unitScale:scale}};
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render};
if(!new URLSearchParams(location.search).has('export')){let start;function tick(now){if(start===undefined)start=now;render(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}