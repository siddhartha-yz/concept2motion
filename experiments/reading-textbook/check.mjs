import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {ReadingController} from './controls.mjs';
import {tensorCells,stableSoftmax,roofline} from './math.mjs';

const out=path.resolve(process.env.CHECK_OUTPUT??'evaluation/2026-10-10/reading-textbook-v1/raw/browser-v1');
fs.mkdirSync(out,{recursive:true});
const checks=[], artifacts=[];
async function check(name,fn) {
  const start=performance.now();
  try {const evidence=await fn();checks.push({name,pass:true,ms:performance.now()-start,evidence});}
  catch(error) {checks.push({name,pass:false,ms:performance.now()-start,error:String(error.stack)});}
  console.log(`${checks.at(-1).pass?'PASS':'FAIL'} ${name}`);
}
const near=(a,b,eps=1e-12)=>assert.ok(Math.abs(a-b)<eps,`${a} differs from ${b}`);

await check('math: 24 identities survive split and permutation',()=>{
  const cells=tensorCells();assert.equal(cells.length,24);
  assert.deepEqual(cells.map(c=>c.address),Array.from({length:24},(_,i)=>i));
  for(const c of cells)assert.equal(c.batch*8+c.head*4+c.feature,c.value-1);
  return {elements:24,shapeProducts:[3*8,3*2*4,2*3*4]};
});
await check('math: softmax normalized, shift invariant, coupled',()=>{
  const a=stableSoftmax([1,2,3]), b=stableSoftmax([3,2,3]), shifted=stableSoftmax([1001,1002,1003]);
  near(a.probabilities.reduce((x,y)=>x+y),1);
  a.probabilities.forEach((v,i)=>near(v,shifted.probabilities[i]));
  assert.ok(b.probabilities[0]>a.probabilities[0]&&b.probabilities[1]<a.probabilities[1]&&b.probabilities[2]<a.probabilities[2]);
  assert.throws(()=>stableSoftmax([NaN]));
  return {initial:a,changed:b};
});
await check('math: units and model boundary',()=>{
  const a=roofline({flops:1000,bytes:1000,computePerMs:100,bytesPerMs:10});
  const b=roofline({flops:1000,bytes:100,computePerMs:100,bytesPerMs:10});
  const c=roofline({flops:1000,bytes:50,computePerMs:100,bytesPerMs:10});
  assert.deepEqual([a.intensity,b.intensity,c.intensity],[1,10,20]);
  assert.deepEqual([a.estimatedMs,b.estimatedMs,c.estimatedMs],[100,10,10]);
  return {a,b,c,assumption:'fully overlapping idealized model, not measurement'};
});
await check('controller: cancelled dwell, pause, selection and reverse order',()=>{
  const tasks=new Map();let seq=0;const a={},b={},events=[];
  const clock={setTimeout:fn=>{tasks.set(++seq,fn);return seq;},clearTimeout:id=>tasks.delete(id)};
  const tick=()=>{for(const [id,fn] of [...tasks]){tasks.delete(id);fn();}};
  const c=new ReadingController({steps:[a,b],onActivate:s=>events.push(s),clock});
  c.pointer(a);c.pointer(null);tick();assert.equal(events.length,0);
  c.pointer(a);c.scroll();tick();assert.equal(events.length,0);
  c.pointer(a);tick();c.pointer(b);tick();c.pointer(a);tick();assert.deepEqual(events,[a,b,a]);
  c.setPaused(true);c.focus(b);assert.equal(events.length,3);
  c.setPaused(false);c.pointer(b);c.setSelecting(true);tick();assert.equal(events.length,3);
  c.setSelecting(false);c.setMode('static');c.focus(b);assert.equal(events.length,3);
  c.destroy();assert.equal(tasks.size,0);
  return {events:events.length,metrics:c.metrics};
});

