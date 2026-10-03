import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const X=[.8,-.6,.3],R=[-.2,.4,-.1],COL=['#55c9ef','#bf91ff','#ffb45e'];
const stages=['input','branches','merging','output'];
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function line(x1,y1,x2,y2,color,w=1){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function rawLabel(s,x,y,size=13,color='#9ba9be',align='left'){ctx.font=`${size}px sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,x,y)}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render(t){
 t=clamp(t/18)*18;const si=Math.min(3,Math.floor(t/4.5)),stage=stages[si];
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x:X,residual:R},background:'#101722'});
 f.text('title','残差连接：什么沿恒等路径保留？',28,35,{size:22,color:'#edf2fa'});
 f.text('question','输入 x 原样通过；独立修正 F(x) 在哪里加入？',28,60,{size:14,color:'#bbc7d8'});
 f.text('legend','青色＝恒等路径 x　橙色＝示意修正 F(x)　紫色＝结果 y',28,83,{size:12,color:'#aab6c8'});
 f.text('identity-caption','恒等路径：带符号位移原样运输',28,116,{size:13,color:'#55c9ef'});
 f.text('corr-caption','对应分量在终点接续，形成相加',28,384,{size:13,color:'#ffcf87'});
 f.text('caveat','F(x) 是示意修正，不代表训练权重',28,449,{size:12,color:'#8391a7'});
 const ys=[170,245,320],sx=365,scale=115;
 for(let i=0;i<3;i++){
   const y=ys[i],v=X[i],r=R[i],sum=v+r;
   f.text(`input-${i}`,`分量 ${i+1}：x = ${v>0?'+':''}${v.toFixed(1)}`,28,y+5,{size:14,color:COL[i]});
   line(345,y,792,y,'#273448');
   const ident=f.vector('identity',i,{start:{x:sx,y},value:v,unitScale:scale,color:COL[i],strokeWidth:4});
   if(si>=1){
     const appear=ease((t-4.5)/1.2), merge=si>=2?ease((t-9)/1.1):0;
     const corrValue=r*(appear*(1-merge)+merge);
     f.vector('correction',i,{start:{x:ident.end.x,y},value:corrValue,unitScale:scale,color:'#ffb45e',strokeWidth:4});
     f.text(`corr-${i}`,`F${i+1} ${r>0?'+':''}${r.toFixed(1)}`,738,y+25,{size:12,color:'#ffb45e'});
     if(si>=3){
       const q=ease((t-13.5)/1.1);
       f.vector('output',i,{start:{x:sx,y:y+42},value:sum*q,unitScale:scale,color:'#bf91ff',strokeWidth:5});
       f.text(`out-${i}`,`y${i+1} ${sum>0?'+':''}${sum.toFixed(1)}`,738,y+47,{size:12,color:'#bf91ff'});
     }
   }
 }
 if(si>=2){
   f.text('merge-equation','每项：xᵢ 的位移 + Fᵢ(x) 的位移',28,414,{size:14,color:'#ffcf87'});
   rawLabel('加法发生在接续合并处',594,414,13,'#ffcf87');
 }
 if(si>=3){
   f.text('equation','y = x + F(x)',28,354,{size:18,color:'#edf2fa'});
   f.text('result','y = [+0.6, −0.2, +0.2]',28,433,{size:16,color:'#bf91ff'});
 }
 return f.finish();
}};
if(!location.search.includes('export=1')){const start=performance.now();function tick(now){window.C2M.render(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}