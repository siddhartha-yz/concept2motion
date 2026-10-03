import { createMathFrame } from './math-frame.mjs';
import { createMathTimeline } from './math-timeline.mjs';
const canvas=document.getElementById('scene');
const inputs={x:[.7,-.4,.2],residual:[-.2,.15,-.3]};
const colors={identity:'#57c7ef',correction:'#ffb65b',output:'#ad8cff'};
const timeline=createMathTimeline({caseId:'residual',duration:18,entries:[
 {stage:'input',start:0,end:4,settledAt:2.8},
 {stage:'branches',start:4,end:8.2,settledAt:7},
 {stage:'merging',start:8.2,end:13,settledAt:11.8},
 {stage:'output',start:13,end:18,settledAt:16.8}
]});
const captions=[
 ['input','沿恒等路径，什么保持不变？','x 原样通过；每个分量都有自己的位置。'],
 ['branches','修正量从哪里来？','独立的 F(x) 分量接到对应的 x 末端。'],
 ['merging','加法具体发生在哪里？','逐项首尾相接：前一支终点就是修正支起点。'],
 ['output','输出 = 原量 + 修正量','紫色结果等于青色与橙色的带符号和。']
];
function render(t){
 t=Math.max(0,Math.min(18,t));
 const phase=timeline.at(t);
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage:phase.stage,inputs});
 const scale=170, origin=310, rows=[192,265,338];
 const cap=captions.find(c=>c[0]===phase.stage);
 f.text('eyebrow','残差相加  /  RESIDUAL ADDITION',28,34,{size:15,color:'#f4f6fc'});
 f.layer(timeline.opacity(phase.stage,t,{fade:.2}),()=>{
  f.text('question',cap[1],28,72,{size:21,color:'#ffffff'});
  f.text('explain',cap[2],28,99,{size:14,color:'#aebbd0'});
 });
 f.text('identity-head','恒等路径  x',origin,137,{size:14,color:colors.identity});
 f.text('correction-head','修正路径  F(x)',520,137,{size:14,color:colors.correction});
 f.text('output-head','合并结果  y',710,137,{size:14,color:colors.output});
 const idReveal=timeline.reveal('input',t), corrReveal=timeline.reveal('branches',t), outReveal=timeline.reveal('output',t);
 const starts=[];
 for(let i=0;i<3;i++){
  const y=rows[i], x=inputs.x[i], r=inputs.residual[i], sum=x+r;
  f.text('row-'+i,'分量 '+(i+1),278,y+5,{size:12,color:'#8794aa',align:'right'});
  const id=f.vector('identity',i,{start:{x:origin,y},value:x,unitScale:scale,color:colors.identity,strokeWidth:5,reveal:idReveal});
  starts.push(id.targetEnd);
  f.vector('correction',i,{start:id.targetEnd,value:r,unitScale:scale,color:colors.correction,strokeWidth:5,reveal:corrReveal});
  f.text('x-value-'+i,'x = '+x.toFixed(2),origin,y-15,{size:12,color:colors.identity});
  f.text('f-value-'+i,'F = '+(r>0?'+':'')+r.toFixed(2),id.targetEnd.x+9,y-15,{size:12,color:colors.correction});
  const outStart={x:710,y};
  f.vector('output',i,{start:outStart,value:sum,unitScale:scale,color:colors.output,strokeWidth:6,reveal:outReveal});
  f.text('y-value-'+i,'y = '+sum.toFixed(2),outStart.x+scale*sum+9,y-15,{size:12,color:colors.output});
 }
 f.text('identity-note','x 原样保留',origin,390,{size:13,color:colors.identity});
 f.text('merge-note','x 终点接上 F(x) 起点',421,390,{size:13,color:colors.correction});
 f.text('result-note','y = [0.50, −0.25, −0.10]',650,390,{size:13,color:colors.output});
 f.text('sign-note','箭头方向表示正负；长度表示分量大小',28,449,{size:12,color:'#8794aa'});
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render};
if(!new URLSearchParams(location.search).has('export')){const start=performance.now();function play(now){render(((now-start)/1000)%18);requestAnimationFrame(play)}requestAnimationFrame(play)}