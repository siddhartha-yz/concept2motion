import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.getElementById('scene');
const inputs={x:[.7,-.4,.2],residual:[-.2,.15,-.3]};
const cyan='#57c7ef', amber='#ffb65b', violet='#ad8cff';
const timeline=createMathTimeline({caseId:'residual',duration:18,entries:[
 {stage:'input',start:0,end:4,settledAt:2.7},
 {stage:'branches',start:4,end:8.2,settledAt:6.9},
 {stage:'merging',start:8.2,end:13,settledAt:11.7},
 {stage:'output',start:13,end:18,settledAt:16.7}
]});
const captions=[
 ['input','What survives the identity path?','x travels unchanged along the identity path.'],
 ['branches','A separate correction is added','Illustrative F(x), not learned weights.'],
 ['merging','Where does addition happen?','Each correction starts at its matching x endpoint.'],
 ['output','y = x + F(x)','The signed components add independently.']
];
function render(t){
 t=Math.max(0,Math.min(18,t));
 const p=timeline.at(t),f=createMathFrame(canvas,{caseId:'residual',time:t,stage:p.stage,inputs});
 const scale=190,sx=330,ys=[190,260,330],cap=captions.find(c=>c[0]===p.stage);
 f.text('title','RESIDUAL ADDITION',28,38,{size:17,color:'#f4f6fc'});
 f.layer(timeline.opacity(p.stage,t,{fade:.2}),()=>{
  f.text('question',cap[1],28,78,{size:22,color:'#ffffff'});
  f.text('explain',cap[2],28,108,{size:15,color:'#aebbd0'});
 });
 f.text('col-x','IDENTITY  x',sx,145,{size:13,color:cyan});
 f.text('col-f','CORRECTION  F(x)',510,145,{size:13,color:amber});
 f.text('col-y','OUTPUT  y',710,145,{size:13,color:violet});
 const identity=[];
 for(let i=0;i<3;i++){
  const y=ys[i],x=inputs.x[i],r=inputs.residual[i];
  f.text('row-'+i,['1','2','3'][i],292,y+5,{size:13,color:'#8d99ad',align:'right'});
  identity[i]=f.vector('identity',i,{start:{x:sx,y},value:f.values.input[i],unitScale:scale,color:cyan,strokeWidth:5,reveal:timeline.reveal('input',t)});
  f.vector('correction',i,{start:identity[i].targetEnd,value:f.values.correction[i],unitScale:scale,color:amber,strokeWidth:5,reveal:timeline.reveal('branches',t)});
  f.text('xval-'+i,x.toFixed(2),sx,y-15,{size:13,color:cyan});
  f.text('fval-'+i,(r>0?'+':'')+r.toFixed(2),identity[i].targetEnd.x+8,y-15,{size:13,color:amber});
  const outStart={x:710,y};
  f.vector('output',i,{start:outStart,value:f.values.output[i],unitScale:scale,color:violet,strokeWidth:6,reveal:timeline.reveal('output',t)});
  const end=outStart.x+scale*(x+r);
  f.text('yval-'+i,(x+r).toFixed(2),x+r>=0?end+8:end-8,y-15,{size:13,color:violet,align:x+r>=0?'left':'right'});
 }
 f.text('identity-note','unchanged',sx,382,{size:13,color:cyan});
 f.text('merge-note','head-to-tail merge',470,382,{size:13,color:amber});
 f.text('result-note','[0.50, −0.25, −0.10]',690,382,{size:13,color:violet});
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render};
if(!new URLSearchParams(location.search).has('export')){const start=performance.now();function play(now){render(((now-start)/1000)%18);requestAnimationFrame(play)}requestAnimationFrame(play)}