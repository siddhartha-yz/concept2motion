import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFrame, checkVideo, checkCoverage, softmaxReference } from '../tools/contracts.mjs';

const brief = { id: 'softmax', inputs: { logits: [-1, 0.6, 1.8] } };
const meta = { width: 1920, height: 1080, duration: 12, fps: 60 };
const p = softmaxReference(brief.inputs.logits);
const frame = () => ({ time: 11, requestedTime: 11, stage: 'normalized', bounds: [],
  mechanism: { logits: brief.inputs.logits, masses: brief.inputs.logits.map(Math.exp),
    denominator: brief.inputs.logits.map(Math.exp).reduce((a,b) => a+b,0), probabilities: p },
  geometry: { capacity: { x: 100, width: 1000 }, segments: p.map((v, i) => ({
    id: `class-${i}`, x: 100 + p.slice(0,i).reduce((a,b) => a+b,0)*1000, width: v*1000
  })) }
});
test('stable reference handles large logits and common shifts', () => {
  assert.ok(softmaxReference([1001,1002,1003]).every(Number.isFinite));
  softmaxReference([999,1000.6,1001.8]).forEach((v,i) => assert.ok(Math.abs(v-p[i])<1e-12));
});
test('valid measured probability partition passes', () => assert.equal(checkFrame(frame(),brief,meta).passed,true));
test('sum-to-one alone does not validate softmax', () => {
  const f = frame(); f.mechanism.probabilities=[1/3,1/3,1/3];
  assert.ok(checkFrame(f,brief,meta).findings.some(x => x.code==='wrong_probability'));
});
test('correct numbers with incorrect rendered geometry fail', () => {
  const f = frame(); f.geometry.segments[0].width=250;
  assert.ok(checkFrame(f,brief,meta).findings.some(x => x.code==='wrong_geometry'));
});
test('clipping and overlapping labels produce actionable evidence', () => {
  const f=frame(); f.bounds=[{id:'a',kind:'text',x:-10,y:100,width:100,height:40,opacity:1},
    {id:'b',kind:'text',x:20,y:105,width:100,height:40,opacity:1}];
  const codes=checkFrame(f,brief,meta).findings.map(x=>x.code);
  assert.ok(codes.includes('clipped')); assert.ok(codes.includes('text_overlap'));
});
test('wall-clock screencast timing drift fails the video contract', () => {
  const stream={width:1920,height:1080,r_frame_rate:'30/1',nb_frames:'528',duration:'17.6'};
  const result=checkVideo(stream,{...meta,fps:30});
  assert.ok(result.findings.includes('frame_count')); assert.ok(result.findings.includes('duration'));
});
test('unsupported cases cannot silently pass an empty validation', () => {
  const result=checkFrame(frame(),{id:'gru',inputs:{}},meta);
  assert.ok(result.findings.some(x=>x.code==='unsupported_case'));
});

const residualBrief={id:'residual',inputs:{x:[1,-0.5,0.25],residual:[0.2,0.4,-0.1]}};
function residualFrame(){
  const {x,residual}=residualBrief.inputs,output=x.map((v,i)=>v+residual[i]),scale=240;
  const vector=(id,i,start,value,y=400+i*100)=>({id:`${id}-${i}`,start:{x:start,y},end:{x:start+value*scale,y}});
  return {time:11,requestedTime:11,stage:'output',bounds:[],mechanism:{input:x,identity:x,correction:residual,output},
    geometry:{unitScale:scale,identity:x.map((v,i)=>vector('identity',i,850,v)),
      correction:residual.map((v,i)=>vector('correction',i,850+x[i]*scale,v)),
      output:output.map((v,i)=>vector('output',i,850,v,432+i*100))}};
}
test('signed residual addition and head-to-tail geometry pass',()=>assert.equal(checkFrame(residualFrame(),residualBrief,meta).passed,true));
test('identity branch cannot alter input even when the final output is correct',()=>{
  const f=residualFrame();f.mechanism.identity=[0.9,-0.5,0.25];
  assert.ok(checkFrame(f,residualBrief,meta).findings.some(x=>x.code==='residual_mechanism'));
});
test('a negative residual output drawn in the positive direction is rejected',()=>{
  const f=residualFrame();f.geometry.output[1].end.x=874;
  assert.ok(checkFrame(f,residualBrief,meta).findings.some(x=>x.code==='wrong_vector_geometry'));
});
test('correct signed lengths at a separate origin are not a componentwise merge',()=>{
  const f=residualFrame();f.geometry.correction[0].start.x+=30;f.geometry.correction[0].end.x+=30;
  assert.ok(checkFrame(f,residualBrief,meta).findings.some(x=>x.code==='wrong_merge'));
});
test('missing geometry and concatenated outputs cannot pass',()=>{
  const f=residualFrame();f.mechanism.output=[...residualBrief.inputs.x,...residualBrief.inputs.residual];delete f.geometry.identity;
  const codes=checkFrame(f,residualBrief,meta).findings.map(x=>x.code);
  assert.ok(codes.includes('residual_mechanism'));assert.ok(codes.includes('missing_vectors'));
});
test('stage coverage rejects omitted or reversed steps',()=>{
  const frames=['input','input','branches','merging','output'].map(stage=>({stage}));
  assert.equal(checkCoverage(frames,residualBrief).passed,true);
  assert.equal(checkCoverage(frames.filter(f=>f.stage!=='branches'),residualBrief).passed,false);
  assert.equal(checkCoverage([...frames].reverse(),residualBrief).passed,false);
});
test('moving shapes cannot cover a readable caption',()=>{
  const f=residualFrame();f.bounds=[
    {id:'caption',kind:'text',x:740,y:340,width:440,height:24,opacity:1},
    {id:'identity-0',kind:'shape',x:850,y:342,width:240,height:18,opacity:1}
  ];
  assert.ok(checkFrame(f,residualBrief,meta).findings.some(x=>x.code==='text_shape_overlap'));
});
