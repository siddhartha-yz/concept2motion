import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene');
const logits=[-0.8,0.4,1.2],masses=logits.map(Math.exp);
const total=masses.reduce((a,b)=>a+b,0),probs=masses.map(v=>v/total);
const colors=['#57c7ef','#af87ff','#ffb65b'];
const names=['A','B','C'],xs=[60,322,584];
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const mix=(a,b,p)=>a+(b-a)*p;
function render(time){
 const t=Math.max(0,Math.min(18,Number.isFinite(time)?time:0));
 const stage=t<3?'logits':t<7?'exponential':t<11?'shared-total':t<14?'normalizing':'normalized';
 const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits},background:'#10151f'});
 const text=(id,s,x,y,size=20,color='#edf2fa')=>f.text(id,s,x,y,{size,color});
 text('question','为什么三个 Softmax 输出必须共用一个分母？',42,43,27);
 const headings={logits:'01 / 输入：三个类别的分数，还不是概率',exponential:'02 / 取指数：负分数也变成正的“质量”', 'shared-total':'03 / 首尾相接：三个质量合成一个总量',normalizing:'04 / 同比例换算：把共同总量定义为 1',normalized:'05 / 三个输出：共同分完同一个 1'};
 text('step',headings[stage],42,84,21,'#b8c5d9');
 logits.forEach((z,i)=>{
  text('name-'+i,'类别 '+names[i],xs[i],132,22,colors[i]);
  text('logit-'+i,'输入 z = '+(z>0?'+':'')+z.toFixed(1),xs[i],165,21);
  if(stage!=='logits'){
   const s=stage==='normalized'?'概率 p = '+probs[i].toFixed(4):'exp(z) → '+masses[i].toFixed(3);
   text('value-'+i,s,xs[i],198,20,colors[i]);
  }
 });
 if(stage==='logits'){
  text('input-meaning','分数可以为负，也不必加起来等于 1。',127,274,25);
  text('input-task','目标：让 A、B、C 分享一份总概率。',127,321,25);
 }else if(stage!=='normalized'){
  const gather=ease((t-7)/2.5);
  const growth=mix(0.15,1,ease((t-3)/1.8));
  const scale=stage==='exponential'?100*growth:stage==='normalizing'?mix(100,600/total,ease((t-11)/3)):100;
  let prefix=0;
  masses.forEach((m,i)=>{
   const x=stage==='exponential'?127:127+prefix*scale*gather;
   const y=mix(235+i*55,290,gather);
   f.massBar(i,{x,y,width:m*scale,height:28,color:colors[i],opacity:1});
   prefix+=m;
  });
 }else{
  text('capacity-label','一整条容量 = 1',127,263,20,'#b8c5d9');
  f.partition({x:127,y:290,width:600,height:28},probs.map((probability,i)=>({probability,color:colors[i]})));
  text('zero','0',127,346,18,'#b8c5d9');
  f.text('one','1',727,346,{size:18,color:'#b8c5d9',align:'right'});
 }
 if(stage==='exponential')text('mass-note','同一长度尺度：条越长，正质量越大。',127,403,22);
 if(stage==='shared-total')text('sum','共同总量 S = 0.449 + 1.492 + 3.320 = 5.261',127,403,22);
 if(stage==='normalizing')text('divide','每一段都除以同一个 S：pᵢ = exp(zᵢ) / 5.261',127,403,22);
 if(stage==='normalized')text('sum-one','pA + pB + pC = (三个质量之和) / S = 1',127,403,22);
 const captions={logits:'颜色始终对应同一类别；接下来把分数变成可分配的正质量。',exponential:'exp(−0.8) 仍然大于 0；三个类别都能贡献一份质量。','shared-total':'把三段搬到一起：每一种颜色都进入这唯一的分母。',normalizing:'整条与每一段一起换算，三种颜色的长度比例保持不变。',normalized:'若各用各的分母，就失去了“共同分完这一份”的保证。'};
 text('caption',captions[stage],42,452,20,'#b8c5d9');
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
render(0);
if(new URLSearchParams(location.search).get('export')!=='1'){
 let start,last=-1;
 const tick=now=>{
  if(start===undefined)start=now;
  const frame=Math.min(270,Math.floor((now-start)*15/1000));
  if(frame!==last){render(frame/15);last=frame;}
  if(frame<270)requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
}
