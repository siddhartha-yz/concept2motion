import {createMathFrame} from './math-frame.mjs';
import {createMathTimeline} from './math-timeline.mjs';
const canvas=document.getElementById('scene');
const colors=['#57c7ef','#af87ff','#ffb65b'];
const names=['A','B','C'];
const inputs={logits:[-1,0.7,1.3]};
const timeline=createMathTimeline({caseId:'softmax',duration:18,entries:[
 {stage:'logits',start:0,end:3,settledAt:0.8},
 {stage:'exponential',start:3,end:6.5,settledAt:4.7},
 {stage:'shared-total',start:6.5,end:10,settledAt:8.3},
 {stage:'normalizing',start:10,end:14,settledAt:11.5},
 {stage:'normalized',start:14,end:18,settledAt:14.8}
]});
const stages=['logits','exponential','shared-total','normalizing','normalized'];
const captions=[
 '三个分数有正有负，怎样分成总和为 1 的三份？',
 '先取指数：负分数也变成正的质量，大小顺序保留。',
 '把三份首尾相接；每一类都贡献到同一个总量。',
 '每份都除以这个总量：同一把尺，才是同一个整体。',
 '共用分母，三份恰好填满 1；各用各的，就无法保证。'
];
function render(time){
 const t=Math.max(0,Math.min(18,Number.isFinite(time)?time:0));
 const phase=timeline.at(t), k=stages.indexOf(phase.stage);
 const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage:phase.stage,inputs});
 const v=f.values, sum=v.denominator, scale=90, x0=154;
 const text=(id,s,x,y,o={})=>f.text(id,s,x,y,{size:19,color:'#e8edf5',...o});
 const title=text('question','为什么三个 Softmax 输出必须共用一个分母？',36,43,{size:25});
 text('step',`${k+1} / 5`,818,43,{size:15,color:'#9caec5',align:'right'});
 f.layer(timeline.opacity(phase.stage,t,{fade:0.2,persist:false}),()=>{
  text('caption-'+phase.stage,captions[k],36,Math.max(91,title.y+title.height+26),{size:20});
 });
 v.logits.forEach((z,i)=>{
  const sign=z>0?'+':'';
  const label=text('class-'+i,`${names[i]}   输入 ${sign}${z.toFixed(1)}`,55+i*265,145,{color:colors[i],size:20});
  if(k===0){
   text('sign-'+i,z<0?'负分数':'正分数',label.x,Math.max(204,label.y+label.height+35),{color:'#a9b7ca',size:18});
   text('input-big-'+i,`${sign}${z.toFixed(1)}`,label.x,281,{color:colors[i],size:48});
  }
 });
 if(k===0){
  text('input-note','分数不是概率：有负数，总和也不必等于 1。',55,390,{size:21});
 }
 if(k===1){
  v.masses.forEach((m,i)=>{
   const y=200+i*63;
   const label=text('exp-'+i,`exp(${v.logits[i].toFixed(1)}) = ${m.toFixed(3)}`,55,y+19,{color:colors[i],size:19});
   f.massBar(i,{x:Math.max(300,label.x+label.width+24),y,width:m*scale,height:25,color:colors[i],reveal:timeline.reveal('exponential',t)});
  });
  text('exp-note','颜色不变：仍是 A、B、C，现在每份都大于 0。',55,408,{size:20});
 }
 if(k>=2){
  let offset=0;
  const move=k===2?timeline.reveal('shared-total',t):1;
  v.masses.forEach((m,i)=>{
   const targetX=x0+offset*scale;
   f.massBar(i,{x:300+(targetX-300)*move,y:(200+i*63)+(215-(200+i*63))*move,width:m*scale,height:25,color:colors[i]});
   offset+=m;
  });
  if(k===2){
   f.layer(timeline.opacity('shared-total',t,{fade:0.2,persist:false}),()=>{
    text('sum-building',`同一个总量 S = ${v.masses.map(m=>m.toFixed(3)).join(' + ')} ≈ ${sum.toFixed(3)}`,55,389,{size:21});
    text('sum-note','三种颜色全部计入一次，没有遗漏，也没有重复。',55,426,{size:19,color:'#a9b7ca'});
   });
  }else{
   const sumLabel=text('shared-denominator',`共同分母 S = ${sum.toFixed(3)}   （上方三份的总量）`,154,272,{size:20});
   text('divide-action',`每一份 ÷ S     ↓     总量也变成 S ÷ S = 1`,154,Math.max(312,sumLabel.y+sumLabel.height+22),{size:20});
   f.partition({x:x0,y:337,width:sum*scale,height:36,opacity:1},v.probabilities.map((p,i)=>({probability:p,color:colors[i]})));
   v.probabilities.forEach((p,i)=>{
    text('prob-'+i,`${names[i]}  ${v.masses[i].toFixed(3)} / ${sum.toFixed(3)}`,55+i*265,410,{size:18,color:colors[i]});
    text('percent-'+i,`≈ ${(p*100).toFixed(1)}%`,55+i*265,441,{size:22,color:colors[i]});
   });
   text('capacity-one','1',x0+sum*scale+18,362,{size:23,color:'#e8edf5'});
  }
 }
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15,stageTimeline:timeline.meta},render};
render(0);
if(new URLSearchParams(location.search).get('export')!=='1'){
 let start;
 function tick(now){if(start===undefined)start=now;const frame=Math.min(270,Math.floor((now-start)*15/1000));render(frame/15);if(frame<270)requestAnimationFrame(tick);}
 requestAnimationFrame(tick);
}
