import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH),{chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.env.CHECK_OUTPUT??path.join(root,'evaluation/2026-10-10/reading-textbook-v1/raw/frames'));fs.mkdirSync(out,{recursive:true});
const content=JSON.parse(fs.readFileSync(path.join(root,'experiments/reading-textbook/content.json')));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const ctx=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});const p=await ctx.newPage();
await p.goto('http://127.0.0.1:8765/');await p.waitForFunction(()=>!!window.readingLab);
const frames=[],bench=[];
for(const unit of content.units){
  for(const paragraph of unit.paragraphs){
    await p.locator(`#${paragraph.id}`).focus();await p.waitForFunction(id=>document.querySelector(`#${id} .mechanism`).classList.contains('ready'),unit.id);
    const file=path.join(out,`${unit.id}-${paragraph.state}.png`);await p.locator(`#${unit.id} .mechanism`).screenshot({path:file});
    const bytes=fs.readFileSync(file);frames.push({unit:unit.id,state:paragraph.state,time:unit.states[paragraph.state].time,paragraph:paragraph.id,file:path.relative(root,file),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  }
  // The timer covers synchronous seek/render work, not browser display latency.
  const timings=await p.evaluate(id=>{
    const values=[];for(let i=0;i<600;i++)values.push(window.readingLab.seekForCheck(id,[0,3,1,2][i%4]));return values;
  },unit.id);
  const sorted=[...timings].sort((a,b)=>a-b);bench.push({unit:unit.id,samples:timings.length,medianMs:sorted[300],p95Ms:sorted[569],maximumMs:sorted.at(-1),rawMs:timings});
}
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const m=await mobile.newPage();await m.goto('http://127.0.0.1:8765/');await m.waitForFunction(()=>!!window.readingLab);
for(const id of ['tensor-memory','softmax-change','intensity-limit']){await m.locator(`#${id}`).focus();await m.waitForFunction(id=>document.querySelector(`#${id}`).closest('.reading-unit').querySelector('.mechanism').classList.contains('ready'),id);await m.screenshot({path:path.join(out,`mobile-${id}.png`)});}
await p.locator('#tensor-split').focus();await p.screenshot({path:path.join(out,'reading-context.png')});
const result={scope:'Actual deterministic browser frame sampling and synchronous seek timing on this host; not human learning, GPU throughput or end-to-end display latency',frames,bench,sourceHashes:Object.fromEntries(['app.mjs','scenes.mjs','math.mjs','content.json'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'experiments/reading-textbook',n))).digest('hex')]))};
fs.writeFileSync(path.join(out,'samples.json'),JSON.stringify(result,null,2)+'\n');await mobile.close();await ctx.close();await browser.close();console.log(JSON.stringify({frames:frames.length,bench:bench.map(({rawMs,...r})=>r)}));
