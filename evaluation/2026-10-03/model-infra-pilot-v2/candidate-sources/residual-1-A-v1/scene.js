import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const X=[.8,-.6,.3],R=[-.2,.4,-.1],C=['#55c9ef','#bf91ff','#ffb45e'];
const stages=['input','branches','merging','output'];
const clamp=v=>Math.max(0,Math.min(1,v));
function ease(v){v=clamp(v);return v*v*(3-2*v)}
function rawLine(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function rawText(text,x,y,size=14,color='#9ba9be',align='left'){ctx.fillStyle=color;ctx.font=`${size}px sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y)}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render(t){
 t=clamp(t/18)*18;const si=Math.min(3,Math.floor(t/4.5)),stage=stages[si],p=ease((t-si*4.5)/4.5);
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x:X,residual:R},background:'#101722'});
 const col='#edf2fa',dim='#8391a7';
 f.text('title','残差：什么沿恒等路径保留？',30,38,{size:23,color:col});
 f.text('question','x 原样通过；F(x) 在哪里与它相加？',30,65,{size:15,color:'#bbc7d8'});
 f.text('key','蓝：输入 x　橙：示意修正 F(x)　紫：相加结果 y',30,91,{size:13,color:'#9ba9be'});
 const rowY=[180,260,340],sx=355,scale=115;
 f.text('input-label','输入 x',30,139,{size:14,color:C[0]});
 f.text('identity-label','恒等路径：逐项原样运输',250,139,{size:14,color:C[0]});
 f.text('correction-label','F(x)：独立示意修正',625,139,{size:14,color:'#ffb45e'});
 f.text('formula','y = x + F(x)',640,405,{size:20,color:'#edf2fa'});
 f.text('caveat','修正量为示意值；不是训练得到的权重',30,446,{size:13,color:dim});
 const branch=ease((t-4.5)/4.5),merge=ease((t-9)/4.5),out=ease((t-13.5)/4.5);
 const identityEnds=[];
 for(let i=0;i<3;i++){
   const y=rowY[i],v=X[i],rv=R[i];
   f.text(`component-${i}`,`x${i+1} = ${v>0?'+':''}${v.toFixed(1)}`,30,y+5,{size:16,color:C[i]});
   rawLine(260,y,730,y,'#263244',1);
   const id=f.vector('identity',i,{start:{x:sx,y},value:v,unitScale:scale,color:C[i],strokeWidth:4});identityEnds.push(id.end);
   if(si>=1){
     const start=identityEnds[i],dy=start.x+rv*scale*branch;
     const corr=f.vector('correction',i,{start:{x:start.x,y:y+22},value:rv*branch,unitScale:scale,color:'#ffb45e',strokeWidth:4});
     f.text(`corrval-${i}`,`F${i+1} ${rv>0?'+':''}${rv.toFixed(1)}`,752,y+27,{size:13,color:'#ffb45e'});
     if(si>=2){
       const mp=merge;
       f.vector('correction-merge-proxy',i,{start:{x:start.x,y:y+22},value:rv*mp,unitScale:scale,color:'#ffb45e',strokeWidth:4});
       if(si>=3){
         const oy=out;
         f.vector('output',i,{start:{x:sx,y:y+43},value:(v+rv)*oy,unitScale:scale,color:'#bf91ff',strokeWidth:5});
         f.text(`outval-${i}`,`y${i+1} ${(v+rv)>0?'+':''}${(v+rv).toFixed(1)}`,752,y+48,{size:13,color:'#bf91ff'});
       }
     }
     void corr;void dy;
   }
 }
 if(si>=2){
   f.text('merge-note','对应分量首尾相接：恒等终点 + 修正位移',252,390,{size:14,color:'#ffcf87'});
   rawText('相加发生在分量合并处',427,423,13,'#ffcf87','center');
 }
 if(si>=3)f.text('result-note','y = [+0.6, −0.2, +0.2]',30,405,{size:18,color:'#bf91ff'});
 return f.finish();
}};
if(!location.search.includes('export=1')){let start=performance.now();function tick(now){window.C2M.render(((now-start)/1000)%18);requestAnimationFrame(tick)}requestAnimationFrame(tick)}