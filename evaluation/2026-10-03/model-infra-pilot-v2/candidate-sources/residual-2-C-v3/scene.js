import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene'),x=[.8,-.6,.3],r=[-.2,.4,-.1],C=['#57c7ef','#ffb65b','#af87ff'],S=130;
const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v)};
function render(t){
 t=clamp(t/18)*18;
 const stage=t<4?'input':t<8?'branches':t<13?'merging':'output';
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x,residual:r},background:'#10151f'}),c=canvas.getContext('2d');
 const T=(id,s,px,py,size=14,color='#edf2fa',align='left',opacity=1)=>f.text(id,s,px,py,{size,color,align,opacity});
 T('title','残差连接：什么沿恒等路径保留下来？',34,38,21,'#f3f6fc');
 T('question','输入 x 原样通过；独立修正 F(x) 在合流处逐项相加。',34,63,14,'#aebbd0');
 const ys=[145,230,315],sx=184,ox=690,vis=clamp((t-4)/1),m=ease((t-8)/4),showOut=clamp((t-12)/1);
 T('input-head','输入 x',sx,101,15,'#d9e4f5','center');
 T('identity-head','恒等路径：原值直达',388,101,15,'#57c7ef','center');
 T('output-head','输出 y',ox,101,15,'#d9e4f5','center');
 T('correction-head','独立修正 F(x)',388,365,14,'#ffb65b','center');
 T('note','修正量为示意；不是训练得到的权重',34,450,13,'#8998ad');
 const ids=[];
 for(let i=0;i<3;i++){
  T(`component-${i}`,`x${i+1} = ${x[i]>0?'+':''}${x[i].toFixed(1)}`,sx,ys[i]-16,14,C[i],'center');
  ids.push(f.vector('identity',i,{start:{x:sx,y:ys[i]},value:x[i],unitScale:S,color:C[i],strokeWidth:4}));
 }
 if(t>=4){
  for(let i=0;i<3;i++){
   const end=ids[i].end,dy=42+i*20,fy=ys[i]+dy;
   T(`correction-label-${i}`,`F${i+1}=${r[i]>0?'+':''}${r[i].toFixed(1)}`,end.x+16,fy-8,13,'#ffb65b','left',vis);
   f.vector('correction',i,{start:{x:end.x,y:fy},value:r[i],unitScale:S,color:'#ffb65b',strokeWidth:4});
   c.save();c.globalAlpha=.75*m;c.strokeStyle='#ffb65b';c.lineWidth=1.5;c.setLineDash([4,5]);c.beginPath();c.moveTo(end.x,fy);c.lineTo(end.x,ys[i]);c.stroke();c.restore();
  }
 }
 if(t>=8){
  T('sum-caption','首尾相接：修正从恒等箭头末端继续',34,385,14,'#d9e4f5', 'left',m);
  c.save();c.globalAlpha=m;c.fillStyle='#edf2fa';ys.forEach(y=>{c.beginPath();c.arc(ids[ys.indexOf(y)].end.x,y,4,0,Math.PI*2);c.fill();});c.restore();
 }
 if(t>=12){
  T('formula','yᵢ = xᵢ + Fᵢ(x)',ox,385,14,'#d9e4f5','center',showOut);
  for(let i=0;i<3;i++){
   const sum=x[i]+r[i],start={x:ox,y:ys[i]};
   f.vector('output',i,{start,value:sum,unitScale:S,color:C[i],strokeWidth:5});
   T(`result-${i}`,`y${i+1} = ${sum>0?'+':''}${sum.toFixed(1)}`,ox+96,ys[i]+5,13,C[i]);
  }
 }
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
if(new URLSearchParams(location.search).get('export')!=='1'){let last=-1;function tick(now){if(now-last>=1000/15){render((now%18000)/1000);last=now;}requestAnimationFrame(tick)}requestAnimationFrame(tick)}