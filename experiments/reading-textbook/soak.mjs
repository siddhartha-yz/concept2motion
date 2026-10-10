// A timed synthetic longevity probe, not a human reading or learning experiment.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH);
const {chromium}=require('playwright');
const out=path.resolve('evaluation/2026-10-10/reading-textbook-v1/raw/soak');
fs.mkdirSync(out,{recursive:true});
const seconds=Number(process.env.SOAK_SECONDS??1800);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>requests.push(r.url()));
await page.goto('http://127.0.0.1:8765/');
await page.waitForFunction(()=>!!window.readingLab);
const ids=await page.locator('.reading-step').evaluateAll(es=>es.map(e=>e.id));
for(const id of ['tensor-memory','softmax-change','intensity-limit'])await page.locator(`#${id}`).focus();
await page.waitForFunction(()=>window.readingLab.snapshot().rendered===3);
const session=await context.newCDPSession(page);
await session.send('Performance.enable');
await session.send('HeapProfiler.collectGarbage');
const started=Date.now(),samples=[];
let iterations=0,lastSample=-1;
while(Date.now()-started<seconds*1000){
  const id=ids[(iterations*7)%ids.length];
  await page.locator(`#${id}`).focus();
  if(iterations%20===19){
    await page.locator('#mode').selectOption('static');
    const before=await page.evaluate(()=>window.readingLab.snapshot().metrics.activations);
    await page.locator(`#${ids[(iterations+3)%ids.length]}`).focus();
    const after=await page.evaluate(()=>window.readingLab.snapshot().metrics.activations);
    if(before!==after)errors.push('static mode unexpectedly activated during soak');
    await page.locator('#mode').selectOption('pointer');
  }
  const elapsed=Math.floor((Date.now()-started)/1000);
  if(Math.floor(elapsed/30)!==lastSample){
    lastSample=Math.floor(elapsed/30);
    const s=await page.evaluate(()=>window.readingLab.snapshot());
    const perf=await session.send('Performance.getMetrics');
    const metrics=Object.fromEntries(perf.metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents','LayoutCount','TaskDuration'].includes(m.name)).map(m=>[m.name,m.value]));
    const sample={elapsedSeconds:elapsed,iterations,metrics,rendered:s.rendered,events:s.events.length,seekSamples:s.seekMs.length,activations:s.metrics.activations,errors:s.errors};
    samples.push(sample);fs.appendFileSync(path.join(out,'samples.jsonl'),JSON.stringify(sample)+'\n');
    console.log(JSON.stringify(sample));
  }
  iterations++;await page.waitForTimeout(3000);
}
await session.send('HeapProfiler.collectGarbage');
const finalPerf=await session.send('Performance.getMetrics');
const final=await page.evaluate(()=>window.readingLab.snapshot());
await page.screenshot({path:path.join(out,'final.png')});
await page.evaluate(()=>window.readingLab.dispose());
const report={schema:1,scope:'Synthetic timed browser focus/static traversal. No human learner, no retention or transfer outcome.',plannedSeconds:seconds,actualSeconds:(Date.now()-started)/1000,iterations,samples,finalMetrics:finalPerf.metrics,final,errors,wasmRequests:requests.filter(u=>u.endsWith('.wasm')).length,passed:errors.length===0&&final.errors.length===0&&final.rendered===3&&final.events.length<=200&&final.seekMs.length<=500};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2)+'\n');
await context.close();await browser.close();
console.log(JSON.stringify({passed:report.passed,iterations,actualSeconds:report.actualSeconds}));
process.exitCode=report.passed?0:1;
