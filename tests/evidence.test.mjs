import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFrame} from '../tools/capture_frame.mjs';
import {checkFrame,checkMassGeometry} from '../tools/contracts.mjs';
import {createMathFrame} from '../runtime/math-frame.mjs';

function canvas(){
  const calls=[],ctx=new Proxy({calls,measureText:t=>({width:t.length*10,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3}),
    getImageData:()=>({data:[255,0,0,255]})},{get:(o,k)=>k in o?o[k]:(...a)=>calls.push([k,...a])});
  return {width:854,height:480,getContext:()=>ctx,toDataURL:()=> 'data:image/jpeg;base64,cGl4ZWxz',ctx};
}
function withBrowser(state,run){
  const originalWindow=globalThis.window,originalDocument=globalThis.document,c=canvas();
  globalThis.window={C2M:{meta:{width:854,height:480,caseId:'residual'},render:()=>state}};
  globalThis.document={getElementById:()=>c};
  try{return run(c);}finally{globalThis.window=originalWindow;globalThis.document=originalDocument;}
}
test('drawing remains capturable with null evidence or missing output registry',()=>{
  withBrowser(null,()=>{const r=captureFrame({t:1});assert.ok(r.data);assert.equal(r.captureFindings[0].code,'missing_frame_evidence');});
  withBrowser({stage:'output',geometry:{vectors:[]}},()=>{
    const r=captureFrame({t:1});assert.ok(r.data);assert.deepEqual(r.pixels,[]);
    assert.equal(checkFrame(r.state,{id:'residual',inputs:{x:[1,2,3],residual:[0,0,0]}},{width:854,height:480}).passed,false);
  });
});
test('malformed pixel probes are findings, not capture exceptions',()=>{
  withBrowser({stage:'output',geometry:{output:[{id:'x',start:{x:1,y:1},end:null}]}},()=>{
    const r=captureFrame({t:1});assert.ok(r.data);assert.equal(r.captureFindings[0].code,'invalid_pixel_probe');
  });
});
const inputs={logits:[-.8,.4,1.2]},brief={id:'softmax',inputs};
test('correct numbers cannot conceal an additive offset in mass bar widths',()=>{
  const build=offset=>{
    const f=createMathFrame(canvas(),{caseId:'softmax',time:4,stage:'exponential',inputs});
    inputs.logits.forEach((z,i)=>f.massBar(i,{x:100,y:100+i*50,width:offset+34*Math.exp(z),color:'#ff0000'}));
    return f.finish();
  };
  assert.equal(checkMassGeometry(build(0),brief).status,'checked');
  assert.deepEqual(checkMassGeometry(build(0),brief).findings,[]);
  assert.ok(checkMassGeometry(build(34),brief).findings.every(f=>f.code==='wrong_mass_geometry'));
  assert.equal(checkFrame({...build(34),requestedTime:4},brief,{width:854,height:480}).passed,false);
});
test('unidentified/transient bars cannot masquerade as verified mass geometry',()=>{
  assert.equal(checkMassGeometry({stage:'exponential',bounds:[]},brief).status,'unavailable');
  const frame={stage:'exponential',bounds:[0,1,2].map(i=>({id:`mass-${i}`,kind:'shape',width:10,opacity:.3}))};
  assert.equal(checkMassGeometry(frame,brief).status,'transient');
  frame.bounds.forEach(b=>b.opacity=1);assert.equal(checkMassGeometry(frame,brief).findings.length,3);
});
test('residual drawing automatically preserves signed endpoint geometry and evidence isolation',()=>{
  const c=canvas(),x=[.8,-.6,.3],r=[-.2,.4,-.1],f=createMathFrame(c,{caseId:'residual',time:16,stage:'output',inputs:{x,residual:r}});
  x.forEach((v,i)=>{
    const a=f.vector('identity',i,{start:{x:300,y:100+i*90},value:v,unitScale:100,color:'#ff0000'});
    f.vector('correction',i,{start:a.end,value:r[i],unitScale:100,color:'#ff0000'});
    f.vector('output',i,{start:{x:300,y:130+i*90},value:v+r[i],unitScale:100,color:'#ff0000'});
  });
  const state=f.finish();assert.equal(state.geometry.output[1].end.x,280);
  assert.equal(checkFrame({...state,requestedTime:16},{id:'residual',inputs:{x,residual:r}},{width:854,height:480}).passed,true);
  state.geometry.output[1].end.x=999;assert.equal(f.finish().geometry.output[1].end.x,280);
});

