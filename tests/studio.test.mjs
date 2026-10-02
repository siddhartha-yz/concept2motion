import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateRequest,safeAssetPath,freezeSource} from '../tools/studio.mjs';

test('local intervals use exact frame counts, positive bounded times and no source overwrite',()=>{
  const valid={sceneRoot:'/tmp/source',out:'/tmp/output',arm:'infra',from:4.75,to:7.75,fps:24,width:960};
  assert.equal(validateRequest(valid).frames,72);
  assert.equal(validateRequest(valid).height,540);
  for(const change of [{from:-1},{to:11},{fps:0},{width:961},{times:[NaN]},{out:'/tmp/source/output'},{from:4.76}])assert.throws(()=>validateRequest({...valid,...change}));
});

test('asset paths reject traversal and unsupported files',()=>{
  assert.equal(safeAssetPath('/tmp/frozen','runtime/a.mjs'),'/tmp/frozen/runtime/a.mjs');
  assert.throws(()=>safeAssetPath('/tmp/frozen','../../secret.json'));
  assert.throws(()=>safeAssetPath('/tmp/frozen','log.txt'));
});

test('source and runtime are frozen; existing output is never reused',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'c2m-studio-'));
  try {
    const source=join(temp,'scene'), runtime=join(temp,'runtime'),out=join(temp,'out');
    await mkdir(source);await mkdir(runtime);
    await writeFile(join(source,'scene.mjs'),'export const version=1;');
    await writeFile(join(runtime,'concept-runtime.mjs'),'export const version=2;');
    const saved=await freezeSource(source,out,runtime);
    assert.equal(saved.sources.length,2);
    await writeFile(join(source,'scene.mjs'),'changed');
    assert.equal(await readFile(join(out,'source','scene.mjs'),'utf8'),'export const version=1;');
    assert.equal(await readFile(join(out,'source','runtime','concept-runtime.mjs'),'utf8'),'export const version=2;');
    await assert.rejects(freezeSource(source,out,runtime),/EEXIST/);
  }finally{await rm(temp,{recursive:true,force:true});}
});

test('failure after exclusive creation leaves owned output and cannot be overwritten',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'c2m-studio-failure-'));
  try {
    const source=join(temp,'scene'),runtime=join(temp,'runtime'),out=join(temp,'out');
    await mkdir(source);await mkdir(runtime);
    await writeFile(join(runtime,'concept-runtime.mjs'),'export {};');
    let created=false;
    await assert.rejects(freezeSource(source,out,runtime,()=>{created=true;}),/ENOENT/);
    assert.equal(created,true);
    await assert.rejects(freezeSource(source,out,runtime),/EEXIST/);
  }finally{await rm(temp,{recursive:true,force:true});}
});

test('checksOnly and timeout boundaries are explicit rather than silently coerced',()=>{
  const base={sceneRoot:'/tmp/source',out:'/tmp/output',arm:'infra'};
  assert.equal(validateRequest({...base,checksOnly:true}).checksOnly,true);
  assert.equal(validateRequest(base).timeoutS,60);
  assert.equal(validateRequest({...base,timeoutS:1}).timeoutS,1);
  for(const change of [{checksOnly:'yes'},{checksOnly:true,times:[]},{timeoutS:0},{timeoutS:61},{timeoutS:NaN}])assert.throws(()=>validateRequest({...base,...change}));
});

test('only frozen infra timing objects reach the loader; direct refuses an unbound timing file',async()=>{
  const {readTimingOverride,loader}=await import('../tools/studio.mjs');
  const temp=await mkdtemp(join(tmpdir(),'c2m-studio-timing-'));
  try {
    assert.equal(await readTimingOverride(temp,'infra'),null);
    for(const text of ['null','[]','1','"not an object"','{broken']) {
      await writeFile(join(temp,'timing.json'),text);
      await assert.rejects(readTimingOverride(temp,'infra'));
    }
    await writeFile(join(temp,'timing.json'),'{"turn-two":[4.85,6.85]}');
    const override=await readTimingOverride(temp,'infra');
    assert.deepEqual(override.timings,{'turn-two':[4.85,6.85]});
    assert.equal(override.sha256.length,64);
    assert.match(loader('infra',override),/timings:\{"turn-two":\[4\.85,6\.85\]\}/);
    await assert.rejects(readTimingOverride(temp,'direct'),/requires the infra/);
    const escaped=loader('infra',{timings:{unsafe:'</script>'}});
    assert.equal((escaped.match(/<\/script>/g)||[]).length,1);
  }finally{await rm(temp,{recursive:true,force:true});}
});

test('timing.json is snapshotted without rewriting scene source',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'c2m-studio-snapshot-timing-'));
  try {
    const source=join(temp,'scene'),runtime=join(temp,'runtime'),out=join(temp,'out');
    await mkdir(source);await mkdir(runtime);
    const scene='export function createScene(rt) { return rt.scene({}); }';
    await writeFile(join(source,'scene.mjs'),scene);
    await writeFile(join(source,'timing.json'),'{"turn-two":[4.85,6.85]}');
    await writeFile(join(runtime,'concept-runtime.mjs'),'export {};');
    const {sources}=await freezeSource(source,out,runtime);
    assert(sources.some(s=>s.path==='timing.json'&&s.sha256.length===64));
    assert.equal(await readFile(join(out,'source','scene.mjs'),'utf8'),scene);
    await writeFile(join(source,'timing.json'),'{}');
    assert.equal(await readFile(join(out,'source','timing.json'),'utf8'),'{"turn-two":[4.85,6.85]}');
  }finally{await rm(temp,{recursive:true,force:true});}
});
