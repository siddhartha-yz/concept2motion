import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene');
const logits=[-0.8,0.4,1.2],masses=logits.map(Math.exp),sum=masses.reduce((a,b)=>a+b,0),p=masses.map(v=>v/sum);
const colors=['#57c7ef','#af87ff','#ffb65b'],names=['A','B','C'],signs=['−0.8','+0.4','+1.2'];
const prefix=[0,masses[0],masses[0]+masses[1]];
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const mix=(a,b,u)=>a+(b-a)*u;
function render(time){
 const t=Math.max(0,Math.min(18,Number.isFinite(time)?time:0));
 const stage=t<3?'logits':t<6?'exponential':t<10?'shared-total':t<14?'normalizing':'normalized';
 const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits},background:'#10151f'});
 const text=(id,s,x,y,size=20,color='#edf2fa',align='left',opacity=1)=>f.text(id,s,x,y,{size,color,align,opacity});
 text('question','为什么三个 Softmax 输出必须共用一个分母？',40,44,28);
 const subtitles={logits:'01 / 输入：三个类别的分数，可以为负，也可以为正',exponential:'02 / 指数变换：每个分数变成一份正的质量', 'shared-total':'03 / 把三份质量接起来，只求一次总量',normalizing:'04 / 整条一起缩放：同一个总量，对应同一个分母',normalized:'05 / 概率：三份共同分完一个总量为 1 的容量'};
 text('subtitle',subtitles[stage],40,86,21,'#b8c5d9');
 if(stage==='logits'){
  logits.forEach((z,i)=>{
   const y=190+i*65;
   text('input-'+i,names[i]+'     '+signs[i],100,y,30,colors[i]);
   text('meaning-'+i,i===0?'负分数':i===1?'较高分数':'最高分数',355,y,23,'#b8c5d9');
  });
  text('input-note','A、B、C 是三个类别；分数还不是概率。',100,389,23);
  text('input-foot','示例分数：用于解释计算过程。',100,431,18,'#899bb4');
 }else if(stage==='exponential'){
  const u=ease((t-3)/0.7);
  text('exp-definition','质量 = exp(分数)；条长使用同一把尺。',44,142,22);
  masses.forEach((m,i)=>{
   const y=195+i*65;
   text('exp-label-'+i,names[i]+'  '+signs[i]+' → '+m.toFixed(3),44,y+20,20,colors[i]);
   f.massBar(i,{x:280,y,width:100*m,height:25,color:colors[i],opacity:u});
  });
  text('positive-note','负分数也得到正质量；分数越高，质量越大。',44,403,22);
  text('exp-foot','例如：exp(−0.8) ≈ 0.449 > 0',44,439,19,'#b8c5d9');
 }else{
  masses.forEach((m,i)=>{
   const x=100+i*230;
   text('legend-'+i,names[i]+'  '+m.toFixed(3),x,145,23,colors[i]);
   if(stage==='normalized')text('probability-'+i,(p[i]*100).toFixed(2)+'%',x,184,24,colors[i]);
  });
  if(stage==='shared-total'){
   const h=ease((t-6)/1.5),v=ease((t-7.5)/1.5);
   masses.forEach((m,i)=>f.massBar(i,{x:mix(280,100+prefix[i]*100,h),y:mix(195+i*65,250,v),width:m*100,height:25,color:colors[i]}));
   text('sum-formula','共同总量 S = 0.449 + 1.492 + 3.320 ≈ '+sum.toFixed(3),70,374,23);
   text('sum-note','每种颜色都贡献一份；任何一份都不能漏掉。',70,423,22,'#b8c5d9');
  }else{
   const u=ease((t-10)/3),scale=mix(100,654/sum,u),height=mix(25,32,u);
   text('capacity-label',stage==='normalized'?'这一整条 = 1':'把整条总量 S 换算成 1',100,225,22);
   if(stage==='normalized'){
    f.partition({x:100,y:250,width:654,height:32},p.map((probability,i)=>({probability,color:colors[i]})));
   }else{
    masses.forEach((m,i)=>f.massBar(i,{x:100+prefix[i]*scale,y:250,width:m*scale,height,color:colors[i]}));
   }
   text('left-end','0',100,311,18,'#b8c5d9');
   text('right-end',stage==='normalized'?'1':'S → 1',stage==='normalized'?754:100+sum*scale,311,18,'#b8c5d9','right');
   text('division','每份概率 = 自己的质量 ÷ 同一个 S',100,363,25);
   text('reason',stage==='normalized'?'所以：三份相加 = S / S = 1。':'统一换算尺度，三种颜色的比例保持不变。',100,407,23,'#b8c5d9');
   if(stage==='normalized')text('last-note','各用各的分母，就不再保证恰好分完这一整条。',100,447,20,'#b8c5d9');
  }
 }
 return f.finish();
}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
render(0);
if(new URLSearchParams(location.search).get('export')!=='1'){
 const start=performance.now();let previous=-1;
 function tick(now){const frame=Math.min(270,Math.floor((now-start)*15/1000));if(frame!==previous){render(frame/15);previous=frame;}if(frame<270)requestAnimationFrame(tick);}
 requestAnimationFrame(tick);
}