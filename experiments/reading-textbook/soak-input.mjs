// Real browser mouse/scroll input driven by a synthetic trace. No human learner.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH),{chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.env.CHECK_OUTPUT??path.join(root,'evaluation/2026-10-10/reading-textbook-v1/raw/input-soak'));fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const reports=[];
const duration=Number(process.env.INPUT_PHASE_SECONDS??600);
const sourceHashes=Object.fromEntries(['app.mjs','controls.mjs','scenes.mjs','style.css','content.json'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'experiments/reading-textbook',n))).digest('hex')]));
fs.writeFileSync(path.join(out,'run-meta.json'),JSON.stringify({startedAt:new Date().toISOString(),plannedPhaseSeconds:duration,sourceHashes},null,2)+'\n');
for(const mobile of [false,true]){
  const name=mobile?'touch-scroll':'mouse';
  const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:900}});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/');await page.waitForFunction(()=>!!window.readingLab);
  const ids=await page.locator('.reading-step').evaluateAll(es=>es.map(e=>e.id));
  const start=Date.now();let iterations=0,lastLog=-1;
  while(Date.now()-start<duration*1000){
    const id=ids[(iterations*7)%ids.length];
    if(mobile){
      await page.locator(`#${id}`).evaluate(el=>{const r=el.getBoundingClientRect();window.scrollBy(0,r.top+r.height/2-innerHeight*.76);});
      await page.waitForTimeout(280);
    }else{
      await page.locator(`#${id}`).evaluate(el=>el.scrollIntoView({block:'end'}));
      await page.mouse.move(20,80);await page.locator(`#${id}`).hover();await page.waitForTimeout(220);
    }
    const snapshot=await page.evaluate(()=>window.readingLab.snapshot());
    if(snapshot.active!==id)errors.push(`${name} iteration ${iterations}: expected ${id}, active ${snapshot.active}`);
    if(snapshot.errors.length)errors.push(...snapshot.errors);
    const seconds=Math.floor((Date.now()-start)/1000);
    if(Math.floor(seconds/30)!==lastLog){lastLog=Math.floor(seconds/30);const record={phase:name,seconds,iterations,active:snapshot.active,rendered:snapshot.rendered,activations:snapshot.metrics.activations,errors:errors.length};fs.appendFileSync(path.join(out,'events.jsonl'),JSON.stringify(record)+'\n');console.log(JSON.stringify(record));}
    iterations++;await page.waitForTimeout(1700);
  }
  const final=await page.evaluate(()=>window.readingLab.snapshot());await page.screenshot({path:path.join(out,`${name}-final.png`)});
  reports.push({phase:name,iterations,actualSeconds:(Date.now()-start)/1000,errors,final});
  fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({complete:false,sourceHashes,phases:reports},null,2)+'\n');await ctx.close();
}
const result={scope:'Timed synthetic trace through actual browser mouse and scroll input. Not a human reading, gaze, retention, transfer or learning-efficiency experiment.',sourceHashes,phases:reports,passed:reports.every(r=>r.errors.length===0)};fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:result.passed,phases:reports.map(r=>({phase:r.phase,iterations:r.iterations,errors:r.errors.length,actualSeconds:r.actualSeconds}))}));process.exitCode=result.passed?0:1;
