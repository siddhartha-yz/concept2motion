import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'), logits=[-.8,.4,1.2], colors=['#57c7ef','#af87ff','#ffb65b'], labels=['A','B','C'], duration=18, fps=15;
const clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function render(t){t=clamp(t/duration)*duration;const stage=t<3?'logits':t<7?'exponential':t<10?'shared-total':t<14?'normalizing':'normalized';const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits}}),c=canvas.getContext('2d');
const text=(id,s,x,y,size=20,color='#edf2fa',align='left',opacity=1)=>f.text(id,s,x,y,{size,color,align,opacity});
text('title','Softmax：为什么三个输出共用一个分母？',34,42,25,'#f4f7ff');text('sub','三个类别各有一个带符号的输入分数',34,72,16,'#9eacc2');
const ys=[145,220,295];for(let i=0;i<3;i++){const a=stage==='logits'?1:stage==='exponential'?1:stage==='shared-total'?1:.5;text('class-'+i,labels[i]+' 类',52,ys[i]-10,18,colors[i]);text('z-'+i,'z = '+logits[i].toFixed(1),140,ys[i]-10,18,'#eef2fa');
// signs and input dots
c.fillStyle=colors[i];c.beginPath();c.arc(111,ys[i]-16,5,0,Math.PI*2);c.fill();
text('exp-label-'+i,'exp('+logits[i].toFixed(1)+')',270,ys[i]-10,17,'#cbd5e5', 'left',stage==='logits'?0.35:1);
const start=314, w=48*Math.exp(logits[i]), reveal=stage==='logits'?0:stage==='exponential'?ease((t-3)/3):1;
f.massBar(i,{x:start,y:ys[i]-2,width:w*reveal,height:18,color:colors[i],opacity:reveal});
text('mass-value-'+i,'正质量 '+Math.exp(logits[i]).toFixed(2),505,ys[i]+13,15,'#aebbd0', 'left',reveal);
}
text('sign-note','负分数也变成正质量',34,350,16,'#9eacc2');
// Three visible paths converge to one shared sum.
const gather=stage==='logits'?0:stage==='exponential'?ease((t-5)/2):stage==='shared-total'?1:1;
for(let i=0;i<3;i++){const yy=ys[i]+7, endY=371; c.save();c.globalAlpha=gather*.7;c.strokeStyle=colors[i];c.lineWidth=2;c.beginPath();c.moveTo(550,yy);c.bezierCurveTo(590,yy,600,endY,640,endY);c.stroke();c.restore();}
const sum=logits.reduce((s,z)=>s+Math.exp(z),0), sumOpacity=stage==='shared-total'?ease((t-7)/1):stage==='normalizing'||stage==='normalized'?1:0;
text('sum-label','把三份质量相加一次',640,350,17,'#edf2fa','center',sumOpacity);text('denominator','Σ exp(z) = '+sum.toFixed(2),640,391,23,'#f4f7ff','center',sumOpacity);
const norm=stage==='normalizing'?ease((t-10)/4):stage==='normalized'?1:0;
text('divide-label','每一类都除以同一个总和',427,432,16,'#aebbd0','center',norm);
if(stage==='normalizing'||stage==='normalized'){
 for(let i=0;i<3;i++){const yy=ys[i]+7; c.save();c.globalAlpha=norm;c.strokeStyle=colors[i];c.lineWidth=2;c.beginPath();c.moveTo(620,402);c.lineTo(680,402);c.lineTo(700,440+i*7);c.stroke();c.restore();}
}
const p=logits.map(z=>Math.exp(z)/sum), final=stage==='normalized';
text('capacity-title','同一条总容量 = 1',34,410,18,'#f4f7ff','left',final?1:.28);
f.partition({x:34,y:435,width:786,height:25},p.map((probability,i)=>({probability,color:colors[i]})));
for(let i=0;i<3;i++)text('prob-'+i,labels[i]+': '+p[i].toFixed(2),34+i*260,467,15,colors[i],'left',final?1:.25);
text('takeaway','共享分母让三个比例合起来恰好为 1。',820,72,14,'#9eacc2','right',final?1:.3);
return f.finish();}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration,fps},render};
if(!location.search.includes('export=1')){let then=0;function tick(ms){if(ms-then>=1000/fps){then=ms;render((ms/1000)%duration)}requestAnimationFrame(tick)}requestAnimationFrame(tick)}else render(0);