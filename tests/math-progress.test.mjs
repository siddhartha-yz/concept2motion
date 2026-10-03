import test from 'node:test';
import assert from 'node:assert/strict';
import {createMathFrame} from '../runtime/math-frame.mjs';
import {createMathTimeline} from '../runtime/math-timeline.mjs';
import {checkFrame,checkMassGeometry,checkStageTimeline} from '../tools/contracts.mjs';

function canvas(){const ctx=new Proxy({measureText:s=>({width:s.length*8,actualBoundingBoxAscent:10,actualBoundingBoxDescent:2})},{get:(o,k)=>k in o?o[k]:()=>{}});return {width:854,height:480,getContext:()=>ctx};}
const x=[.8,-.6,.3],r=[-.2,.4,-.1],brief={id:'residual',duration_s:18,inputs:{x,residual:r}};
const residualTimeline=()=>createMathTimeline({caseId:'residual',duration:18,entries:[
  {stage:'input',start:0,end:4.5,settledAt:3},
  {stage:'branches',start:4.5,end:9,settledAt:8},
  {stage:'merging',start:9,end:13.5,settledAt:12},
  {stage:'output',start:13.5,end:18,settledAt:16.5}
]});
const meta=()=>({width:854,height:480,duration:18,stageTimeline:residualTimeline().meta});
function vectors(time,{correctionReveal=1,outputReveal=1,wrongTarget=false,offset=0,opacity=1}={}){
  const stage=residualTimeline().at(time).stage,f=createMathFrame(canvas(),{caseId:'residual',time,stage,inputs:{x,residual:r}});
  x.forEach((value,i)=>{
    const start={x:300,y:80+i*100},identity=f.vector('identity',i,{start,value,unitScale:100,color:'#ff0000',reveal:1});
    if(stage!=='input')f.vector('correction',i,{start:{x:identity.end.x+offset,y:identity.end.y},value:wrongTarget?r[i]*2:r[i],unitScale:100,color:'#ff0000',reveal:correctionReveal});
    if(stage==='output')f.vector('output',i,{start:{x:300,y:110+i*100},value:value+r[i],unitScale:100,color:'#ff0000',reveal:outputReveal,opacity});
  });
  return {...f.finish(),requestedTime:time};
}

test('timeline is detached, ordered, exact at boundaries and holds the last answer',()=>{
  const timeline=residualTimeline();
  assert.equal(timeline.at(4.5).stage,'branches');assert.equal(timeline.at(18).stage,'output');
  assert.equal(timeline.reveal('branches',8),1);assert.equal(timeline.opacity('output',18),1);
  assert.equal(timeline.opacity('input',10),0);assert.equal(timeline.opacity('input',10,{persist:true}),1);
  assert.throws(()=>timeline.at(-1),/within duration/);
  assert.throws(()=>createMathTimeline({caseId:'residual',duration:18,entries:timeline.meta.entries.map(p=>({...p,settledAt:p.end}))}),/settled time/);
  const malformed={...meta(),stageTimeline:{...timeline.meta,entries:timeline.meta.entries.map((p,i)=>({...p,start:p.start+(i===1?.1:0)}))}};
  assert.equal(checkStageTimeline(malformed,brief,6).passed,false);
});

test('explicit partial negative correction is valid before settling but keeps target checks',()=>{
  const frame=vectors(6,{correctionReveal:.4});
  assert.equal(frame.geometry.correction[0].end.x-frame.geometry.correction[0].start.x,-8);
  assert.equal(checkFrame(frame,brief,meta()).passed,true);
  const bad=vectors(6,{correctionReveal:.4,wrongTarget:true});
  assert.ok(checkFrame(bad,brief,meta()).findings.some(f=>f.code==='wrong_vector_target'));
});

test('forged actual geometry and absent timeline never become transition exemptions',()=>{
  const frame=vectors(6,{correctionReveal:.4});frame.geometry.correction[0].end.x+=1;
  assert.ok(checkFrame(frame,brief,meta()).findings.some(f=>f.code==='wrong_vector_geometry'));
  assert.ok(checkFrame(vectors(6,{correctionReveal:.4}),brief,{width:854,height:480}).findings.some(f=>f.code==='reveal_timeline_required'));
});

test('partial output checks its full sum; unfinished, invisible and wrong-origin outputs still fail',()=>{
  assert.equal(checkFrame(vectors(14.5,{outputReveal:.4}),brief,meta()).passed,true);
  assert.ok(checkFrame(vectors(17,{outputReveal:.4}),brief,meta()).findings.some(f=>f.code==='incomplete_vector_reveal'));
  assert.ok(checkFrame(vectors(17,{opacity:0}),brief,meta()).findings.some(f=>f.code==='invisible_required_vector'));
  const hidden=vectors(17,{opacity:0});hidden.geometry.output.forEach(v=>{delete v.reveal;delete v.targetValue;delete v.targetEnd;});
  assert.ok(checkFrame(hidden,brief,meta()).findings.some(f=>f.code==='invisible_required_vector'));
  assert.ok(checkFrame(hidden,brief,{width:854,height:480}).findings.some(f=>f.code==='invisible_required_vector'));
  assert.ok(checkFrame(vectors(17,{offset:10}),brief,meta()).findings.some(f=>f.code==='wrong_merge'));
});

