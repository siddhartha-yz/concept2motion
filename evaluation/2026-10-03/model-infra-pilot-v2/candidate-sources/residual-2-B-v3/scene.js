import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const x=[.8,-.6,.3],r=[-.2,.4,-.1],y=x.map((v,i)=>v+r[i]);
const colors=['#57c7ef','#ffb65b','#af87ff'],corr='#ffd166',scale=170,rows=[156,238,320],x0=164,join=526,out=690;
const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v)},mix=(a,b,p)=>a+(b-a)*clamp(p),fmt=v=>`${v>0?'+':''}${v.toFixed(1)}`;
function render(time){
 const t=clamp(time/18)*18,stage=t<4?'input':t<8?'branches':t<13?'merging':'output';
 const f=createMathFrame(canvas,{caseId:'residual',time,stage,inputs:{x,residual:r},background:'#10151f'}),extra=[];
 const text=(id,s,px,py,size=14,color='#eaf0f8',align='left',opacity=1)=>f.text(id,s,px,py,{size,color,align,opacity});
 const raw=(id,draw,b)=>{ctx.save();draw(ctx);ctx.restore();extra.push({id,kind:'shape',...b,opacity:1});};
 text('title','残差连接：什么沿恒等路径保留下来？',34,39,22,'#f3f6fc');
 text('subtitle','输入 x 沿原路保留；独立修正 F(x) 在对应分量处合入。',34,64,14,'#aebbd0');
 text('input-head','输入 x',x0,105,15,colors[0],'center');
 text('identity-head','恒等路径：原分量不变',390,105,15,'#cbd5e4','center');
 text('output-head','输出 y',out,105,15,'#d9e4f5','center');
 text('footnote','F(x) 是示意修正，不是训练得到的权重',34,444,13,'#8998ad');
 const branch=ease((t-4)/2),merge=ease((t-8)/3),showCorr=ease((t-4)/1),showOut=ease((t-12)/1);
 const ends=[];
 for(let i=0;i<3;i++){
  text(`x-label-${i}`,`x${i+1} = ${fmt(x[i])}`,x0,rows[i]-18,14,colors[i],'center');
  const v=f.vector('identity',i,{start:{x:x0,y:rows[i]},value:x[i],unitScale:scale,color:colors[i],strokeWidth:4});ends.push(v.end);
  if(t>=4){const ex=mix(v.end.x,join,branch);if(ex>v.end.x+1)raw(`identity-guide-${i}`,c=>{c.strokeStyle=colors[i];c.lineWidth=2;c.setLineDash([5,5]);c.beginPath();c.moveTo(v.end.x,rows[i]);c.lineTo(ex,rows[i]);c.stroke();},{x:v.end.x,y:rows[i]-1,width:ex-v.end.x,height:2});}
 }
 if(t>=4){
  text('correction-head','独立修正支路 F(x)',390,366,15,corr,'center');
  text('branch-note','修正逐项对应，不改写原来的 x',x0,393,14,'#cbd5e4');
  for(let i=0;i<3;i++){
   const yy=mix(398,rows[i]+28,merge),start={x:join-r[i]*scale,y:yy};
   text(`r-label-${i}`,`F${i+1} = ${fmt(r[i])}`,354,yy-13,13,corr,'center',showCorr);
   const cv=f.vector('correction',i,{start,value:r[i],unitScale:scale,color:corr,strokeWidth:4});
   if(t>=8){const dest=rows[i],endY=mix(yy,dest,merge);raw(`correction-guide-${i}`,c=>{c.strokeStyle=corr;c.lineWidth=2;c.setLineDash([4,4]);c.beginPath();c.moveTo(cv.start.x,yy);c.lineTo(cv.start.x,endY);c.stroke();},{x:cv.start.x-1,y:Math.min(yy,endY),width:2,height:Math.abs(endY-yy)});}
  }
 }
 if(t>=8){
  for(let i=0;i<3;i++)raw(`join-${i}`,c=>{c.fillStyle='#eef3fc';c.beginPath();c.arc(join,rows[i],4,0,Math.PI*2);c.fill();},{x:join-4,y:rows[i]-4,width:8,height:8});
  text('merge-note','修正箭头接到原分量末端：在此逐项相加',x0,418,14,'#d9e4f5', 'left',merge);
 }
 if(t>=12){
  text('equation','yᵢ = xᵢ + Fᵢ(x)',x0,442,15,'#d9e4f5','left',showOut);
  for(let i=0;i<3;i++){
   f.vector('output',i,{start:{x:out,y:rows[i]},value:y[i],unitScale:scale,color:colors[i],strokeWidth:5});
   text(`y-label-${i}`,`y${i+1} = ${fmt(y[i])}`,out+56,rows[i]+5,13,colors[i],'left',showOut);
  }
 }
 const snap=f.finish();snap.bounds.push(...extra);return snap;
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
if(new URLSearchParams(location.search).get('export')!=='1'){let last=-1;function tick(now){const frame=Math.floor(now/(1000/15));if(frame!==last){render((frame%270)/15);last=frame}requestAnimationFrame(tick)}requestAnimationFrame(tick)}