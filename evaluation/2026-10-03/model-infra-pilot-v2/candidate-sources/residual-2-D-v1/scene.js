import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene');
const X=[0.8,-0.6,0.3],R=[-0.2,0.4,-0.1];
const C={identity:'#57c7ef',correction:'#ffb65b',output:'#70dfac',text:'#edf2fa',muted:'#aab6c9'};
const scale=150,origins=[135,440,677],centers=[175,427,679];
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const signed=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(1);
function render(time){
 const t=Math.max(0,Math.min(18,Number.isFinite(time)?time:0));
 const stage=t<4?'input':t<8?'branches':t<13?'merging':'output';
 const f=createMathFrame(canvas,{caseId:'residual',time:t,stage,inputs:{x:X,residual:R},background:'#10151f'});
 const text=(id,s,x,y,size=18,color=C.text,align='left')=>f.text(id,s,x,y,{size,color,align});
 text('question','原值沿直通路径保留了什么？加法在哪里发生？',32,40,27);
 const step={input:'01 / 原值直通',branches:'02 / 分开看修正',merging:'03 / 同一分量首尾相接',output:'04 / 读出逐项和'}[stage];
 text('step',step,32,72,17,C.muted);
 text('identity-key','蓝色：原值 x，保持不变',32,105,18,C.identity);
 text('correction-key','橙色：示意修正 F(x)',333,105,18,C.correction);
 text('output-key','绿色：结果 y',665,105,18,C.output);
 const travel=stage==='input'?36*(1-ease(t/2.8)):0;
 const merge=stage==='merging'?ease((t-8)/3.5):stage==='output'?1:0;
 X.forEach((v,i)=>{
  const cx=centers[i],sx=origins[i]-travel;
  text('component-'+i,'分量 '+(i+1),cx,145,19,C.muted,'center');
  text('input-value-'+i,'x = '+signed(v),cx,174,21,C.identity,'center');
  const identity=f.vector('identity',i,{start:{x:sx,y:211},value:v,unitScale:scale,color:C.identity,strokeWidth:8});
  if(stage!=='input'){
   const start={x:identity.end.x,y:291-80*merge};
   f.vector('correction',i,{start,value:R[i],unitScale:scale,color:C.correction,strokeWidth:4});
   text('correction-value-'+i,'F(x) = '+signed(R[i]),cx,256,19,C.correction,'center');
  }
  if(stage==='output'){
   f.vector('output',i,{start:{x:sx,y:321},value:v+R[i],unitScale:scale,color:C.output,strokeWidth:6});
   text('output-value-'+i,'y = '+signed(v+R[i]),cx,363,24,C.output,'center');
   text('sum-'+i,signed(v)+' + ('+signed(R[i])+')',cx,392,17,C.muted,'center');
  }
 });
 let caption;
 if(stage==='input'){
  text('input-note','箭头右指为正，左指为负；长度表示大小。',427,308,22,C.text,'center');
  text('transport-note','蓝色箭头移动，但方向和长度都不变。',427,350,20,C.identity,'center');
  caption='直通路径完整保留三个有符号分量，不删去负数。';
 }else if(stage==='branches'){
  text('branch-note','修正单独走一条路径；蓝色原值仍完整保留。',427,356,21,C.text,'center');
  caption='橙色是另给的示意修正，不是训练得到的权重。';
 }else if(stage==='merging'){
  text('merge-note',merge<1?'把每个橙色箭头的起点，移到对应蓝色箭头的终点。':'橙色从蓝色终点出发：反向走，抵消一部分原值。',427,341,20,C.text,'center');
  text('merge-note-two','移动只改变位置，修正的方向和长度保持不变。',427,379,18,C.muted,'center');
  caption='加法就在这里发生：只合并对应分量，不混合三个分量。';
 }else{
  caption='绿色从原起点到合并终点：y = x + F(x)，不是替换 x。';
 }
 text('caption',caption,427,438,20,C.text,'center');
 text('footer','残差连接 · 等比例箭头 · 修正数值仅为示意',32,468,13,C.muted);
 text('time',Math.floor(t).toString().padStart(2,'0')+' / 18 秒',822,468,13,C.muted,'right');
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'residual',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
render(0);
if(new URLSearchParams(location.search).get('export')!=='1'){
 let start;
 const tick=now=>{if(start===undefined)start=now;const t=Math.min(18,Math.floor((now-start)/1000*15)/15);render(t);if(t<18)requestAnimationFrame(tick);};
 requestAnimationFrame(tick);
}
