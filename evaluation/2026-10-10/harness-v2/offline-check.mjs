import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.cwd(),'work/visualbook/runtime/node_modules/playwright-core/index.mjs')).href);
const root=process.cwd(), folder=path.join(root,'work/harness-v2/offline-unpacked/visualbook-harness-demo');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),headless:true});
const records=[];
try {
 for(const width of [1280,375]) for(const chapter of ['geometry','optimization','programming','channels']) {
  const page=await browser.newPage({viewport:{width,height:900}}), errors=[], requests=[];
  page.on('pageerror',e=>errors.push(String(e))); page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.addInitScript(()=>window.__VH_SNAPSHOT=true);
  await page.goto(pathToFileURL(path.join(folder,chapter+'.html')).href);await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.allSettled([...document.images].map(img=>img.decode()));});
  const facts=await page.evaluate(()=>{
   const items=VisualBookRuntime.instances;items.forEach(i=>i.setProgress(.5,true));
   return {figures:items.length,errors:items.map(i=>i.error).filter(Boolean),mathExpected:+document.body.dataset.mathExpected,mathRendered:document.querySelectorAll('.katex').length,mathErrors:document.querySelectorAll('.katex-error').length,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length};
  });
  records.push({chapter,width,...facts,pageErrors:errors,externalRequests:requests});await page.close();
 }
} finally {await browser.close();}
const failures=records.filter(r=>r.errors.length||r.pageErrors.length||r.externalRequests.length||r.mathExpected!==r.mathRendered||r.mathErrors||r.brokenImages);
fs.writeFileSync(path.join(root,'evaluation/2026-10-10/harness-v2/offline-delivery-check.json'),JSON.stringify({input:'Generated ZIP extracted into a separate directory',records,failures:failures.length,modelCalls:0,scope:'file:// reading, actual midpoint render, formula coverage and image loading; no aesthetics or reader learning measurement'},null,2)+'\n');
console.log(JSON.stringify({cases:records.length,failures:failures.length}));if(failures.length)process.exitCode=1;
