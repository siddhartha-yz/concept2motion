import {createMathFrame} from './math-frame.mjs';
const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const logits=[-.8,.4,1.2],colors=['#57c7ef','#af87ff','#ffb65b'],names=['甲类','乙类','丙类'],m=logits.map(Math.exp),sum=m.reduce((a,b)=>a+b,0),p=m.map(v=>v/sum);
const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v)},mix=(a,b,q)=>a+(b-a)*q;
function label(f,id,s,x,y,o=1,size=19,color='#edf2fa',align='left'){f.text(id,s,x,y,{size,color,opacity:o,align,font:'sans-serif'});}
function rawText(s,x,y,size=17,color='#d8e0ee',align='left',alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.font=`${size}px sans-serif`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillStyle=color;ctx.fillText(s,x,y);let w=ctx.measureText(s).width,a=ctx.measureText(s).actualBoundingBoxAscent||size*.8,d=ctx.measureText(s).actualBoundingBoxDescent||size*.2;let r={x:align==='center'?x-w/2:align==='right'?x-w:x,y:y-a,width:w,height:a+d};ctx.restore();return r;}
function render(t){t=Math.max(0,Math.min(18,t));let stage=t<3?'logits':t<7?'exponential':t<10?'shared-total':t<13?'normalizing':'normalized';let f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits}}),b=[];const txt=(s,x,y,z,c,a,op)=>b.push(rawText(s,x,y,z,c,a,op));
// title and signed score cards
label(f,'title','Softmax：三类为什么共用一个分母？',32,39,1,23,'#f4f7fc');
label(f,'question','问题：每个输出的分母为何必须相同？',32,70,1,16,'#aebbd0');
const q=ease((t-.35)/.8);logits.forEach((v,i)=>{let y=137+i*57;label(f,`class-${i}`,names[i],54,y,1,18,colors[i]);label(f,`score-${i}`,`${v>0?'+':''}${v.toFixed(1)}`,177,y,1,19,colors[i],'right');let w=90,fill=colors[i];ctx.save();ctx.strokeStyle='#344155';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(210,y-6);ctx.lineTo(300,y-6);ctx.stroke();ctx.fillStyle=fill;ctx.globalAlpha=q;ctx.fillRect(255,y-10,Math.abs(v)*42,8);ctx.fillRect(255-Math.abs(v)*42,y-10,Math.abs(v)*42,8);ctx.restore();txt(v<0?'负':'正',310,y,13,'#8f9db2','left',q);});
label(f,'input-caption','带符号的输入分数（左侧短刻度表示负号）',32,323,1,15,'#8392a9');
// transformation to exponential masses
const e=ease((t-3)/1.1);label(f,'exp-title','逐类指数化：exp(分数) 始终为正',430,108,e,19,'#f4f7fc');
logits.forEach((v,i)=>{let y=151+i*57;label(f,`exp-label-${i}`,`exp(${v.toFixed(1)})`,430,y+5,e,16,colors[i]);let bw=105*Math.exp(v),w=Math.max(1,bw*e);f.massBar(i,{x:560,y:y-11,width:w,height:18,color:colors[i],opacity:e});if(e>.01)txt(m[i].toFixed(2),570+bw,y+5,15,'#dce4f2','left',e);});
label(f,'mass-caption','三条正质量：每条都来自对应类别的分数',430,334,e,15,'#8392a9');
// one shared sum receives all three contributions
const a=ease((t-7)/1),d=ease((t-8)/1);label(f,'sum-title','把三份质量汇入同一个总量',32,375,a,18,'#f4f7fc');
const bx=[128,333,538],by=405;logits.forEach((_,i)=>{let w=68*Math.exp(logits[i]),x=bx[i];ctx.save();ctx.globalAlpha=a;ctx.fillStyle=colors[i];ctx.fillRect(x,by-17,w,13);ctx.strokeStyle=colors[i];ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w/2,by-2);ctx.lineTo(427,by+9);ctx.stroke();ctx.restore();});
ctx.save();ctx.globalAlpha=a;ctx.strokeStyle='#d9e3f2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(427,by+9);ctx.lineTo(427,by+24);ctx.stroke();ctx.fillStyle='#d9e3f2';ctx.fillRect(421,by+22,12,3);ctx.restore();label(f,'denom-eq',`Z = ${m.map(v=>v.toFixed(2)).join(' + ')} = ${sum.toFixed(2)}`,32,449,a,17,'#dce4f2');label(f,'shared-note','每类都除以这个同一个 Z',470,449,d,17,'#f4f7fc');
// normalize one mass at a time; final common capacity
const n=ease((t-10)/1.5),x0=170,w0=510,y0=260,h=28;label(f,'divide-title','同一分母：各自的质量 ÷ Z',170,223,n,18,'#f4f7fc');logits.forEach((v,i)=>{let yy=106+i*41;label(f,`ratio-${i}`,`${m[i].toFixed(2)} ÷ ${sum.toFixed(2)} = ${p[i].toFixed(3)}`,170,yy,n,16,colors[i]);});
const fin=ease((t-13)/1.3);label(f,'capacity-title','一份总容量 = 1；三类概率刚好填满它',170,323,fin,17,'#f4f7fc');f.partition({x:x0,y:y0,width:w0,height:h},p.map((probability,i)=>({probability,color:colors[i]})));
logits.forEach((_,i)=>{let seg=p[i]*w0,op=fin;label(f,`prob-${i}`,`${names[i]}  ${p[i].toFixed(3)}`,x0+(p.slice(0,i).reduce((a,v)=>a+v,0)+p[i]/2)*w0,311,op,14,'#10151f','center');});
label(f,'takeaway','共用 Z 才能让三份比例以同一把尺归一化，总和为 1。',427,413,fin,17,'#dce4f2','center');
// Return measured registered evidence plus honest bounds for raw canvas decorations/text.
let snap=f.finish();snap.bounds.push(...b.map(r=>({id:`raw-${snap.bounds.length++}`,kind:'shape',...r,opacity:1})));return snap;}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration:18,fps:15},render};
if(new URLSearchParams(location.search).get('export')!=='1'){let start=performance.now();function loop(now){render((now-start)/1000%18);requestAnimationFrame(loop)}requestAnimationFrame(loop)}