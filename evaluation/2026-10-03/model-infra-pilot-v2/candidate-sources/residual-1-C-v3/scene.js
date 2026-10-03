import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const X=[.8,-.6,.3],R=[-.2,.4,-.1],C=['#55c9ef','#bf91ff','#ffb45e'];
const stages=['input','branches','merging','output'],clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v)};
function line(x1,y1,x2,y2,color='#263244',width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render(t){
 t=clamp(t/18)*18;const si=Math.min(3,Math.floor(t/4.5)),stage=stages[si],p=ease((t-4.5)/4.5),q=ease((t-9)/4.5),o=ease((t-13.5)/4.5);
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x:X,residual:R},background:'#101722'});
 const white='#edf2fa',dim='#a5b1c3',row=[172,250,328],sx=310,scale=100;
 f.text('title','残差：什么沿恒等路径保留？',28,36,{size:22,color:white});
 f.text('question','x 原样通过；独立修正 F(x) 在哪里与它相加？',28,61,{size:14,color:'#c1cada'});
 f.text('key','青色：输入与恒等路径　橙色：示意修正　紫色：输出',28,85,{size:13,color:dim});
 f.text('input-label','输入 x',28,123,{size:13,color:C[0]});
 f.text('identity-label','恒等路径：逐项保持原位移',200,123,{size:13,color:C[0]});
 f.text('correction-label','F(x)：独立修正',625,123,{size:13,color:'#ffb45e'});
 f.text('formula','y = x + F(x)',650,404,{size:19,color:white});
 f.text('caveat','修正值仅作示意，不是训练权重',28,458,{size:13,color:dim});
 const identities=[];
 for(let i=0;i<3;i++){
  const y=row[i],v=X[i],r=R[i];
  f.text(`component-${i}`,`x${i+1} = ${v>0?'+':''}${v.toFixed(1)}`,28,y+5,{size:15,color:C[i]});
  line(230,y,750,y);
  const id=f.vector('identity',i,{start:{x:sx,y},value:v,unitScale:scale,color:C[i],strokeWidth:4});identities.push(id);
  if(si>=1){
   const amount=r*p;
   f.vector('correction',i,{start:{x:id.end.x,y},value:amount,unitScale:scale,color:'#ffb45e',strokeWidth:4});
   f.text(`corrval-${i}`,`F${i+1} ${r>0?'+':''}${r.toFixed(1)}`,752,y+5,{size:12,color:'#ffb45e'});
  }
  if(si>=2){
   const used=r*q;
   f.vector('output',i,{start:{x:sx,y:y+38},value:v+used,unitScale:scale,color:'#bf91ff',strokeWidth:5});
   f.text(`sum-${i}`,`${v>0?'+':''}${v.toFixed(1)} + (${r>0?'+':''}${r.toFixed(1)})`,500,y+43,{size:12,color:'#d5c5ff'});
   if(si===3)f.text(`outval-${i}`,`y${i+1} ${(v+r)>0?'+':''}${(v+r).toFixed(1)}`,752,y+43,{size:12,color:'#bf91ff'});
  }
 }
 if(si>=2){
  f.text('merge-note','逐项首尾相接：恒等位移 x 后接修正 F(x)',28,386,{size:13,color:'#ffcf87'});
  f.text('addition-note',si===2?'对应分量在合并处相加':'逐项相加，得到输出 y',28,410,{size:13,color:'#ffcf87'});
 }
 if(si===3)f.text('result-note','y = [+0.6, −0.2, +0.2]',28,437,{size:17,color:'#bf91ff'});
 return f.finish();
}};
if(!location.search.includes('export=1')){const start=performance.now();function tick(now){window.C2M.render(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}