test('class labels cannot collide with internal probability segment identities',()=>{
  const f=createMathFrame(canvas(),{caseId:'softmax',time:16,stage:'normalized',inputs});
  [0,1,2].forEach(i=>f.text(`class-${i}`,`class ${i}`,20,20+i*30));
  const weights=inputs.logits.map(Math.exp),sum=weights.reduce((a,b)=>a+b,0);
  f.partition({x:200,y:200,width:300,height:20},weights.map(w=>({probability:w/sum,color:'#ff0000'})));
  const snapshot=f.finish();
  assert.equal(new Set(snapshot.bounds.map(b=>b.id)).size,6);
  assert.ok(snapshot.bounds.every(b=>b.id===`${b.kind}:${b.sourceId}`));
  assert.deepEqual(snapshot.geometry.segments.map(s=>s.id),['class-0','class-1','class-2']);
  assert.equal(checkFrame({...snapshot,requestedTime:16},brief,{width:854,height:480}).passed,true);
  assert.throws(()=>f.text('class-0','repeat',20,20),/Duplicate text drawing ID "class-0"/);
});

test('invalid vector roles identify the bad argument and the supported input-path role',()=>{
  const f=createMathFrame(canvas(),{caseId:'residual',time:1,stage:'input',inputs:{x:[1,2,3],residual:[0,0,0]}});
  assert.throws(()=>f.vector('input',0,{start:{x:100,y:100},value:1,unitScale:10,color:'#ff0000'}),/role=input.*Use identity/);
});

test('short transient probes are unavailable rather than false pure-color matches',()=>{
  withBrowser({stage:'output',geometry:{output:[{id:'output-0',start:{x:100,y:100},end:{x:100.4,y:100},reveal:.02,opacity:1,strokeWidth:4,color:'#ff0000'}]}},()=>{
    const capture=captureFrame({t:14});assert.deepEqual(capture.pixels,[]);
    assert.equal(capture.pixelCoverage.unavailable,1);assert.equal(capture.pixelCoverage.sampled,0);
    assert.match(capture.pixelCoverage.skipped[0].reason,/short partial vector/);
  });
});

test('authors can reuse computed targets and measured text without mutating evidence',()=>{
  const f=createMathFrame(canvas(),{caseId:'softmax',time:1,stage:'logits',inputs});
  assert.throws(()=>{f.values.logits[0]=99;},TypeError);
  const rect=f.text('label','target',20,40);
  f.massBar(0,{x:rect.x+rect.width+12,y:30,width:60*f.values.masses[0],color:'#ff0000'});
  const snapshot=f.finish();assert.equal(snapshot.mechanism.logits[0],-.8);
  assert.equal(snapshot.geometry.massBars[0].x,92);
});

test('raw exponential precision failures are explicit instead of plausible wrong probabilities',()=>{
  for(const logits of [[-745,-744,-743],[-1000,.7,1.3],[709,709,709]])
    assert.throws(()=>createMathFrame(canvas(),{caseId:'softmax',time:0,stage:'logits',inputs:{logits}}),/positive finite precision range/);
  for(const logits of [[-690,-689,-688],[700,699,698],[0,0,0]]){
    const f=createMathFrame(canvas(),{caseId:'softmax',time:0,stage:'logits',inputs:{logits}});
    assert.equal(f.values.probabilities.length,3);
  }
});

test('massBar returns the immutable actual rectangle for an adjacent label',()=>{
  const f=createMathFrame(canvas(),{caseId:'softmax',time:4,stage:'exponential',inputs:{logits:[0,1,2]}});
  const rect=f.massBar(0,{x:100,y:100,width:80,height:20,color:'#ff0000',reveal:.25});
  assert.deepEqual(rect,{x:100,y:100,width:20,height:20});assert(Object.isFrozen(rect));
  f.text('label','target mass',rect.x+rect.width+10,rect.y+15);
  const snapshot=f.finish();assert.equal(snapshot.geometry.massBars[0].width,20);assert.equal(snapshot.geometry.massBars[0].targetWidth,80);
});

test('malformed pixel color references become findings and cannot abort diagnostic export',async()=>{
 const {checkCaptured}=await import('../tools/contracts.mjs');
 const f=createMathFrame(canvas(),{caseId:'softmax',time:1,stage:'logits',inputs:{logits:[0,1,2]}});
 const result=checkCaptured({state:{...f.finish(),requestedTime:1},pixels:[{id:'bad-type',expected:123,color:[0,0,0]},{id:'bad-pixel',expected:'#ff0000',color:[NaN,0,0]}],captureFindings:[]},{id:'softmax',inputs:{logits:[0,1,2]}},{width:854,height:480});
 assert.ok(result.findings.some(f=>f.code==='missing_pixel_reference'));assert.ok(result.findings.some(f=>f.code==='pixel_mismatch'));
});
