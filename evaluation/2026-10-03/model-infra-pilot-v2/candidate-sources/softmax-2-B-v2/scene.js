import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'), logits=[-.8,.4,1.2], colors=['#57c7ef','#af87ff','#ffb65b'], names=['A','B','C'], duration=18, fps=15;
const clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function render(t){t=clamp(t/duration)*duration;const stage=t<3?'logits':t<7?'exponential':t<10?'shared-total':t<14?'normalizing':'normalized';const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits}}),c=canvas.getContext('2d');
const label=(id,s,x,y,size=18,color='#edf2fa',align='left',opacity=1)=>f.text(id,s,x,y,{size,color,align,opacity});
label('title','为什么三个 Softmax 输出共用一个分母？',30,39,23,'#f4f7ff');
label('subtitle','每种颜色代表同一个类别，分数 z 决定它的相对质量。',30,66,15,'#aab7ca');
const ys=[139,210,281], sum=logits.reduce((a,z)=>a+Math.exp(z),0), p=logits.map(z=>Math.exp(z)/sum);
const barReveal=stage==='logits'?0:stage==='exponential'?ease((t-3)/3):1;
for(let i=0;i<3;i++){
 label('class-'+i,names[i]+' 类',34,ys[i],17,colors[i]);
 label('logit-'+i,'输入 z = '+logits[i].toFixed(1),112,ys[i],16,'#eef2fa');
 label('exp-'+i,'exp(z)',271,ys[i],15,'#cbd5e5', 'left',stage==='logits'?.45:1);
 const mass=Math.exp(logits[i]);f.massBar(i,{x:336,y:ys[i]-13,width:150*(mass/Math.exp(1.2))*barReveal,height:17,color:colors[i],opacity:barReveal});
 label('massval-'+i,mass.toFixed(2),496,ys[i],15,colors[i], 'left',barReveal);
}
label('positive-note','指数把正、负分数都变成正质量',34,323,15,'#aab7ca');
// Lanes visibly carry each colored mass into the one shared sum.
const gather=stage==='logits'?0:stage==='exponential'?ease((t-5)/2):1;
for(let i=0;i<3;i++){c.save();c.globalAlpha=.8*gather;c.strokeStyle=colors[i];c.lineWidth=3;c.beginPath();c.moveTo(574,ys[i]-8);c.bezierCurveTo(610,ys[i]-8,605,365,650,365);c.stroke();c.restore();}
const sumAlpha=stage==='shared-total'?ease((t-7)/1):stage==='normalizing'||stage==='normalized'?1:0;
label('sum-title','三份质量汇入同一个总和',650,331,16,'#edf2fa','center',sumAlpha);
label('sum-value','Σ exp(z) = '+sum.toFixed(2),650,366,21,'#f4f7ff','center',sumAlpha);
const norm=stage==='normalizing'?ease((t-10)/4):stage==='normalized'?1:0;
label('divide','共同总和分别作分母',425,403,16,'#d4dced','center',norm);
for(let i=0;i<3;i++){c.save();c.globalAlpha=.85*norm;c.strokeStyle=colors[i];c.lineWidth=2;c.beginPath();c.moveTo(650,375);c.lineTo(650,390);c.lineTo(250+i*175,424);c.stroke();c.restore();}
label('capacity','一条总容量：1',34,427,17,'#f4f7ff','left',stage==='normalized'?1:.45);
f.partition({x:34,y:440,width:786,height:19},p.map((probability,i)=>({probability,color:colors[i]})));
for(let i=0;i<3;i++)label('prob-'+i,names[i]+': '+p[i].toFixed(2),34+i*260,478,14,colors[i], 'left',stage==='normalized'?1:.4);
return f.finish();}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration,fps},render};
if(!location.search.includes('export=1')){let last=-1;function tick(ms){const frame=Math.floor(ms/(1000/fps));if(frame!==last){last=frame;render((frame/fps)%duration)}requestAnimationFrame(tick)}requestAnimationFrame(tick)}else render(0);