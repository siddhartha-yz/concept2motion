import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.getElementById('scene');
const inputs={x:[.7,-.4,.2],residual:[-.2,.15,-.3]};
const colors=['#57c7ef','#ffb65b','#ad8cff'];
const timeline=createMathTimeline({caseId:'residual',duration:18,entries:[
 {stage:'input',start:0,end:4,settledAt:2.7},
 {stage:'branches',start:4,end:8.2,settledAt:6.9},
 {stage:'merging',start:8.2,end:13,settledAt:11.7},
 {stage:'output',start:13,end:18,settledAt:16.7}
]});
const captions=[
 ['input',0,4,'What survives the identity path?','x travels unchanged.'],
 ['branches',4,8.2,'A separate correction is added','Illustrative F(x), not learned weights.'],
 ['merging',8.2,13,'Where does addition happen?','Each correction joins its matching x endpoint.'],
 ['output',13,18,'y = x + F(x)','The signed components add independently.']
];
function render(t){
 t=Math.max(0,Math.min(18,t));
 const p=timeline.at(t), f=createMathFrame(canvas,{caseId:'residual',time:t,stage:p.stage,inputs});
 const scale=190, sx=310, ys=[178,250,322];
 f.text('title','RESIDUAL ADDITION',28,38,{size:17,color:'#f4f6fc'});
 const cap=captions.find(c=>c[0]===p.stage);
 f.layer(timeline.opacity(p.stage,t,{fade:.2}),()=>{
  f.text('question',cap[3],28,78,{size:22,color:'#ffffff'});
  f.text('explain',cap[4],28,108,{size:15,color:'#aebbd0'});
 });
 f.text('col-x','IDENTITY  x',sx,142,{size:13,color:'#57c7ef'});
 f.text('col-f','CORRECTION  F(x)',520,142,{size:13,color:'#ffb65b'});
 f.text('col-y','OUTPUT  y',700,142,{size:13,color:'#ad8cff'});
 const identity=[];
 for(let i=0;i<3;i++){
  const y=ys[i], x=inputs.x[i], r=inputs.residual[i];
  f.text('row-'+i,['1','2','3'][i],278,y+5,{size:13,color:'#7e8ba1',align:'right'});
  identity[i]=f.vector('identity',i,{start:{x:sx,y},value:x,unitScale:scale,color:colors[0],strokeWidth:5,reveal:timeline.reveal('input',t)});
  f.vector('correction',i,{start:identity[i].targetEnd,value:r,unitScale:scale,color:colors[1],strokeWidth:5,reveal:timeline.reveal('branches',t)});
  f.text('xval-'+i,x.toFixed(2),sx,y-14,{size:13,color:colors[0]});
  f.text('fval-'+i,r>0?'+'+r.toFixed(2):r.toFixed(2),identity[i].targetEnd.x+8,y-14,{size:13,color:colors[1]});
  const outStart={x:700,y};
  f.vector('output',i,{start:outStart,value:x+r,unitScale:scale,color:colors[2],strokeWidth:6,reveal:timeline.reveal('output',t)});
  f.text('yval-'+i,(x+r).toFixed(2),outStart.x+scale*(x+r)+8,y-14,{size:13,color:colors[2]});
 }
 f.text('identity-note','unchanged',sx,369,{size:13,color:'#57c7ef'});
 f.text('merge-note','head-to-tail merge',430,369,{size:13,color:'#ffb65b'});
 f.text('result-note','[0.50, −0.25, −0.10]',700,369,{size:13,color:'#ad8cff'});
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render};
if(!new URLSearchParams(location.search).has('export')){let start=performance.now();function play(now){render(((now-start)/1000)%18);requestAnimationFrame(play)}requestAnimationFrame(play)}