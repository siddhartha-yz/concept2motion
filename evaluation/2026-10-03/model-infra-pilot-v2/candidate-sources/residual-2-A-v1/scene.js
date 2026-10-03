import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene');
const x=[0.8,-0.6,0.3],r=[-0.2,0.4,-0.1],C=['#57c7ef','#ffb65b','#af87ff'],S=160;
const mix=(a,b,u)=>a+(b-a)*Math.max(0,Math.min(1,u));
const ease=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u)};
const stages=['input','branches','merging','output'];
function render(t){
 t=Math.max(0,Math.min(18,t));
 const stage=t<4?'input':t<8?'branches':t<13?'merging':'output';
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x,residual:r},background:'#10151f'});
 const text=(id,s,px,py,size=18,color='#edf2fa',align='left',opacity=1)=>f.text(id,s,px,py,{size,color,align,opacity});
 text('title','残差连接：什么沿恒等路径保留下来？',34,40,23,'#f3f6fc');
 text('question','x 原样通过；加法发生在合流处。',34,68,15,'#aebbd0');
 const rows=[150,235,320],inX=180,joinX=520,outX=690;
 text('input-head','输入 x',inX,105,17,'#57c7ef','center');
 text('identity-head','恒等路径：原值直达',390,105,16,'#57c7ef','center');
 text('correction-head','单独的示意修正 F(x)',390,371,16,'#ffb65b','center');
 text('output-head','输出 y',outX,105,17,'#d9e4f5','center');
 text('note','示意修正；不是训练得到的权重',34,438,14,'#8998ad');
 const branch=ease((t-4)/2),merge=ease((t-8)/4),final=ease((t-12)/1);
 const idX=mix(inX,joinX,branch),corY=397;
 // Input and persistent identity vectors
 for(let i=0;i<3;i++){
  text(`component-${i}`,`x${i+1} = ${x[i]>0?'+':''}${x[i].toFixed(1)}`,inX,rows[i]-17,14,C[i],'center');
  const id=f.vector('identity',i,{start:{x:inX,y:rows[i]},value:x[i],unitScale:S,color:C[i],strokeWidth:4});
  // Raw geometry below expresses the visible identity transport lane.
  if(t>=4){
   const endX=mix(id.end.x,joinX,branch);
   if(Math.abs(endX-id.start.x)>1){canvas.getContext('2d').save();const c=canvas.getContext('2d');c.strokeStyle=C[i];c.globalAlpha=.27+.73*branch;c.lineWidth=2;c.setLineDash([5,5]);c.beginPath();c.moveTo(id.end.x,rows[i]);c.lineTo(endX,rows[i]);c.stroke();c.restore();}
  }
 }
 // Show correction as a distinct lower branch, moving upward toward each matching join.
 const correctionAlpha=t<4?0:Math.min(1,(t-4)/1.2);
 if(t>=4){
  const c=canvas.getContext('2d');c.save();c.globalAlpha=correctionAlpha*.8;c.strokeStyle='#536278';c.lineWidth=2;c.setLineDash([4,6]);c.beginPath();c.moveTo(330,corY);c.lineTo(joinX,corY);c.stroke();c.restore();
  r.forEach((v,i)=>{
   const cy=mix(corY,rows[i]+28,merge);
   text(`correction-label-${i}`,`F${i+1}=${v>0?'+':''}${v.toFixed(1)}`,330,cy-13,13,'#ffb65b','center',correctionAlpha);
   const start={x:joinX-v*S,y:cy};
   const cv=f.vector('correction',i,{start,value:v,unitScale:S,color:'#ffb65b',strokeWidth:4});
   if(t>=8){
    const a=ease((t-8)/3);
    const c2=canvas.getContext('2d');c2.save();c2.globalAlpha=a*.8;c2.strokeStyle='#ffb65b';c2.lineWidth=2;c2.setLineDash([4,5]);c2.beginPath();c2.moveTo(cv.start.x,cy);c2.lineTo(cv.start.x,mix(cy,rows[i],a));c2.stroke();c2.restore();
   }
  });
 }
 // Merge junctions and componentwise sum, on a separate output lane.
 const yvals=x.map((v,i)=>v+r[i]);
 if(t>=8){
  const c=canvas.getContext('2d');c.save();c.globalAlpha=merge;c.fillStyle='#edf2fa';rows.forEach(y=>{c.beginPath();c.arc(joinX,y,4,0,Math.PI*2);c.fill();});c.restore();
 }
 if(t>=12){
  text('sum-caption','对应分量首尾相接：yᵢ = xᵢ + Fᵢ(x)',34,402,16,'#d9e4f5');
  for(let i=0;i<3;i++){
   const start={x:outX,y:rows[i]},v=yvals[i];
   f.vector('output',i,{start,value:v,unitScale:S,color:C[i],strokeWidth:5});
   text(`result-${i}`,`y${i+1} = ${v>0?'+':''}${v.toFixed(1)}`,outX+75,rows[i]+5,15,C[i]);
  }
 }
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
if(new URLSearchParams(location.search).get('export')!=='1'){
 let last=0;function tick(now){if(now-last>=1000/15){render((now%18000)/1000);last=now;}requestAnimationFrame(tick);}requestAnimationFrame(tick);
}