test('a phase label cannot override the independently derived timeline phase',()=>{
  const frame=vectors(6,{correctionReveal:.4});frame.stage='output';
  assert.ok(checkFrame(frame,brief,meta()).findings.some(f=>f.code==='timeline_stage_mismatch'));
});

const logits=[-.8,.4,1.2],softBrief={id:'softmax',inputs:{logits},duration_s:18};
const softTimeline=()=>createMathTimeline({caseId:'softmax',duration:18,entries:['logits','exponential','shared-total','normalizing','normalized'].map((stage,i)=>({stage,start:i*3.6,end:(i+1)*3.6,settledAt:(i+1)*3.6-.9}))});
function masses(time,reveals,offset=0){
  const f=createMathFrame(canvas(),{caseId:'softmax',time,stage:softTimeline().at(time).stage,inputs:{logits}});
  logits.forEach((z,i)=>f.massBar(i,{x:100,y:100+i*70,width:offset+60*Math.exp(z),height:16,color:'#ff0000',reveal:reveals[i]}));
  return {...f.finish(),requestedTime:time};
}
const softMeta=()=>({width:854,height:480,duration:18,stageTimeline:softTimeline().meta});
test('staggered mass reveals validate targets without pretending actual ratios are settled',()=>{
  const frame=masses(4.5,[.2,.5,.8]),check=checkMassGeometry(frame,softBrief,softMeta());
  assert.equal(check.status,'target_only');assert.deepEqual(check.findings,[]);
  assert.ok(checkMassGeometry(masses(4.5,[.2,.5,.8],34),softBrief,softMeta()).findings.some(f=>f.code==='wrong_mass_geometry'));
  frame.geometry.massBars[0].width+=1;
  assert.ok(checkMassGeometry(frame,softBrief,softMeta()).findings.some(f=>f.code==='wrong_mass_reveal'));
  assert.ok(checkMassGeometry(masses(6.5,[.2,.5,.8]),softBrief,softMeta()).findings.some(f=>f.code==='incomplete_mass_reveal'));
});

test('opacity groups record effective alpha and restore it even when drawing throws',()=>{
  const f=createMathFrame(canvas(),{caseId:'softmax',time:1,stage:'logits',inputs:{logits}});
  f.layer(.5,()=>f.layer(.5,()=>f.text('nested','label',30,40,{opacity:.5})));
  assert.throws(()=>f.layer(.1,()=>{throw Error('deliberate draw error');}),/deliberate/);
  f.text('later','label',30,70);
  const state=f.finish();assert.equal(state.bounds[0].opacity,.125);assert.equal(state.bounds[1].opacity,1);
});

test('tiny and large exponential values require positive relative agreement',()=>{
  for(const z of ([-690,20])){
    const inputs={logits:[z,z+1,z+2]},time=6.5,timeline=softTimeline();
    const f=createMathFrame(canvas(),{caseId:'softmax',time,stage:'exponential',inputs});
    inputs.logits.forEach((value,i)=>f.massBar(i,{x:100,y:100+i*70,width:100*Math.exp(value-(z+2)),color:'#ff0000'}));
    const original={...f.finish(),requestedTime:time},b={id:'softmax',inputs};
    assert.equal(checkFrame(original,b,softMeta()).passed,true);
    const rounded=structuredClone(original);rounded.mechanism.masses=rounded.mechanism.masses.map(v=>v*(1+1e-11));rounded.mechanism.denominator*=1+1e-11;
    assert.equal(checkFrame(rounded,b,softMeta()).passed,true);
    const erased=structuredClone(original);erased.mechanism.masses[0]=0;erased.mechanism.denominator=0;
    const result=checkFrame(erased,b,softMeta());
    assert.ok(result.findings.some(f=>f.code==='wrong_mass'));assert.ok(result.findings.some(f=>f.code==='wrong_denominator'));
  }
});

test('translated output column is reported as a protocol layout limitation',()=>{
 const frame=vectors(17);frame.geometry.output.forEach(v=>{v.start.x+=200;v.end.x+=200;v.targetEnd.x+=200;});
 const result=checkFrame(frame,brief,meta());
 assert.ok(result.findings.some(f=>f.code==='output_origin_alignment'));
 assert.ok(!result.findings.some(f=>f.code==='wrong_merge'||f.code==='wrong_vector_geometry'));
});
