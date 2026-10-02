/** Browser regression for named timings and rapid failure recovery. No model or video export. */
import {mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {startStudio} from './studio.mjs';

const out=resolve(process.argv[2] || '/tmp/c2m-studio-smoke');
await mkdir(out); // Never overwrite a prior run.
const fixture=resolve('evaluation/2026-10-02/timing-bindings-v1/baseline');
const source=join(out,'source');await cp(fixture,source,{recursive:true});
const studio=await startStudio();
const preview=async(name,timing)=> {
  if(timing)await writeFile(join(source,'timing.json'),JSON.stringify(timing));
  const response=await fetch(studio.origin+'/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sceneRoot:source,out:join(out,name),arm:'infra',checksOnly:true,times:[1.8,5.5,9.8],timeoutS:5})});
  return response.json();
};
try {
  const baseline=await preview('baseline');assert.equal(baseline.status,'samples_ready');
  const changed=await preview('changed',{'turn-two':{start:4.85,end:6.85}});assert.equal(changed.status,'samples_ready');
  assert.deepEqual(changed.meta.timings['turn-two'],{start:4.85,end:6.85});
  const a=JSON.parse(await readFile(join(out,'baseline/states.json'))),b=JSON.parse(await readFile(join(out,'changed/states.json')));
  assert.equal(a.samples[0].sha256,b.samples[0].sha256);assert.equal(a.samples[2].sha256,b.samples[2].sha256);
  assert(b.samples[1].state.mechanism.angle>a.samples[1].state.mechanism.angle);
  const failed=await preview('invalid',{'turn-two':{start:8,end:6}});assert.equal(failed.status,'failed');assert.match(failed.error.message,/end > start/);
  const restored=await preview('restored',{'turn-two':{start:4.85,end:6.85}});assert.equal(restored.status,'samples_ready');
  assert(restored.determinism.passed);assert(restored.timing.total_s<5);
  console.log(JSON.stringify({passed:true,scope:'actual browser samples and injected invalid interval recovery; no artistic verdict',out}));
} finally {await studio.close();}
