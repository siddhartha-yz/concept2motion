/** Seeded engineering probes; not model generation or artwork review. */
import {createMathFrame} from '../runtime/math-frame.mjs';
import {createMathTimeline} from '../runtime/math-timeline.mjs';
import {checkFrame} from './contracts.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=process.argv[2];if(!out)throw Error('New output directory required');
await mkdir(resolve(out),{recursive:false});
function canvas(){const ctx=new Proxy({measureText:s=>({width:s.length*7,actualBoundingBoxAscent:10,actualBoundingBoxDescent:3})},{get:(o,k)=>k in o?o[k]:()=>{}});return {width:854,height:480,getContext:()=>ctx};}
let seed=730103;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
const timeline=id=>createMathTimeline({caseId:id,duration:18,entries:(id==='residual'?['input','branches','merging','output']:['logits','exponential','shared-total','normalizing','normalized']).map((stage,i,a)=>({stage,start:18*i/a.length,end:18*(i+1)/a.length,settledAt:18*(i+1)/a.length-.9}))});
const records=[];
const add=(id,frame,brief,tl,expected)=>{const result=checkFrame({...frame,requestedTime:frame.time},brief,{width:854,height:480,duration:18,stageTimeline:tl.meta});records.push({id,expected,passed:result.passed,findings:result.findings,match:expected==='pass'?result.passed:result.findings.some(f=>f.code===expected)});};
for(let j=0;j<120;j++){
 const x=Array.from({length:3},()=>Math.round((random()*2-1)*100)/100),r=x.map(()=>Math.round((random()*2-1)*50)/100),scale=50+random()*70;
 if(j%10===0){x[0]=0;r[0]=0;}if(j%11===0)r[2]=-x[2];
 const brief={id:'residual',inputs:{x,residual:r}},tl=timeline('residual'),time=j%2?17:14;
 const f=createMathFrame(canvas(),{caseId:'residual',time,stage:'output',inputs:brief.inputs});
 x.forEach((value,i)=>{const start={x:350,y:120+i*100},a=f.vector('identity',i,{start,value,unitScale:scale,color:'#57c7ef',reveal:1});f.vector('correction',i,{start:a.targetEnd,value:r[i],unitScale:scale,color:'#ffb65b',reveal:1});f.vector('output',i,{start:{x:350,y:150+i*100},value:value+r[i],unitScale:scale,color:'#af87ff',reveal:time===17?1:.37});});
 const valid=f.finish();add(`residual-${j}`,valid,brief,tl,'pass');
 const bad=structuredClone(valid);bad.geometry.output[1].end.x+=1;add(`residual-${j}-forged`,bad,brief,tl,'wrong_vector_geometry');
}
for(let j=0;j<120;j++){
 const shift=j%3===0?-690:j%3===1?20:0,logits=Array.from({length:3},()=>shift+random()*3-1.5),brief={id:'softmax',inputs:{logits}},tl=timeline('softmax');
 const max=Math.max(...logits),weights=logits.map(z=>Math.exp(z-max)),time=6.5;
 const f=createMathFrame(canvas(),{caseId:'softmax',time,stage:'exponential',inputs:brief.inputs});
 weights.forEach((value,i)=>f.massBar(i,{x:200,y:120+i*100,width:220*value,height:16,color:'#57c7ef',reveal:1}));
 const valid=f.finish();add(`softmax-${j}`,valid,brief,tl,'pass');
 const bad=structuredClone(valid);bad.geometry.massBars[0].targetWidth+=10;bad.geometry.massBars[0].width+=10;add(`softmax-${j}-offset`,bad,brief,tl,'wrong_mass_geometry');
 if(j%3===0){const wrong=structuredClone(valid);wrong.mechanism.masses=wrong.mechanism.masses.map(()=>0);wrong.mechanism.denominator=0;add(`softmax-${j}-erased-tiny-masses`,wrong,brief,tl,'wrong_mass');}
}
const summary={kind:'seeded simulated Canvas numerical/geometry stress probes; not actual renders or independent artistic review',seed:730103,checks:records.length,matches:records.filter(r=>r.match).length,failures:records.filter(r=>!r.match)};
await writeFile(resolve(out,'results.json'),JSON.stringify(records,null,2)+'\n');await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,failures:summary.failures.slice(0,3)}));
