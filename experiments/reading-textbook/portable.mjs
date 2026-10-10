// Build single-file HTML that opens through file:// with no local server.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const output=process.env.READING_OUTPUT??path.join(root,'outputs/reading-textbook');
const npm=path.join(process.env.READING_DEPENDENCIES??path.join(root,'work/reading-textbook/node-mirror'),'node_modules');
const {build}=await import(pathToFileURL(path.join(npm,'vite/dist/node/index.js')));
const data=(file,type)=>`data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const content=fs.readFileSync(path.join(output,'content.json'),'utf8');
const fallbackAssets=Object.fromEntries(JSON.parse(content).units.map(u=>[u.id,u.states.map((_,i)=>data(path.join(output,`static/${u.id}-${i}.svg`),'image/svg+xml'))]));
const contentDeclaration="const content = await fetch('./content.json').then(r=>{if(!r.ok)throw new Error(`content HTTP ${r.status}`);return r.json();});";
const fallbackDeclaration='fallback.src=`static/${id}-${stage}.svg`;';
const result=await build({configFile:false,root:output,logLevel:'warn',plugins:[{
  name:'embed-authored-inputs',
  transform(code,id){
    if(id!==path.join(output,'app.mjs'))return;
    if(!code.includes(contentDeclaration)||!code.includes(fallbackDeclaration))throw new Error('app layout changed: portable embedding needs review');
    return code.replace(contentDeclaration,`const content=JSON.parse(document.querySelector('#embedded-content').textContent);const fallbackAssets=JSON.parse(document.querySelector('#embedded-fallbacks').textContent);`).replace(fallbackDeclaration,'fallback.src=fallbackAssets[id][stage];');
  }
}],build:{write:false,target:'esnext',minify:'esbuild',assetsInlineLimit:1000000,lib:{entry:path.join(output,'app.mjs'),formats:['es'],fileName:'reading'},rollupOptions:{output:{inlineDynamicImports:true}}}});
const chunks=(Array.isArray(result)?result:[result]).flatMap(r=>r.output).filter(x=>x.type==='chunk');
if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw new Error('portable output has external module dependencies');
const js=chunks[0].code.replaceAll('</script','<\\/script');
let katexCss=fs.readFileSync(path.join(output,'vendor/katex/katex.min.css'),'utf8');
// Modern browsers use WOFF2. Avoid embedding three alternate copies of each font.
katexCss=katexCss.replace(/,url\([^)]*\.woff\) format\("woff"\),url\([^)]*\.ttf\) format\("truetype"\)/g,'');
katexCss=katexCss.replace(/url\((fonts\/[^)]+)\)/g,(_,file)=>`url(${data(path.join(output,'vendor/katex',file),file.endsWith('.woff2')?'font/woff2':file.endsWith('.woff')?'font/woff':'font/ttf')})`);
const css=fs.readFileSync(path.join(output,'style.css'),'utf8').replace(/@import[^;]+;/g,'')+katexCss;
const wasm=data(path.join(output,'vendor/zanim/dist/zanim_web_core.wasm'),'application/wasm');
const safeJSON=s=>s.replaceAll('<','\\u003c');
const licenses=['vendor/zanim/LICENSE',path.relative(output,path.join(npm,'katex/LICENSE'))].map(file=>fs.readFileSync(path.resolve(output,file),'utf8')).join('\n\n');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const report={schema:1,scope:'Generated local single-file personal-study artifacts; includes real bundled Zanim/WASM. No server or model call.',files:[]};
for(const name of ['index','book-01','book-04']){
  let html=fs.readFileSync(path.join(output,`${name}.html`),'utf8');
  html=html.replace(/<link rel="stylesheet"[^>]+>/g,'');
  html=html.replace('</head>',()=>`<style>${css}</style></head>`);
  html=html.replace(/src="static\/([^"]+)"/g,(_,file)=>`src="${data(path.join(output,'static',file),'image/svg+xml')}"`);
  html=html.replace('<script type="module" src="app.mjs"></script>',()=>`<script type="application/json" id="embedded-content">${safeJSON(content)}</script><script type="application/json" id="embedded-fallbacks">${safeJSON(JSON.stringify(fallbackAssets))}</script><script>globalThis.__ZANIM_WASM_URL__=${JSON.stringify(wasm)};</script><script type="module">${js}</script>`);
  let sourceRecords='';
  for(const [file,id,title] of [['provenance.json','portable-provenance','来源与文字对应记录'],['content.json','portable-content','本页讲解与出处'],['import-report.json','portable-import-report','整册来源记录']]){
    if(!html.includes(`href="${file}"`))continue;
    html=html.replaceAll(`href="${file}"`,`href="#${id}"`);
    sourceRecords+=`<details id="${id}" style="margin:20px;font-size:12px"><summary>${title}</summary><pre>${escape(fs.readFileSync(path.join(output,file),'utf8'))}</pre></details>`;
  }
  html=html.replace('</body>',()=>`${sourceRecords}</body>`);
  html=html.replace('</body>',()=>`<details style="margin:20px;font-size:12px"><summary>随文件保留的 Zanim / KaTeX 使用许可</summary><pre>${escape(licenses)}</pre></details></body>`);
  const destination=path.join(output,`${name}-portable.html`);fs.writeFileSync(destination,html);
  report.files.push({file:path.basename(destination),bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex'),javascriptBytes:Buffer.byteLength(js)});
}
fs.writeFileSync(path.join(output,'portable-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.files));
