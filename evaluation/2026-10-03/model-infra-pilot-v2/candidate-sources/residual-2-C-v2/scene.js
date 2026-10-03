import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene'),x=[.8,-.6,.3],r=[-.2,.4,-.1],C=['#57c7ef','#ffb65b','#af87ff'],S=150;
const clamp=u=>Math.max(0,Math.min(1,u)),ease=u=>{u=clamp(u);return u*u*(3-2*u)};
function render(t){
 t=clamp(t/18)*18;
 const stage=t<4?'input':t<8?'branches':t<13?'merging':'output';
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x,residual:r},background:'#10151f'}),c=canvas.getContext('2d');
 const T=(id,s,px,py,size=15,color='#edf2fa',align='left',opacity=1)=>f.text(id,s,px,py,{size,color,align,opacity});
 T('title','残差连接：什么沿恒等路径保留下来？',34,39,22,'#f3f6fc');
 T('question','x 原样通过；加法发生在合流处。',34,65,14,'#aebbd0');
 const ys=[151,234,317],sx=186,jx=520,ox=692;
 T('input-head','输入 x',sx,105,16,'#d9e4f5','center');
 T('identity-head','恒等路径：原值直达',380,105,16,'#57c7ef','center');
 T('correction-head','独立示意修正 F(x)',390,374,15,'#ffb65b','center');
 T('output-head','输出 y',ox,105,16,'#d9e4f5','center');
 T('note','示意修正；不是训练得到的权重',34,440,14,'#8998ad');
 const branch=ease((t-4)/2),merge=ease((t-8)/4),out=ease((t-12)/1);
 // Original signed input vectors persist as the identity route in every stage.
 const ids=[];
 for(let i=0;i<3;i++){
  T(`component-${i}`,`x${i+1} = ${x[i]>0?'+':''}${x[i].toFixed(1)}`,sx,ys[i]-17,14,C[i],'center');
  ids.push(f.vector('identity',i,{start:{x:sx,y:ys[i]},value:x[i],unitScale:S,color:C[i],strokeWidth:4}));
 }
 // Three separate correction arrows occupy their own spaced lanes. They slide to the matching identity endpoints.
 const corrY=[383,405,427],vis=clamp((t-4)/1);
 if(t>=4){
  for(let i=0;i<3;i++){
   const startX=sx+x[i]*S, endX=startX, y=corrY[i];
   T(`correction-label-${i}`,`F${i+1}=${r[i]>0?'+':''}${r[i].toFixed(1)}`,350,y-6,13,'#ffb65b','center',vis);
   f.vector('correction',i,{start:{x:startX,y},value:r[i],unitScale:S,color:'#ffb65b',strokeWidth:4});
   // Fine connector visually carries each distinct correction lane to its own identity endpoint.
   c.save();c.globalAlpha=.8*merge;c.strokeStyle='#ffb65b';c.lineWidth=2;c.setLineDash([4,5]);
   c.beginPath();c.moveTo(startX,y);c.lineTo(startX,ys[i]);c.stroke();c.restore();
  }
 }
 // At merge, the correction tail reaches the identity head; the output shows the signed sum from the same origin.
 if(t>=8){
  c.save();c.globalAlpha=merge;c.fillStyle='#edf2fa';ys.forEach(y=>{c.beginPath();c.arc(jx,y,4,0,Math.PI*2);c.fill();});c.restore();
 }
 if(t>=12){
  T('sum-caption','逐分量首尾相接： yᵢ = xᵢ + Fᵢ(x)',34,354,15,'#d9e4f5');
  for(let i=0;i<3;i++){
   const v=x[i]+r[i],start={x:ox,y:ys[i]};
   f.vector('output',i,{start,value:v,unitScale:S,color:C[i],strokeWidth:5});
   T(`result-${i}`,`y${i+1}=${v>0?'+':''}${v.toFixed(1)}`,ox+88,ys[i]+5,14,C[i]);
  }
 }
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
if(new URLSearchParams(location.search).get('export')!=='1'){let last=-1;function tick(now){if(now-last>=1000/15){render((now%18000)/1000);last=now;}requestAnimationFrame(tick)}requestAnimationFrame(tick)}