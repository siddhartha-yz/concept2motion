#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const runtime=path.join(root,'work/visualbook/runtime/node_modules');
const lib=path.join(root,'packages/visualbook');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const json=filename=>JSON.parse(fs.readFileSync(filename,'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function katexCss() {return fs.readFileSync(path.join(runtime,'katex/dist/katex.min.css'),'utf8').replace(/url\(([^)]+)\)/g,(whole,name)=>{const file=path.join(runtime,'katex/dist',name);return fs.existsSync(file)?`url(data:font/${name.endsWith('woff2')?'woff2':'woff'};base64,${fs.readFileSync(file).toString('base64')})`:whole;});}
export function validatePlan(book,plan) {
  if(!Array.isArray(plan.figures)||plan.figures.length>4)throw Error('Expected zero to four figures');
  const ids=new Set(),scopes=[];
  for(const f of plan.figures) {
    if(!/^[a-z][a-z0-9-]*$/.test(f.id)||ids.has(f.id))throw Error('Bad/duplicate figure id');ids.add(f.id);
    const start=book.blocks.findIndex(b=>b.id===f.afterAnchor),end=book.blocks.findIndex(b=>b.id===(f.endAnchor??f.afterAnchor));
    if(start<0||end<start||end-start>8)throw Error('Invalid/too long scope '+f.id);
    if(typeof f.code!=='string'||!/^\s*function\s+draw\s*\(/.test(f.code)||/<\/script/i.test(f.code))throw Error('Expected function draw(input) '+f.id);
    if((f.height??320)<180||(f.height??320)>480||(f.mobileHeight??f.height??320)>560)throw Error('Figure too tall '+f.id);
    for(const c of f.params??[])if(!/^[a-z][a-zA-Z0-9]*$/.test(c.key)||![c.min,c.max,c.step,c.value].every(Number.isFinite)||c.min>=c.max||c.step<=0||c.value<c.min||c.value>c.max)throw Error('Bad control '+c.key);
    if(scopes.some(s=>start<=s.end&&end>=s.start))throw Error('Overlapping scopes');scopes.push({start,end,f});
  }return scopes;
}
export function build(book,plan,{direct=false}={}) {
  const scopes=validatePlan(book,plan),mathExpected=book.blocks.reduce((s,b)=>s+(b.math?.expected??0),0);
  const figure=f=>`<figure class="vh-figure" id="figure-${f.id}" data-viz-id="${f.id}"><h3>${esc(f.title)}</h3><div class="vh-canvas"><svg role="img" aria-label="${esc(f.summary??f.title)}"><title>${esc(f.title)}</title></svg></div><div class="vh-bar"><input class="vh-progress" type="range" min="0" max="1" step="0.001" value="0" aria-label="${esc(f.title)}：连续演示进度"><span class="vh-status"></span></div><div class="vh-params">${(f.params??[]).map(c=>`<label>${esc(c.label)}<input type="range" data-param="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}" aria-label="${esc(c.label)}"><output>${c.value}</output></label>`).join('')}<button class="vh-resume">跟随阅读</button></div>${f.summary?`<p class="vh-caption">${esc(f.summary)}</p>`:''}</figure>`;
  let body='';
  for(let i=0;i<book.blocks.length;i++) {
    const b=book.blocks[i],scope=scopes.find(s=>s.start===i);
    if(scope)body+='<section class="vh-scope">';
    if(!(i===0&&b.type==='heading'))body+=`<div class="source-block" id="${b.id}" data-source-sha256="${b.sha256}" data-math-expected="${b.math?.expected??0}">${b.html}</div>`;
    if(scope)body+=figure(scope.f);
    if(scopes.some(s=>s.end===i))body+='</section>';
  }
  const library=direct?'':fs.readFileSync(path.join(runtime,'d3/dist/d3.min.js'),'utf8')+'\n'+fs.readFileSync(path.join(lib,'viz.js'),'utf8');
  const startup=plan.figures.map(f=>`VisualBookRuntime.mount(document.getElementById('figure-${f.id}'),${JSON.stringify({...f,code:undefined}).replaceAll('<','\\u003c')},(${f.code}),${!direct});`).join('\n');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'"><title>${esc(book.title)}</title><style>${fs.readFileSync(path.join(lib,'theme.css'),'utf8')}\n${katexCss()}</style></head><body data-math-expected="${mathExpected}" data-source-sha="${book.sourceSha256}"><header><a href="index.html">VisualBook</a><a href="${esc(book.sourceUrl)}">原版教材 ↗</a></header><main><div class="eyebrow">读 · 看 · 自己试一下</div><h1>${esc(book.title)}</h1><p class="source-note">正文来自 D2L。图解随阅读进度变化，也可以拖动图下的细线或参数；没有自动播放。</p>${body}</main><script>${library}\n${fs.readFileSync(path.join(lib,'runtime.js'),'utf8')}\n${startup}</script></body></html>`;
}
export async function preview(file,out) {
  if(fs.existsSync(out))throw Error('Preview directory exists; use a new directory');fs.mkdirSync(out,{recursive:true});
  const {chromium}=await import(pathToFileURL(path.join(runtime,'playwright-core/index.mjs')));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH??chromium.executablePath()});
  const report={file:path.resolve(file),sha256:hash(fs.readFileSync(file)),viewports:[],findings:[],screenshots:[]};
  try { for(const width of [1280,375]) {
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))report.findings.push({kind:'external-request',url:r.url()});});
    await page.addInitScript(()=>window.__VH_SNAPSHOT=true);await page.goto(pathToFileURL(path.resolve(file)).href);await page.waitForFunction(()=>document.fonts.status==='loaded');
    const math=await page.evaluate(()=>({expected:+document.body.dataset.mathExpected,rendered:document.querySelectorAll('.source-block .katex').length,errors:document.querySelectorAll('.katex-error').length,raw:[...document.querySelectorAll('.source-block')].filter(b=>/\\(?:frac|sum|mathbf|alpha|mathbb)\b/.test([...b.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(''))).map(b=>b.id),overflow:document.documentElement.scrollWidth>innerWidth+2}));
    if(math.expected!==math.rendered||math.errors||math.raw.length)report.findings.push({width,kind:'formula-render',...math});
    if(math.overflow)report.findings.push({width,kind:'page-overflow'});
    if(errors.length)report.findings.push({width,kind:'javascript',errors});
    const instances=await page.evaluate(()=>window.VisualBookRuntime?.instances.map(i=>i.id)??[]);
    const shapes=[];
    for(const id of instances) {
      const frames=[];
      for(const progress of [0,.25,.26,.5,1]) {
        await page.evaluate(({id,progress})=>{const i=VisualBookRuntime.instances.find(i=>i.id===id);i.setProgress(progress,true);}, {id,progress});
        await page.locator('#figure-'+id).scrollIntoViewIfNeeded();
        // Set again after scroll, which may drive automatic reading progress.
        await page.evaluate(({id,progress})=>VisualBookRuntime.instances.find(i=>i.id===id).setProgress(progress,true),{id,progress});
        const state=await page.evaluate(id=>{const i=VisualBookRuntime.instances.find(i=>i.id===id),svg=i.svg,box=svg.viewBox.baseVal;
          const visible=n=>{let opacity=1;for(let p=n;p&&p!==svg.parentElement;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return false;opacity*=Number(s.opacity||1);}return opacity>.015;};
          const text=[...svg.querySelectorAll('text')].filter(visible).map(n=>{const b=n.getBBox(),matrix=svg.getScreenCTM().inverse().multiply(n.getScreenCTM()),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix)),xs=points.map(p=>p.x),ys=points.map(p=>p.y);return {text:n.textContent,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),size:parseFloat(getComputedStyle(n).fontSize)};});
          const overlaps=[];for(let a=0;a<text.length;a++)for(let b=a+1;b<text.length;b++){const x=text[a],y=text[b];if(x.w&&y.w&&x.x<y.x+y.w-2&&x.x+x.w>y.x+2&&x.y<y.y+y.h-2&&x.y+x.h>y.y+2)overlaps.push([x.text,y.text]);}return {progress:i.progress,facts:i.facts,error:i.error??null,svg:svg.outerHTML,outside:text.filter(t=>t.x < -2||t.y < -2||t.x+t.w>box.width+2||t.y+t.h>box.height+2),tiny:text.filter(t=>t.size<12),overlaps};},id);
        if(state.error||state.outside.length||state.tiny.length||state.overlaps.length)report.findings.push({width,id,progress,kind:'figure-layout',error:state.error,outside:state.outside,tiny:state.tiny,overlaps:state.overlaps});
        frames.push({...state,svgHash:hash(state.svg),svg:undefined});
        if(progress===0){const dir=path.join(out,'static');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${width}-${id}.svg`),state.svg);}
        if([0,.5,1].includes(progress)){const filename=path.join(out,`${width}-${id}-${progress}.png`);await page.locator('#figure-'+id).screenshot({path:filename});report.screenshots.push(path.resolve(filename));}
      }
      if(frames[1].svgHash===frames[2].svgHash)report.findings.push({width,id,kind:'no-fractional-change',note:'0.25 and 0.26 produced identical SVG; review whether this is intentional'});
      shapes.push({id,frames});
    }
    const filename=path.join(out,`${width}-page.png`);await page.screenshot({path:filename,fullPage:true});report.screenshots.push(path.resolve(filename));report.viewports.push({width,math,shapes});await page.close();
  }} finally {await browser.close();}
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');return report;
}
export function staticExport(file,previewDir,out) {
  const report=json(path.join(previewDir,'report.json'));
  if(report.sha256!==hash(fs.readFileSync(file)))throw Error('Preview is stale; render this HTML before export');
  let html=fs.readFileSync(file,'utf8');
  for(const shape of report.viewports[0].shapes) {
    const picture=[1280,375].map(w=>fs.readFileSync(path.join(previewDir,'static',`${w}-${shape.id}.svg`))).map(bytes=>'data:image/svg+xml;base64,'+bytes.toString('base64'));
    const fallback=`<div class="vh-static"><picture><source media="(max-width:600px)" srcset="${picture[1]}"><img src="${picture[0]}" alt="图解初始状态：${esc(shape.id)}"></picture></div>`;
    html=html.replace(`id="figure-${shape.id}" data-viz-id="${shape.id}">`,`id="figure-${shape.id}" data-viz-id="${shape.id}">${fallback}`);
  }
  html=html.replace('<html lang="zh-CN">','<html lang="zh-CN" class="no-js">').replace('</head>','<style>.no-js .vh-static{display:block}.no-js .vh-canvas,.no-js .vh-bar,.no-js .vh-params{display:none}</style><script>document.documentElement.classList.remove("no-js")</script></head>');
  fs.writeFileSync(out,html);
  for(const [name,src] of [['D3-LICENSE.txt',path.join(runtime,'d3/LICENSE')],['KaTeX-LICENSE.txt',path.join(runtime,'katex/LICENSE')],['D2L-LICENSE.txt',path.join(root,'work/visualbook/upstreams/d2l-zh/LICENSE')]])fs.copyFileSync(src,path.join(path.dirname(out),name));
  return {file:path.resolve(out),sha256:hash(html),previewSha256:report.sha256};
}
async function main() {
  const [command,...args]=process.argv.slice(2);
  if(command==='catalog'){console.log(fs.readFileSync(path.join(lib,'API.md'),'utf8'));return;}
  if(command==='gallery'){const blocks=['共享坐标让向量的角度和长度可以直接比较。','横向倍率改变向量的横坐标，纵坐标保持不变。','同一个对象沿处理链路逐步向前。','窄屏竖向排布，信息的顺序保持相同。'].map((raw,i)=>({id:`gallery-${String(i+1).padStart(3,'0')}`,raw,type:'paragraph',sha256:hash(raw),math:{expected:0},html:`<p>${raw}</p>`}));const source={title:'可复用设计与连续交互',sourceUrl:'https://github.com/siddhartha-yz/visualbook-harness',sourceSha256:hash(JSON.stringify(blocks)),blocks};fs.mkdirSync(path.dirname(path.resolve(args[0])),{recursive:true});fs.writeFileSync(args[0],build(source,json(path.join(lib,'gallery.json'))));console.log(args[0]);return;}
  if(command==='import'){process.env.VISUALBOOK_SAMPLING=path.resolve(args[0]);process.env.VISUALBOOK_OUTPUT=path.resolve(args[1]);const {prepare}=await import('../experiments/visualbook/prepare.mjs');console.log(JSON.stringify(prepare().map(b=>({id:b.id,blocks:b.blocks.length,math:b.adaptation.mathRendered}))));return;}
  if(command==='build'){const [source,plan,out]=args;fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});const html=build(json(source),json(plan),{direct:args.includes('--direct')});fs.writeFileSync(out,html);console.log(JSON.stringify({html:path.resolve(out),sha256:hash(html),figures:json(plan).figures.length}));return;}
  if(command==='preview'){const report=await preview(args[0],args[1]);console.log(JSON.stringify({report:path.resolve(args[1],'report.json'),findings:report.findings,screenshots:report.screenshots}));return;}
  if(command==='export'){console.log(JSON.stringify(staticExport(args[0],args[1],args[2])));return;}
  throw Error('Use: catalog | import sampling.json out-dir | build source.json plan.json book.html [--direct] | preview book.html new-evidence-dir');
}
if(process.argv[1]===import.meta.filename)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
