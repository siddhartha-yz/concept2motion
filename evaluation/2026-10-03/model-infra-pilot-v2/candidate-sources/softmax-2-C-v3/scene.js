import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d'),logits=[-.8,.4,1.2],colors=['#57c7ef','#af87ff','#ffb65b'],names=['A','B','C'],duration=18,fps=15;
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function render(t){t=clamp(t/duration)*duration;const stage=t<3?'logits':t<7?'exponential':t<10?'shared-total':t<14?'normalizing':'normalized',f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits}}),mass=logits.map(Math.exp),sum=mass.reduce((a,b)=>a+b,0),p=mass.map(x=>x/sum);
const tx=(id,s,x,y,size=18,color='#edf2fa',align='left',opacity=1)=>{if(s)f.text(id,s,x,y,{size,color,align,opacity})};
const raw=(id,x,y,w,h,color,opacity=1)=>{ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.restore();f.finish().bounds.push({id,kind:'shape',x,y,width:w,height:h,opacity})};
// Raw shapes are registered into the returned detached evidence below.
const extra=[];const rect=(id,x,y,w,h,color,opacity=1)=>{ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.restore();extra.push({id,kind:'shape',x,y,width:w,height:h,opacity})};
tx('title','为什么三个 softmax 输出共用一个分母？',30,38,24,'#f4f7ff');tx('question','每个类别的比例，要和谁相比？',30,65,16,'#aebbd0');
const ys=[125,194,263],reveal=stage==='logits'?0:stage==='exponential'?ease((t-3)/3):1;
for(let i=0;i<3;i++){tx('class-'+i,names[i]+' 类',32,ys[i]+5,17,colors[i]);tx('logit-'+i,'输入 z = '+logits[i].toFixed(1),112,ys[i]+5,16);tx('exp-'+i,'exp(z)',270,ys[i]+5,16,'#cbd5e5');f.massBar(i,{x:345,y:ys[i]-10,width:48*mass[i]*reveal,height:20,color:colors[i],opacity:reveal});tx('mass-value-'+i,reveal?'正质量 '+mass[i].toFixed(2):'',520,ys[i]+5,15,'#cbd5e5');}
tx('positive-note','指数把负、正输入都变成正质量。',32,302,15,'#9eacc2');
const gather=stage==='logits'?0:stage==='exponential'?ease((t-5)/2):1;
for(let i=0;i<3;i++){ctx.save();ctx.globalAlpha=gather*.72;ctx.strokeStyle=colors[i];ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(650,ys[i]);ctx.bezierCurveTo(680,ys[i],684,335,714,335);ctx.stroke();ctx.restore();extra.push({id:'flow-'+i,kind:'shape',x:650,y:ys[i],width:64,height:210,opacity:gather*.72});}
const sa=stage==='shared-total'?ease((t-7)/1):stage==='normalizing'||stage==='normalized'?1:0;
tx('sum-caption','三份质量汇成一个总和',714,320,15,'#cbd5e5','center',sa);tx('denominator','Σ exp(z) = '+sum.toFixed(2),714,357,21,'#f4f7ff','center',sa);
const norm=stage==='normalizing'?ease((t-10)/4):stage==='normalized'?1:0;
tx('divide-caption','每一类都除以这同一个总和',427,390,16,'#cbd5e5','center',norm);
for(let i=0;i<3;i++){ctx.save();ctx.globalAlpha=norm*.75;ctx.strokeStyle=colors[i];ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(714,365);ctx.lineTo(714,399);ctx.lineTo(714,424);ctx.stroke();ctx.restore();extra.push({id:'divide-flow-'+i,kind:'shape',x:713,y:365,width:2,height:59,opacity:norm*.75});}
const final=stage==='normalized';tx('capacity-title','同一条总容量 = 1',32,422,17,'#f4f7ff','left',final?1:.28);
f.partition({x:32,y:432,width:790,height:22},p.map((probability,i)=>({probability,color:colors[i]})));
for(let i=0;i<3;i++)tx('prob-'+i,names[i]+': '+p[i].toFixed(2),32+i*260,475,15,colors[i],'left',final?1:.25);
const evidence=f.finish();evidence.bounds.push(...extra);return evidence;}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration,fps},render};
if(!location.search.includes('export=1')){let then=0;function tick(ms){if(ms-then>=1000/fps){then=ms;render((ms/1000)%duration)}requestAnimationFrame(tick)}requestAnimationFrame(tick)}else render(0);