/** Measured native math draft intervals and injected failure recovery, zero models. */
import {mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {startStudio} from './studio.mjs';
const out=resolve(process.argv[2]);await mkdir(out);
const repo=resolve('.'),sha=data=>createHash('sha256').update(data).digest('hex');
const scenarios=[
 {id:'softmax-generated-samples',source:'work/model-infra-pilot-v3/candidates/softmax-2-C/v2/source',brief:{id:'softmax',duration_s:18,inputs:{logits:[-1,.7,1.3]}},from:13,to:15,times:[4,8,14,17],checksOnly:true,expected:'pass'},
 {id:'softmax-generated-clip',source:'work/model-infra-pilot-v3/candidates/softmax-2-C/v2/source',brief:{id:'softmax',duration_s:18,inputs:{logits:[-1,.7,1.3]}},from:13,to:15,times:[14,17],expected:'pass'},
 {id:'residual-generated-clip',source:'work/model-infra-pilot-v3/candidates/residual-1-C/v2/source',brief:{id:'residual',duration_s:18,inputs:{x:[.7,-.4,.2],residual:[-.2,.15,-.3]}},from:9,to:12,times:[9,11,17],expected:'pass'},
 {id:'incomplete-reveal',source:'evaluation/2026-10-03/progress-controls-v2/sources/residual-never-finished',from:13.5,to:18,times:[14,17.5],expected:'incomplete_vector_reveal'},
 {id:'overpaint',source:'evaluation/2026-10-03/progress-controls-v2/sources/softmax-overpaint',from:15,to:17,times:[17],checksOnly:true,expected:'pixel_mismatch'}
];
const report={kind:'actual browser native previews, diagnostic mathematical checks and encoded clips; no new model generation or artistic verdict',model_calls:0,scenarios:[],tooling:{}};
for(const name of ['studio.mjs','contracts.mjs','capture_frame.mjs','math_preview_smoke.mjs'])report.tooling[name]=sha(await readFile(join(repo,'tools',name)));
await writeFile(join(out,'plan.json'),JSON.stringify({scenarios,tooling:report.tooling},null,2));
const studio=await startStudio();report.startup=studio.ready;
const post=async(cfg)=>{
 const source=resolve(cfg.source),brief=cfg.brief??JSON.parse(await readFile(join(source,'brief.json')));
 const body={sceneRoot:source,out:join(out,cfg.id),arm:'math',brief,from:cfg.from,to:cfg.to,fps:12,width:960,times:cfg.times,checksOnly:cfg.checksOnly??false,timeoutS:15};
 const response=await fetch(studio.origin+'/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();report.scenarios.push({id:cfg.id,expected:cfg.expected,http_status:response.status,result});
 await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));return result;
};
const processResult=async(command,args)=>{const c=spawn(command,args,{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';c.stdout.on('data',v=>stdout+=v);c.stderr.on('data',v=>stderr+=v);const [code]=await once(c,'close');assert.equal(code,0,stderr);return stdout;};
try{
 for(const scenario of scenarios){
  const result=await post(scenario);assert.equal(result.status,scenario.checksOnly?'samples_ready':'preview_ready');assert(result.determinism.passed);
  if(scenario.expected==='pass')assert(result.math_checks.passed,JSON.stringify(result.math_checks.findings.slice(0,3)));
  else assert(result.math_checks.findings.some(f=>f.code===scenario.expected));
  if(result.video){
   const video=join(out,scenario.id,'preview.mp4'),stream=JSON.parse(await processResult(process.env.C2M_FFPROBE||'ffprobe',['-v','error','-select_streams','v:0','-show_streams','-of','json',video])).streams[0];
   assert.equal(Number(stream.nb_frames),Math.round((scenario.to-scenario.from)*12));assert.equal(stream.width,960);assert.equal(stream.height,540);
   await processResult(process.env.C2M_FFMPEG||'ffmpeg',['-v','error','-i',video,'-f','null','-']);report.scenarios.at(-1).full_decode_passed=true;
  }
 }
 const valid=scenarios[0],bad=join(out,'draw-exception-source');await cp(resolve(valid.source),bad,{recursive:true});
 const scene=await readFile(join(bad,'scene.js'),'utf8');await writeFile(join(bad,'scene.js'),scene.replace('function draw(t){','function draw(t){ throw Error("controlled drawing failure");'));
 const failed=await post({...valid,id:'draw-exception',source:bad,expected:'failed'});assert.equal(failed.status,'failed');assert.match(failed.error.message,/controlled drawing failure/);
 const recovery=await post({...valid,id:'after-exception',expected:'pass'});assert.equal(recovery.status,'samples_ready');assert(recovery.math_checks.passed);assert(recovery.timing.total_s<5);
 report.passed=true;await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,startup_s:studio.ready.startup_s,model_calls:0,scenarios:report.scenarios.map(s=>({id:s.id,status:s.result.status,total_s:s.result.timing.total_s,math_pass:s.result.math_checks?.passed,full_decode:s.full_decode_passed??false}))}));
}finally{await studio.close();}