const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH??'/tmp/reading-test-package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const base=process.env.CHECK_URL??'http://127.0.0.1:8765/';
const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
const page=await context.newPage();
const requests=[],errors=[];
page.on('request',request=>requests.push(request.url()));
page.on('pageerror',error=>errors.push(error.message));
const state=()=>page.evaluate(()=>window.readingLab.snapshot());
const settle=ms=>page.waitForTimeout(ms??230);
async function reveal(selector) {
  await page.locator(selector).evaluate(el=>el.scrollIntoView({block:'end'}));
  await settle(70);
}
async function hover(id) {await reveal(`#${id}`);await page.mouse.move(20,80);await page.locator(`#${id}`).hover();await settle();}
async function frame(name,selector) {
  const destination=path.join(out,`${name}.png`);
  if(selector)await page.locator(selector).screenshot({path:destination});else await page.screenshot({path:destination});
  const bytes=fs.readFileSync(destination);artifacts.push({name,path:destination,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  return artifacts.at(-1);
}

await check('browser: local loading and real canvas',async()=>{
  await page.goto(base);await page.waitForFunction(()=>!!window.readingLab);
  await reveal('#tensor-input');await page.waitForFunction(()=>document.querySelector('#tensor .mechanism').classList.contains('ready'));
  const s=await state();assert.deepEqual(s.errors,[]);assert.equal(s.stages.tensor,0);
  assert.equal(await page.locator('.katex').count(),3);
  return {snapshot:s,screenshot:await frame('desktop-initial')};
});
await check('browser: actual pointer forward and backward',async()=>{
  const ids=['tensor-input','tensor-split','tensor-swap','tensor-memory','tensor-split','tensor-input'];
  const visited=[];
  for(const id of ids){await hover(id);const s=await state();assert.equal(s.active,id);visited.push(s.stages.tensor);}
  return {visited};
});
await check('browser: passing pointer does not activate',async()=>{
  await hover('tensor-input');await reveal('#tensor-split');
  const b=await page.locator('#tensor-split').boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.move(20,200);await settle();
  assert.equal((await state()).active,'tensor-input');return await state();
});
await check('browser: stationary pointer during scroll is ignored',async()=>{
  await hover('tensor-input');const before=(await state()).metrics.activations;
  await page.mouse.wheel(0,140);await settle();assert.equal((await state()).metrics.activations,before);
  return {activationsBefore:before,after:(await state()).metrics.activations};
});
await check('browser: real text selection freezes figure',async()=>{
  await hover('tensor-split');await reveal('#tensor-swap');
  const r=await page.locator('#tensor-swap').boundingBox();
  await page.mouse.move(r.x+70,r.y+30);await page.mouse.down();
  await page.mouse.move(r.x+Math.min(r.width-20,400),r.y+40,{steps:12});await settle();
  await page.mouse.up();await settle();assert.equal((await state()).active,'tensor-split');
  const selection=await page.evaluate(()=>getSelection().toString());assert.ok(selection.length>0);
  await page.evaluate(()=>getSelection().removeAllRanges());return {selectedCharacters:selection.length};
});
await check('browser: pause and text-only controls',async()=>{
  await hover('tensor-input');await page.locator('#pause').click();await hover('tensor-memory');assert.equal((await state()).active,'tensor-input');
  await page.locator('#pause').click();await page.locator('#text-only').click();assert.equal(await page.locator('#tensor .mechanism').isVisible(),false);
  await page.locator('#text-only').click();assert.equal(await page.locator('#tensor .mechanism').isVisible(),true);
  return await state();
});
await check('browser: keyboard can read and reverse without hovering',async()=>{
  await page.locator('#tensor-input').focus();await page.keyboard.press('Tab');assert.equal((await state()).active,'tensor-split');
  await page.keyboard.press('Tab');assert.equal((await state()).active,'tensor-swap');
  await page.keyboard.press('Shift+Tab');assert.equal((await state()).active,'tensor-split');
  return await state();
});
await check('browser: three mechanisms, one cached WASM fetch',async()=>{
  for(const id of ['softmax','intensity']) {
    await hover(`${id==='softmax'?'softmax-change':'intensity-limit'}`);
    await page.waitForFunction(id=>document.querySelector(`#${id} .mechanism`).classList.contains('ready'),id);
    assert.equal((await state()).stages[id],3);await frame(`${id}-stage3`, `#${id} .mechanism`);
  }
  const wasm=requests.filter(url=>url.endsWith('.wasm'));assert.equal(wasm.length,1);
  const s=await state();assert.deepEqual(s.errors,[]);assert.deepEqual(errors,[]);
  return {wasmRequests:wasm.length,mounted:s.scenes,externalRequests:requests.filter(url=>!url.startsWith(base))};
});
await check('browser: random seek has identical pixel endpoints',async()=>{
  const samples=[];
  for(const id of ['tensor','softmax','intensity']) {
    const hashes=new Map();
    for(const t of [0,3,1,2,0,2,1,3]) {
      await page.evaluate(({id,t})=>window.readingLab.seekForCheck(id,t),{id,t});
      const png=await page.locator(`#${id} canvas`).screenshot();const hash=crypto.createHash('sha256').update(png).digest('hex');
      if(hashes.has(t))assert.equal(hash,hashes.get(t));else hashes.set(t,hash);
      samples.push({id,t,sha256:hash});
    }
    assert.equal(new Set(hashes.values()).size,4);
  }
  fs.writeFileSync(path.join(out,'random-seek.json'),JSON.stringify(samples,null,2));return {samples:samples.length};
});
await check('browser: no continuous playback while idle',async()=>{
  const a=await page.evaluate(()=>window.readingLab.snapshot());await settle(1500);const b=await state();
  assert.deepEqual(a.stages,b.stages);assert.equal(a.metrics.activations,b.metrics.activations);
  return {idleMs:1500,activations:b.metrics.activations};
});
await check('browser: static comparison keeps state and print fallback',async()=>{
  await page.locator('#mode').selectOption('static');const before=(await state()).stages;
  await hover('softmax-logits');assert.deepEqual((await state()).stages,before);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#softmax .fallback').isVisible(),true);
  await frame('print-preview');await page.emulateMedia({media:'screen'});
  await page.locator('#mode').selectOption('pointer');return {stages:before};
});
await check('browser: desktop layout and no horizontal overflow',async()=>{
  const evidence=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,main:document.querySelector('main').getBoundingClientRect().toJSON()}));
  assert.ok(evidence.scrollWidth<=evidence.width);assert.ok(evidence.main.width<=800);
  return evidence;
});

