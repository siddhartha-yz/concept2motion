import {createMathFrame} from './math-frame.mjs';
const canvas=document.querySelector('#scene'),logits=[-.8,.4,1.2],colors=['#57c7ef','#af87ff','#ffb65b'],names=['A','B','C'],duration=18,fps=15;
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function render(t){t=clamp(t/duration)*duration;const stage=t<3?'logits':t<7?'exponential':t<10?'shared-total':t<14?'normalizing':'normalized';const f=createMathFrame(canvas,{caseId:'softmax',time:t,stage,inputs:{logits}}),c=canvas.getContext('2d');
const text=(id,s,x,y,size=17,color='#edf2fa',align='left',opacity=1)=>f.text(id,s,x,y,{size,color,align,opacity});
text('title','为什么三个 Softmax 输出共用一个分母？',28,36,22,'#f4f7ff');
text('subtitle','每种颜色是一类；z 是这类的输入分数。',28,59,14,'#aab7ca');
const ys=[132,194,256],m=logits.map(Math.exp),sum=m.reduce((a,b)=>a+b,0),p=m.map(v=>v/sum);
const reveal=stage==='logits'?0:stage==='exponential'?ease((t-3)/3):1;
for(let i=0;i<3;i++){
 text('class-'+i,names[i]+' 类',30,ys[i],16,colors[i]);
 text('logit-'+i,'z = '+logits[i].toFixed(1),102,ys[i],16);
 text('exp-'+i,'exp(z)',190,ys[i],14,'#cbd5e5','left',stage==='logits'?.45:1);
 f.massBar(i,{x:260,y:ys[i]-12,width:145*m[i]/m[2]*reveal,height:16,color:colors[i],opacity:reveal});
 text('massval-'+i,m[i].toFixed(2),416,ys[i],14,colors[i],'left',reveal);
}
text('positive-note','指数把带符号分数变成正质量',30,293,14,'#aab7ca');
const gather=stage==='logits'?0:stage==='exponential'?ease((t-5)/2):1;
// Three distinct, colored paths visibly carry each mass into the same sum.
for(let i=0;i<3;i++){c.save();c.globalAlpha=.8*gather;c.strokeStyle=colors[i];c.lineWidth=3;c.beginPath();c.moveTo(485,ys[i]-8);c.bezierCurveTo(540,ys[i]-8,540,352,611,352);c.stroke();c.restore();}
const total=stage==='shared-total'?ease((t-7)/1):stage==='normalizing'||stage==='normalized'?1:0;
text('sum-title','三份质量汇入同一个总和',616,314,15,'#edf2fa','center',total);
text('sum-value','Σ exp(z) = '+sum.toFixed(2),616,348,19,'#f4f7ff','center',total);
const norm=stage==='normalizing'?ease((t-10)/4):stage==='normalized'?1:0;
text('divide','同一总和，分别除',428,388,15,'#d4dced','center',norm);
for(let i=0;i<3;i++){c.save();c.globalAlpha=.8*norm;c.strokeStyle=colors[i];c.lineWidth=2;c.beginPath();c.moveTo(616,356);c.lineTo(616,372);c.lineTo(175+i*250,407);c.stroke();c.restore();}
text('capacity','总容量 1',30,422,15,'#f4f7ff','left',stage==='normalized'?1:.45);
f.partition({x:30,y:432,width:794,height:20},p.map((probability,i)=>({probability,color:colors[i]})));
for(let i=0;i<3;i++)text('prob-'+i,names[i]+': '+p[i].toFixed(2),30+i*260,475,14,colors[i],'left',stage==='normalized'?1:.4);
// Truthful evidence for the unregistered raw Canvas paths, measured from their authored extents.
const evidence=f.finish();
for(let i=0;i<3;i++)if(gather>0)evidence.bounds.push({id:'flow-'+i,kind:'shape',x:485,y:ys[i]-11,width:126,height:111,opacity:.8*gather});
for(let i=0;i<3;i++)if(norm>0)evidence.bounds.push({id:'divide-flow-'+i,kind:'shape',x:175+i*250,y:356,width:441-(i*250),height:51,opacity:.8*norm});
return evidence;}
window.C2M={meta:{version:1,caseId:'softmax',renderer:'canvas2d',width:854,height:480,duration,fps},render};
if(!location.search.includes('export=1')){let last=-1;function tick(ms){const frame=Math.floor(ms/(1000/fps));if(frame!==last){last=frame;render((frame/fps)%duration)}requestAnimationFrame(tick)}requestAnimationFrame(tick)}else render(0);