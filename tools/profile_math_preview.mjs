/** Paired cold/warm local preview latency; same source, times, checks and encoding. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {startStudio} from './studio.mjs';
const out=resolve(process.argv[2]);await mkdir(out);const source=resolve('work/model-infra-pilot-v3/candidates/softmax-2-C/v2/source');
const brief={id:'softmax',duration_s:18,inputs:{logits:[-1,.7,1.3]}},sha=x=>createHash('sha256').update(x).digest('hex');
const report={kind:'paired actual local encode latency; no models, creative revisions or artistic judgement',repeats:8,source,source_sha256:sha(await readFile(join(source,'scene.js'))),scope:'Cold includes browser boot; warm boot recorded once and amortized separately. Same 2-second 24-frame clip, 960x540 12fps, checks, samples and encoder.',records:[],tooling:{}};
for(const name of ['studio.mjs','contracts.mjs','capture_frame.mjs','profile_math_preview.mjs'])report.tooling[name]=sha(await readFile(join('tools',name)));
await writeFile(join(out,'plan.json'),JSON.stringify({...report,records:undefined},null,2));const warm=await startStudio();report.warm_startup_s=warm.ready.startup_s;
async function trial(studio,arm,i,started){
 const response=await fetch(studio.origin+'/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sceneRoot:source,out:join(out,`${arm}-${i}`),arm:'math',brief,from:13,to:15,fps:12,width:960,times:[14,17],timeoutS:10})});
 const result=await response.json();const elapsed_s=(performance.now()-started)/1000;
 assert.equal(result.status,'preview_ready');assert(result.math_checks.passed);assert(result.determinism.passed);
 const video_sha256=sha(await readFile(join(out,`${arm}-${i}`,'preview.mp4')));
 report.records.push({arm,repeat:i,elapsed_s,boot_s:arm==='cold'?studio.ready.startup_s:0,job_s:result.timing.total_s,video_sha256,source_sha256:result.sources.find(s=>s.path==='scene.js').sha256,pixel_coverage:result.math_checks.pixel_coverage});
 await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));
}
try{
 for(let i=0;i<8;i++){
  // Alternate the within-pair order to reduce monotonic drift effects.
  for(const arm of (i%2?['warm','cold']:['cold','warm'])){
   if(arm==='warm')await trial(warm,arm,i,performance.now());
   else{const began=performance.now(),studio=await startStudio();try{await trial(studio,arm,i,began);}finally{await studio.close();}}
  }
 }
 const stats=values=>{values=values.toSorted((a,b)=>a-b);return {n:values.length,min_s:values[0],median_s:(values[3]+values[4])/2,max_s:values.at(-1)};};
 report.statistics={cold:stats(report.records.filter(r=>r.arm==='cold').map(r=>r.elapsed_s)),warm:stats(report.records.filter(r=>r.arm==='warm').map(r=>r.elapsed_s))};
 report.warm_boot_amortized_s_per_job=report.warm_startup_s/8;
 report.unique_video_hashes=new Set(report.records.map(r=>r.video_sha256)).size;report.all_source_hashes_unchanged=report.records.every(r=>r.source_sha256===report.source_sha256);
 assert.equal(report.unique_video_hashes,1);assert(report.all_source_hashes_unchanged);report.passed=true;
 await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,statistics:report.statistics,warm_boot_amortized_s_per_job:report.warm_boot_amortized_s_per_job,unique_video_hashes:report.unique_video_hashes}));
}finally{await warm.close();}