await check('browser: touch and narrow reading layout',async()=>{
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const p=await mobile.newPage();await p.goto(base);await p.waitForFunction(()=>!!window.readingLab);
  assert.equal(await p.locator('#mode').inputValue(),'scroll');
  await p.locator('#softmax-normalize').evaluate(el=>el.scrollIntoView({block:'end'}));await p.waitForTimeout(250);
  const s=await p.evaluate(()=>window.readingLab.snapshot());assert.equal(s.mode,'scroll');assert.ok(s.metrics.activations>0);
  const widths=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(widths.scrollWidth<=widths.width);
  await p.screenshot({path:path.join(out,'mobile-reading.png')});await mobile.close();return {snapshot:s,widths};
});
await check('browser: reduced motion uses stable named states',async()=>{
  const ctx=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const p=await ctx.newPage();await p.goto(base);await p.waitForFunction(()=>!!window.readingLab);
  await p.locator('#tensor-memory').focus();await p.waitForTimeout(250);
  const s=await p.evaluate(()=>window.readingLab.snapshot());assert.equal(s.stages.tensor,3);
  assert.equal(await p.evaluate(()=>matchMedia('(prefers-reduced-motion:reduce)').matches),true);await ctx.close();return {stage:s.stages.tensor};
});
await check('browser: WASM fails but text and static diagram survive',async()=>{
  const ctx=await browser.newContext();const p=await ctx.newPage();await p.route('**/*.wasm',route=>route.abort());await p.goto(base);await p.waitForFunction(()=>!!window.readingLab);
  await p.locator('#tensor-input').focus();await p.waitForTimeout(300);
  assert.equal(await p.locator('#tensor .fallback').isVisible(),true);assert.ok((await p.locator('#tensor-input').innerText()).length>50);
  const s=await p.evaluate(()=>window.readingLab.snapshot());assert.ok(s.errors.length>0);await p.screenshot({path:path.join(out,'wasm-failure.png')});await ctx.close();return {expectedErrors:s.errors};
});
await check('browser: JavaScript disabled leaves complete reading path',async()=>{
  const ctx=await browser.newContext({javaScriptEnabled:false});const p=await ctx.newPage();await p.goto(base);
  assert.equal(await p.locator('.reading-step').count(),12);assert.equal(await p.locator('.fallback').count(),3);assert.equal(await p.locator('noscript').isVisible(),true);
  await p.screenshot({path:path.join(out,'no-js.png')});await ctx.close();return {paragraphs:12,staticDiagrams:3};
});

const summary={schema:1,startedAt:new Date().toISOString(),url:base,checks,artifacts,passed:checks.filter(c=>c.pass).length,total:checks.length,scope:'automated engineering checks; not human learning validation'};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(summary,null,2)+'\n');
await context.close();await browser.close();console.log(JSON.stringify({passed:summary.passed,total:summary.total,out}));
process.exitCode=summary.passed===summary.total?0:1;
