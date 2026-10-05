import { chromium } from './upstreams/realtime-manim-rs/node_modules/playwright-core/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const output = 'work/full-reproduction-v1/realtime-frames';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/home/yang-zhi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=swiftshader','--enable-features=Vulkan']});
const page=await browser.newPage({viewport:{width:1200,height:900}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const result={entrypoint:'unmodified packages/manim-web/example/index.html',adapter:'Linux Chromium plus SwiftShader, original UI pause/seek, original checked-in Wasm; no Rust rebuild',times:[],errors};
try {
 await page.goto('http://127.0.0.1:8921/packages/manim-web/example/index.html');
 await page.waitForFunction(()=>globalThis.__MANIM_PACKAGE_READY__,null,{timeout:60000});
 await page.locator('#toggle').click();
 result.gpu=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter(); return a?{info:a.info,features:[...a.features]}:null;});
 for(const t of [0,1,2,3,4,2]) {
  await page.locator('#time').evaluate((el,t)=>{el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));},t);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const bytes=await page.locator('canvas').screenshot();
  const id=result.times.length; await writeFile(`${output}/frame-${id}.png`,bytes);
  result.times.push({time:t,path:`${output}/frame-${id}.png`,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 result.repeated2sIdentical=result.times[2].sha256===result.times[5].sha256; result.status='rendered_stills';
} catch(e){result.status='failed';result.error=e.message;} finally{await browser.close();}
await writeFile('evaluation/2026-10-04/full-reproduction-v1/realtime-browser-smoke-v1.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
