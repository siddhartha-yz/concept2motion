import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const X=[.8,-.6,.3],R=[-.2,.4,-.1],C=['#55c9ef','#bf91ff','#ffb45e'];
const stages=['input','branches','merging','output'];
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function rawText(s,x,y,size=13,color='#aab6c8',align='left'){ctx.save();ctx.font=`${size}px sans-serif`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillStyle=color;ctx.fillText(s,x,y);const m=ctx.measureText(s),a=m.actualBoundingBoxAscent||size*.8,d=m.actualBoundingBoxDescent||size*.2;const b={id:`raw-${rawText.n++}`,kind:'text',x:align==='center'?x-m.width/2:align==='right'?x-m.width:x,y:y-a,width:m.width,height:a+d,opacity:1};rawText.bounds.push(b);ctx.restore()}rawText.n=0;rawText.bounds=[];
function line(x1,y1,x2,y2,color,w=1){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();const b={id:`raw-${rawText.n++}`,kind:'shape',x:Math.min(x1,x2)-w/2,y:Math.min(y1,y2)-w/2,width:Math.abs(x2-x1)+w,height:Math.abs(y2-y1)+w,opacity:1};rawText.bounds.push(b)}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render(t){t=clamp(t/18)*18;const si=Math.min(3,Math.floor(t/4.5)),stage=stages[si],f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x:X,residual:R},background:'#101722'});rawText.n=0;rawText.bounds=[];
 f.text('title','残差连接：什么沿恒等路径保留？',28,35,{size:22,color:'#edf2fa'});
 f.text('question','输入 x 原样通过；独立修正 F(x) 在哪里加入？',28,60,{size:14,color:'#bbc7d8'});
 f.text('legend','青色＝恒等路径 x　橙色＝修正 F(x)　紫色＝结果 y',28,83,{size:12,color:'#aab6c8'});
 f.text('identity-caption','恒等路径：每个带符号分量原样运输',28,116,{size:13,color:'#55c9ef'});
 const ys=[170,245,320],sx=365,scale=115,showCorr=si>=1?ease((t-4.5)/1.2):0,merge=si>=2?ease((t-9)/1.1):0,out=si>=3?ease((t-13.5)/1.1):0;
 for(let i=0;i<3;i++){const y=ys[i],v=X[i],r=R[i],sum=v+r;
 f.text(`input-${i}`,`分量 ${i+1}：x = ${v>0?'+':''}${v.toFixed(1)}`,28,y+5,{size:14,color:C[i]});
 line(345,y,792,y,'#273448');
 const ident=f.vector('identity',i,{start:{x:sx,y},value:v,unitScale:scale,color:C[i],strokeWidth:4});
 if(si>=1){f.vector('correction',i,{start:{x:ident.end.x,y},value:r*showCorr,unitScale:scale,color:'#ffb45e',strokeWidth:4});rawText(`F${i+1} ${r>0?'+':''}${r.toFixed(1)}`,738,y+25,12,'#ffb45e');
 if(si>=3){f.vector('output',i,{start:{x:sx,y:y+42},value:sum*out,unitScale:scale,color:'#bf91ff',strokeWidth:5});rawText(`y${i+1} ${sum>0?'+':''}${sum.toFixed(1)}`,738,y+47,12,'#bf91ff')}}}
 if(si>=2){f.text('merge-caption','加法发生在对应分量的首尾接续处',28,382,{size:13,color:'#ffcf87'});rawText('橙色修正接在青色位移之后',792,382,12,'#ffcf87','right')}
 if(si>=3){f.text('equation','y = x + F(x)',28,414,{size:17,color:'#edf2fa'});f.text('result','y = [+0.6, −0.2, +0.2]',28,439,{size:15,color:'#bf91ff'})}
 f.text('caveat','F(x) 是示意修正，不代表训练权重',28,465,{size:12,color:'#8391a7'});
 const snap=f.finish();snap.bounds.push(...rawText.bounds);return snap;
}};
if(!location.search.includes('export=1')){const start=performance.now();function tick(now){window.C2M.render(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}