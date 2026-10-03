import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const X=[.8,-.6,.3],R=[-.2,.4,-.1],C=['#55c9ef','#bf91ff','#ffb45e'];
const stages=['input','branches','merging','output'],clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render(t){
 t=clamp(t/18)*18;const si=Math.min(3,Math.floor(t/4.5)),stage=stages[si];
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x:X,residual:R},background:'#101722'});
 const col='#edf2fa',dim='#8391a7',row=[175,250,325],sx=310,scale=105;
 f.text('title','残差：什么沿恒等路径保留？',28,36,{size:22,color:col});
 f.text('question','x 原样通过；独立修正 F(x) 在哪里与它相加？',28,62,{size:14,color:'#bbc7d8'});
 f.text('key','青色：输入分量　橙色：示意修正　紫色：输出',28,86,{size:13,color:dim});
 f.text('input-label','输入 x',28,124,{size:13,color:C[0]});
 f.text('identity-label','恒等路径：每项不变',200,124,{size:13,color:C[0]});
 f.text('correction-label','F(x)：独立修正',625,124,{size:13,color:'#ffb45e'});
 f.text('formula','y = x + F(x)',650,404,{size:19,color:col});
 f.text('caveat','修正量是示意值，不是训练权重',28,449,{size:13,color:dim});
 const bp=ease((t-4.5)/4.5),mp=ease((t-9)/4.5),op=ease((t-13.5)/4.5);
 const ids=[];
 for(let i=0;i<3;i++){
   const y=row[i],v=X[i],r=R[i];
   f.text(`component-${i}`,`x${i+1} = ${v>0?'+':''}${v.toFixed(1)}`,28,y+5,{size:15,color:C[i]});
   line(230,y,750,y,'#263244');
   const id=f.vector('identity',i,{start:{x:sx,y},value:v,unitScale:scale,color:C[i],strokeWidth:4});ids.push(id);
   if(si>=1){
     const amount=r*(si===1?bp:1);
     f.vector('correction',i,{start:{x:id.end.x,y:y+22},value:amount,unitScale:scale,color:'#ffb45e',strokeWidth:4});
     f.text(`corrval-${i}`,`F${i+1} ${r>0?'+':''}${r.toFixed(1)}`,752,y+27,{size:12,color:'#ffb45e'});
   }
   if(si>=2){
     const mergeAmount=r*mp;
     f.vector('output',i,{start:{x:sx,y:y+44},value:v+mergeAmount,unitScale:scale,color:'#bf91ff',strokeWidth:5});
     f.text(`sum-${i}`,`${v>0?'+':''}${v.toFixed(1)} + (${r>0?'+':''}${r.toFixed(1)})`,500,y+48,{size:12,color:'#d5c5ff'});
     if(si>=3)f.text(`outval-${i}`,`y${i+1} ${(v+r)>0?'+':''}${(v+r).toFixed(1)}`,752,y+48,{size:12,color:'#bf91ff'});
   }
 }
 if(si>=2){
   f.text('merge-note','对应位移首尾相接：从 x 的终点继续走 F(x)',225,383,{size:13,color:'#ffcf87'});
   f.text('addition-note',si===2?'相加发生在每一对分量的合并处':'逐项相加，得到输出 y',28,407,{size:13,color:'#ffcf87'});
 }
 if(si>=3)f.text('result-note','y = [+0.6, −0.2, +0.2]',28,431,{size:17,color:'#bf91ff'});
 return f.finish();
}};
if(!location.search.includes('export=1')){let start=performance.now();function tick(now){window.C2M.render(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}