import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFrame, checkVideo, softmaxReference } from '../tools/contracts.mjs';

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
  const result=checkFrame(frame(),{id:'residual',inputs:{}},meta);
  assert.ok(result.findings.some(x=>x.code==='unsupported_case'));
});
