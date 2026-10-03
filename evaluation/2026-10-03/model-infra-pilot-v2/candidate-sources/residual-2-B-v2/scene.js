import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene');
const x=[.8,-.6,.3],r=[-.2,.4,-.1],y=x.map((v,i)=>v+r[i]);
const colors=['#57c7ef','#ffb65b','#af87ff'],scale=170;
const clamp=u=>Math.max(0,Math.min(1,u));
const ease=u=>{u=clamp(u);return u*u*(3-2*u)};
const mix=(a,b,u)=>a+(b-a)*clamp(u);
const stageAt=t=>t<4?'input':t<8?'branches':t<13?'merging':'output';
function render(time){
 const t=clamp(time/18)*18,stage=stageAt(t);
 const f=createMathFrame(canvas,{caseId:'residual',time,stage,inputs:{x,residual:r},background:'#10151f'});
 const ctx=canvas.getContext('2d');
 const text=(id,s,px,py,size=15,color='#edf2fa',align='left',opacity=1)=>f.text(id,s,px,py,{size,color,align,opacity});
 const raw=(id,draw,bounds,opacity=1)=>{ctx.save();ctx.globalAlpha=opacity;draw(ctx);ctx.restore();f.finish;const ev=window.__c2mBounds||(window.__c2mBounds=[]);ev.push({id,kind:'shape',...bounds,opacity});};
 // Raw shapes are recorded after adapter drawing and merged into this frame's detached evidence.
 text('title','残差连接：什么沿恒等路径保留下来？',34,40,23,'#f3f6fc');
 text('question','输入原样通过；独立修正只在对应分量合流时相加。',34,67,14,'#aebbd0');
 const rows=[148,232,316],inputX=170,joinX=525,outX=690;
 text('input-head','输入 x',inputX,103,16,'#57c7ef','center');
 text('identity-head','恒等路径：x 不变',385,103,16,'#57c7ef','center');
 text('correction-head','独立示意修正 F(x)',385,368,16,'#ffb65b','center');
 text('output-head','输出 y',outX,103,16,'#d9e4f5','center');
 text('note','F(x) 为示意修正，不是训练得到的权重',34,440,13,'#8998ad');
 const branch=ease((t-4)/2),merge=ease((t-8)/3),outEase=ease((t-12)/1);
 // Identity arrows persist in every stage. Extend their visible route toward the merge over time.
 for(let i=0;i<3;i++){
  text(`component-${i}`,`x${i+1} = ${x[i]>0?'+':''}${x[i].toFixed(1)}`,inputX,rows[i]-17,14,colors[i],'center');
  const v=f.vector('identity',i,{start:{x:inputX,y:rows[i]},value:x[i],unitScale:scale,color:colors[i],strokeWidth:4});
  if(t>=4){
   const ex=mix(v.end.x,joinX,branch);
   if(ex>v.end.x+2)raw(`identity-guide-${i}`,c=>{c.strokeStyle=colors[i];c.lineWidth=2;c.setLineDash([5,5]);c.beginPath();c.moveTo(v.end.x,rows[i]);c.lineTo(ex,rows[i]);c.stroke();},{x:v.end.x,y:rows[i]-1,width:ex-v.end.x,height:2},.9);
  }
 }
 // Correction is a distinct lower row at first, then visibly travels to each matching identity endpoint.
 if(t>=4){
  const a=clamp((t-4)/1.2);
  text('branch-explain','另一支路携带 F(x)，不改写原来的 x',inputX,391,14,'#cbd5e4');
  r.forEach((v,i)=>{
   const yy=mix(397,rows[i]+28,merge),start={x:joinX-v*scale,y:yy};
   text(`correction-label-${i}`,`F${i+1} = ${v>0?'+':''}${v.toFixed(1)}`,340,yy-13,13,'#ffb65b','center',a);
   const cv=f.vector('correction',i,{start,value:v,unitScale:scale,color:'#ffb65b',strokeWidth:4});
   if(t>=8){
    const k=ease((t-8)/3),dest=rows[i];
    if(k>0)raw(`correction-guide-${i}`,c=>{c.strokeStyle='#ffb65b';c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();c.moveTo(cv.start.x,yy);c.lineTo(cv.start.x,mix(yy,dest,k));c.stroke();},{x:cv.start.x-1,y:Math.min(yy,dest),width:2,height:Math.abs(yy-dest)},k);
   }
  });
 }
 if(t>=8){
  const a=merge;
  rows.forEach((yy,i)=>raw(`join-${i}`,c=>{c.fillStyle='#eef3fc';c.beginPath();c.arc(joinX,yy,4,0,Math.PI*2);c.fill();},{x:joinX-4,y:yy-4,width:8,height:8},a));
  text('merge-caption','修正箭头接到原分量末端：这里逐项相加',inputX,397,14,'#d9e4f5', 'left',a);
 }
 if(t>=12){
  text('sum-caption','yᵢ = xᵢ + Fᵢ(x)',inputX,421,16,'#d9e4f5', 'left',outEase);
  for(let i=0;i<3;i++){
   const start={x:outX,y:rows[i]},sum=y[i];
   f.vector('output',i,{start,value:sum,unitScale:scale,color:colors[i],strokeWidth:5});
   text(`result-${i}`,`y${i+1} = ${sum>0?'+':''}${sum.toFixed(1)}`,outX+76,rows[i]+5,14,colors[i],'left',outEase);
  }
 }
 const snap=f.finish();
 // Include every additional raw Canvas shape in truthful bounds evidence.
 const extra=window.__c2mBounds||[];window.__c2mBounds=[];
 snap.bounds.push(...extra);
 return snap;
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
if(new URLSearchParams(location.search).get('export')!=='1'){
 let last=-1;function tick(now){const frame=Math.floor(now/(1000/15));if(frame!==last){render((frame%270)/15);last=frame}requestAnimationFrame(tick)}requestAnimationFrame(tick);
}