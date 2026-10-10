// Check the boundary between keyboard focus and subsequent intentional scrolling.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH),{chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.env.CHECK_OUTPUT??path.join(root,'evaluation/2026-10-10/reading-textbook-v1/raw/focus-scroll-v1'));
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),checks=[];
async function check(name,fn){try{checks.push({name,pass:true,evidence:await fn()});}catch(error){checks.push({name,pass:false,error:String(error)});}console.log(`${checks.at(-1).pass?'PASS':'FAIL'} ${name}`);}
await page.goto('http://127.0.0.1:8765/');await page.waitForFunction(()=>!!window.readingLab);
await page.locator('#mode').selectOption('scroll');
await check('focus-triggered scroll preserves the focused paragraph',async()=>{
  await page.locator('#tensor-input').focus();await page.waitForTimeout(250);
  const active=await page.evaluate(()=>window.readingLab.snapshot().active);assert.equal(active,'tensor-input');return {active};
});
await check('wheel after keyboard focus releases the old reading position',async()=>{
  await page.locator('#softmax-normalize').evaluate(el=>{const r=el.getBoundingClientRect();window.scrollBy(0,r.top+r.height/2-innerHeight*.76);});
  await page.mouse.move(1100,500);await page.mouse.wheel(0,1);await page.waitForTimeout(300);
  const active=await page.evaluate(()=>window.readingLab.snapshot().active);assert.equal(active,'softmax-normalize');return {active};
});
await check('PageDown after focus can advance the reading position',async()=>{
  await page.locator('#tensor-input').focus();await page.keyboard.press('PageDown');await page.keyboard.press('PageDown');await page.waitForTimeout(400);
  const active=await page.evaluate(()=>window.readingLab.snapshot().active);assert.notEqual(active,'tensor-input');return {active};
});
await page.screenshot({path:path.join(out,'final.png')});
const result={scope:'Actual Chromium focus, wheel and PageDown controls; no human learning outcome',checks,passed:checks.filter(c=>c.pass).length,total:checks.length};fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2)+'\n');
await context.close();await browser.close();console.log(JSON.stringify({passed:result.passed,total:result.total}));process.exitCode=result.passed===result.total?0:1;
