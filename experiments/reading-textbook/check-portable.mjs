import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH),{chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.env.CHECK_OUTPUT??path.join(root,'evaluation/2026-10-10/reading-textbook-v1/raw/portable-v1'));fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});const checks=[];
async function check(name,fn){try{checks.push({name,pass:true,evidence:await fn()});}catch(e){checks.push({name,pass:false,error:String(e.stack)});}console.log(`${checks.at(-1).pass?'PASS':'FAIL'} ${name}`);}
for(const name of ['index','book-01','book-04'])await check(`offline file://${name}: actual WASM, figures, and formulas`,async()=>{
  const context=await browser.newContext({offline:true,viewport:{width:1280,height:900}}),page=await context.newPage(),requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,`outputs/reading-textbook/${name}-portable.html`)).href);await page.waitForFunction(()=>!!window.readingLab);
  const ids=name==='book-01'?['tensor-memory']:name==='book-04'?['softmax-change','intensity-limit']:['tensor-memory','softmax-change','intensity-limit'];
  for(const id of ids){await page.locator(`#${id}`).focus();await page.waitForFunction(id=>document.querySelector(`#${id}`).closest('.reading-unit').querySelector('.mechanism').classList.contains('ready'),id);}
  const state=await page.evaluate(()=>window.readingLab.snapshot());assert.deepEqual(state.errors,[]);assert.deepEqual(state.rejectedSteps,[]);assert.equal(state.rendered,ids.length);assert.deepEqual(errors,[]);
  assert.equal(requests.filter(u=>/^https?:/.test(u)).length,0);assert.ok(await page.locator('.katex').count()>=3);
  await page.screenshot({path:path.join(out,`${name}-offline.png`)});await context.close();return {rendered:state.rendered,errors,networkRequests:0,fileBytes:fs.statSync(path.join(root,`outputs/reading-textbook/${name}-portable.html`)).size};
});
await check('offline file: no JavaScript leaves static illustrations and disabled controls',async()=>{
  const ctx=await browser.newContext({offline:true,javaScriptEnabled:false});const p=await ctx.newPage();await p.goto(pathToFileURL(path.join(root,'outputs/reading-textbook/index-portable.html')).href);assert.equal(await p.locator('.fallback').count(),3);assert.equal(await p.locator('.reading-step').count(),12);assert.equal(await p.locator('#mode').isDisabled(),true);await p.screenshot({path:path.join(out,'no-js.png')});await ctx.close();return {paragraphs:12,illustrations:3};
});
await check('200 percent text preserves reading and graphics controls',async()=>{
  const ctx=await browser.newContext({viewport:{width:800,height:900}}),p=await ctx.newPage();await p.goto(pathToFileURL(path.join(root,'outputs/reading-textbook/index-portable.html')).href);await p.waitForFunction(()=>!!window.readingLab);
  await p.addStyleTag({content:'body{font-size:34px}.reading-step{font-size:34px}'});await p.locator('#tensor-input').focus();await p.waitForTimeout(250);
  const sizes=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(sizes.scrollWidth<=sizes.width);await p.screenshot({path:path.join(out,'text-200-percent.png')});await ctx.close();return sizes;
});
const report={checks,passed:checks.filter(c=>c.pass).length,total:checks.length,scope:'Actual offline file-opening and browser rendering; no human readability or learning outcome proof'};fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:report.passed,total:report.total}));process.exitCode=report.passed===report.total?0:1;
