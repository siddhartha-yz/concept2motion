import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH);
const {chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..');
const out=path.resolve(process.env.CHECK_OUTPUT??path.join(root,'evaluation/2026-10-10/reading-textbook-v1/raw/books-v1'));
fs.mkdirSync(out,{recursive:true});
const imported=JSON.parse(fs.readFileSync(path.join(root,'outputs/reading-textbook/import-report.json')));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const checks=[];
async function check(name,fn){try{checks.push({name,pass:true,evidence:await fn()});}catch(e){checks.push({name,pass:false,error:String(e.stack)});}console.log(`${checks.at(-1).pass?'PASS':'FAIL'} ${name}`);}
for(const file of imported.files){
  await check(`full document: ${file.id}`,async()=>{
    const page=await context.newPage(),external=[],errors=[];
    page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8765/'))external.push(r.url());});
    page.on('pageerror',e=>errors.push(e.message));
    const start=performance.now();await page.goto(`http://127.0.0.1:8765/${file.id}.html`);
    if(['book-01','book-04'].includes(file.id))await page.waitForFunction(()=>!!window.readingLab);
    const data=await page.evaluate(()=>{
      const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
      const duplicateIds=ids.filter((id,i)=>ids.indexOf(id)!==i);
      return {parts:document.querySelectorAll('.book-part').length,blocks:document.querySelectorAll('[data-block-id]').length,unanchoredSmallHeadings:[...document.querySelectorAll('.book-part h5,.book-part h6')].filter(e=>!e.dataset.blockId).length,duplicateIds,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,paragraphs:document.querySelectorAll('.book-part p').length,codeBlocks:document.querySelectorAll('pre').length,characters:document.querySelector('main').textContent.length,mathErrors:document.querySelectorAll('.katex-error').length,illustrations:document.querySelectorAll('.mechanism').length};
    });
    assert.equal(data.parts,file.parts);assert.equal(data.blocks+data.unanchoredSmallHeadings,file.blockAnchors);assert.deepEqual(data.duplicateIds,[]);assert.ok(data.scrollWidth<=data.width);assert.equal(data.mathErrors,file.katexErrors);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    await page.locator('.book-part').last().scrollIntoViewIfNeeded();
    assert.ok(await page.locator('footer').isVisible());
    if(file.id==='book-01'){
      await page.locator('#tensor-memory').focus();await page.waitForFunction(()=>window.readingLab.snapshot().rendered===1);
      assert.equal((await page.evaluate(()=>window.readingLab.snapshot())).stages.tensor,3);
      await page.screenshot({path:path.join(out,'book-01-inline.png')});
    }
    await page.close();return {...data,loadMs:performance.now()-start};
  });
}
await check('full book touch: integrated graphics and long formula overflow',async()=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();await p.goto('http://127.0.0.1:8765/book-04.html');await p.waitForFunction(()=>!!window.readingLab);
  await p.locator('#intensity-limit').evaluate(el=>el.scrollIntoView({block:'end'}));await p.waitForTimeout(300);
  const data=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,snapshot:window.readingLab.snapshot()}));assert.ok(data.scrollWidth<=data.width);assert.equal(data.snapshot.mode,'scroll');assert.deepEqual(data.snapshot.rejectedSteps,[]);
  await p.screenshot({path:path.join(out,'book-04-mobile.png')});await ctx.close();return data;
});
await check('HTML text edit disables only the mismatched binding',async()=>{
  const p=await context.newPage();
  await p.route('**/index.html',async route=>{const response=await route.fetch();const body=(await response.text()).replace('从这三张卡开始：','从四张卡开始：');await route.fulfill({response,body});});
  await p.goto('http://127.0.0.1:8765/index.html');await p.waitForFunction(()=>!!window.readingLab);
  const before=await p.evaluate(()=>window.readingLab.snapshot());assert.deepEqual(before.rejectedSteps,['tensor-input']);assert.equal(await p.locator('#tensor-input').getAttribute('tabindex'),null);
  await p.locator('#tensor-split').focus();assert.equal((await p.evaluate(()=>window.readingLab.snapshot())).active,'tensor-split');await p.close();return {rejected:before.rejectedSteps,otherBindingUsable:true};
});
await check('disposal while WASM is still loading creates no live scene',async()=>{
  const p=await context.newPage();await p.route('**/*.wasm',async route=>{await new Promise(r=>setTimeout(r,600));await route.continue();});
  await p.goto('http://127.0.0.1:8765/');await p.waitForFunction(()=>!!window.readingLab);await p.locator('#tensor-input').focus();await p.evaluate(()=>window.readingLab.dispose());await p.waitForTimeout(1000);
  const s=await p.evaluate(()=>window.readingLab.snapshot());assert.equal(s.rendered,0);assert.deepEqual(s.scenes,[]);await p.close();return {rendered:s.rendered,scenes:s.scenes};
});
await check('content request fails: text readable, unavailable controls disabled',async()=>{
  const p=await context.newPage();await p.route('**/content.json',route=>route.fulfill({status:503,body:'unavailable'}));await p.goto('http://127.0.0.1:8765/');await p.waitForTimeout(300);
  assert.equal(await p.locator('.reading-step').count(),12);assert.equal(await p.locator('#mode').isDisabled(),true);assert.equal(await p.locator('#pause').isDisabled(),true);await p.close();return {paragraphs:12,disabledControls:true};
});
const result={schema:1,checks,passed:checks.filter(c=>c.pass).length,total:checks.length,scope:'Actual browser rendering of 21 entire documents plus binding/lifecycle failure controls; no human learning outcome'};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2)+'\n');await context.close();await browser.close();console.log(JSON.stringify({passed:result.passed,total:result.total}));process.exitCode=result.passed===result.total?0:1;
