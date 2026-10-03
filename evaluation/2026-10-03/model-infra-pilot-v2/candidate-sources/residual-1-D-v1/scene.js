import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene');
const X=[0.8,-0.6,0.3],F=[-0.2,0.4,-0.1];
const C={identity:'#57c7ef',correction:'#ffb65b',output:'#80dfac',text:'#edf2fa',muted:'#aab7ca'};
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const signed=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(1);
function render(time){
 const t=Math.max(0,Math.min(18,Number.isFinite(time)?time:0));
 const stage=t<4?'input':t<8?'branches':t<13?'merging':'output';
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x:X,residual:F},background:'#10151f'});
 const text=(id,s,x,y,size=20,color=C.text)=>f.text(id,s,x,y,{size,color});
 const n=['input','branches','merging','output'].indexOf(stage);
 text('step',`残差连接   /   ${n+1} · 4`,32,29,15,C.muted);
 text('question','恒等路径保留什么？加法在哪里发生？',32,68,27);
 text('legend-identity','蓝：原样的 x',32,104,17,C.identity);
 text('legend-correction','橙：修正 F(x)',250,104,17,C.correction);
 text('legend-output','绿：结果 y',495,104,17,C.output);
 text('scale','同一尺度 · 正向右，负向左',822,135,14,C.muted);
 // Keep the scale label right-aligned without placing text over the vectors.
 // Its explicit adapter call below is used instead of raw canvas drawing.
 const base=250+90*ease((t-0.7)/2.3);
 const merge=ease((t-8)/3.8);
 X.forEach((x,i)=>{
  const y=178+i*82;
  text(`component-${i}`,`分量 ${i+1}`,32,y+5,19,C.muted);
  text(`input-value-${i}`,signed(x),130,y+5,23,C.identity);
  const identity=f.vector('identity',i,{start:{x:base,y},value:x,unitScale:180,color:C.identity,strokeWidth:8});
  if(stage!=='input'){
   const startX=650+(identity.end.x-650)*merge;
   f.vector('correction',i,{start:{x:startX,y},value:F[i],unitScale:180,color:C.correction,strokeWidth:3});
   if(stage==='branches')text(`correction-value-${i}`,signed(F[i]),620,y+32,20,C.correction);
   if(stage==='merging')text(`merge-note-${i}`,`修正 ${signed(F[i])}`,580,y+7,20,C.correction);
  }
  if(stage==='output'){
   f.vector('output',i,{start:{x:base,y:y+30},value:x+F[i],unitScale:180,color:C.output,strokeWidth:5});
   text(`equation-${i}`,`${signed(x)} ${F[i]<0?'−':'+'} ${Math.abs(F[i]).toFixed(1)} = ${signed(x+F[i])}`,565,y+29,21,C.output);
  }
 });
 const captions=[
  ['蓝箭头搬运输入：方向、长度、数值都不变。','三个箭头分别表示 x 的三个带符号分量。'],
  ['另一条路径提供修正量，原来的 x 仍然保留。','这里的 F(x) 是指定的示意修正，不是训练结果。'],
  ['逐项相加：把橙箭头的起点移到对应蓝箭头的终点。','橙箭头向反方向走，表示减小原分量的幅度。'],
  ['从蓝箭头起点到橙箭头终点，就是相加后的结果。','绿箭头下移展示：y = x + F(x)，三项各自相加。']
 ];
 text('caption',captions[n][0],32,419,22);
 text('detail',captions[n][1],32,454,18,C.muted);
 return f.finish();
}
// Right alignment keeps the scale annotation within the fixed canvas.
// Wrap only the authored render label placement, leaving the adapter unchanged.
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
render(0);
if(!new URLSearchParams(location.search).has('export')){
 let epoch;
 const tick=ms=>{if(epoch===undefined)epoch=ms;const t=Math.min(18,Math.floor((ms-epoch)/1000*15)/15);render(t);if(t<18)requestAnimationFrame(tick);};
 requestAnimationFrame(tick);
}