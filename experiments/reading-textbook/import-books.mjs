// Default: independent source-preserving importer. --original-reader reproduces
// the optional unlicensed reader from its ignored checkout without copying it.
import fs from 'node:fs';
import {sanitize} from './html-policy.mjs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const base=path.join(root,'work/reading-textbook');
const output=path.join(root,'outputs/reading-textbook');
const reader=path.join(base,'upstreams/video2book-reader');
const courses=path.join(base,'upstreams/video2book-courses');
const courseDir=path.join(courses,'计算机/人工智能/大模型/Stanford-CS336-从头构建大语言模型');
const original=process.argv.includes('--original-reader');
const parser=original?await import(pathToFileURL(path.join(reader,'packages/reader/src/model/split-document.ts'))):await import('./document.mjs');
const transformer=original?await import(pathToFileURL(path.join(reader,'packages/reader/src/markdown/transform.ts'))):parser;
const {splitDocument}=parser,{transformDocument}=transformer;
const {toHtml}=await import(pathToFileURL(path.join(base,'node-mirror/node_modules/hast-util-to-html/index.js')));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const demo=fs.readFileSync(path.join(output,'index.html'),'utf8');
const content=JSON.parse(fs.readFileSync(path.join(output,'content.json'),'utf8'));
const pin=execFileSync('git',['-C',courses,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const readerPin=original?execFileSync('git',['-C',reader,'rev-parse','HEAD'],{encoding:'utf8'}).trim():null;
const snippets=new Map(content.units.map(u=>{
  const marker=`<section class="reading-unit" id="${u.id}">`;
  const from=demo.indexOf(marker),to=demo.indexOf('</section>',from);
  if(from<0||to<0)throw new Error('Missing authored insertion');
  return [u.id,'<p class="insertion-label">本轮补充的阅读图解 · 原教材正文在下方继续</p>'+demo.slice(from,to+10)];
}));
// A section heading must match exactly once in the fixed source. The insertion
// adds separately attributed explanations, never rewrites the imported text.
const insertions=[
  {book:'book-01',unit:'tensor',heading:'维度拆分合并与内存排布'},
  {book:'book-04',unit:'softmax',heading:'单行拟合的 Softmax 内核实现'},
  {book:'book-04',unit:'intensity',heading:'分块矩阵乘法与激活融合'},
];
const text=n=>n.type==='text'?n.value:(n.children??[]).map(text).join('');
const report={schema:1,courseCommit:pin,readerCommit:original?readerPin:null,parser:original?'original pinned reader':'independent split-before-math importer',files:[],insertions:[],scope:'Actual local Markdown parsing and HTML rendering; existing course content, no new transcription or model generation.'};
const css=`<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="vendor/katex/katex.min.css"><style>.imported-book{line-height:1.9}.imported-book h2{margin-top:72px}.imported-book h3{margin-top:42px}.imported-book pre{overflow:auto;padding:18px;background:#ebe8e1;font-size:13px}.imported-book table{display:block;overflow:auto}.imported-book blockquote{border-left:3px solid #b4c4bb;padding-left:20px;color:#526058}.katex-display{overflow-x:auto;overflow-y:hidden;max-width:100%}.insertion-label{margin-top:32px;font-size:13px;color:#7d4939}.imported-book .reading-unit{margin:16px 0 45px}.imported-book .reading-unit h2{margin-top:0}.chapter-nav{display:flex;flex-wrap:wrap;gap:12px}.image-placeholder{color:#7d4939}</style>`;
for(const kind of ['textbooks','notes']){
  const filenames=fs.readdirSync(path.join(courseDir,kind)).filter(s=>s.endsWith('.md')).sort();
  for(const [index,filename] of filenames.entries()){
    const id=`${kind==='textbooks'?'book':'note'}-${String(index+1).padStart(2,'0')}`;
    const file=path.join(courseDir,kind,filename),raw=fs.readFileSync(file,'utf8');
    const started=performance.now(),doc=splitDocument(raw),transformed=transformDocument(doc.tree,doc.parts);
    const stats={imagesSuppressed:0,katexErrors:0};
    const htmlParts=[];
    const bindings=insertions.filter(i=>i.book===id);
    for(const binding of bindings){
      const matches=transformed.parts.flatMap(p=>p.children).filter(n=>/^h[1-6]$/.test(n.tagName??'')&&text(n).trim()===binding.heading);
      if(matches.length!==1)throw new Error(`${id}/${binding.unit}: heading matches ${matches.length}; need explicit review before binding`);
      report.insertions.push({...binding,sourceSha256:sha(raw),headingSha256:sha(binding.heading),authoredTextHashes:content.units.find(u=>u.id===binding.unit).paragraphs.map(p=>({id:p.id,sha256:sha(p.text),state:p.state}))});
    }
    for(const [partIndex,hast] of transformed.parts.entries()){
      sanitize(hast,stats);
      let rendered='';
      for(const node of hast.children){
        rendered+=toHtml(node);
        const heading=/^h[1-6]$/.test(node.tagName??'')?text(node).trim():null;
        for(const binding of bindings)if(heading===binding.heading)rendered+=snippets.get(binding.unit);
      }
      htmlParts.push(`<article id="part-${partIndex}" class="book-part">${rendered}</article>`);
    }
    const nav=doc.chapters.map(p=>`<a href="#part-${p.ordinal}">${escape(p.title)}</a>`).join('');
    const url=`https://github.com/LINJIANG12/video2book-courses/blob/${pin}/${courses&&path.relative(courses,file).split(path.sep).map(encodeURIComponent).join('/')}`;
    const controls=bindings.length?`<label>图跟随 <select id="mode" disabled><option value="pointer">光标</option><option value="scroll">阅读位置</option><option value="static">静态对照</option></select></label><button id="pause" disabled aria-pressed="false">暂停跟随</button><button id="text-only" disabled aria-pressed="false">只读文字</button>`:'';
    const page=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(doc.title)}</title>${css}</head><body><header class="topbar"><a class="brand" href="library.html">CS336 / 书架</a><div class="controls">${controls}</div></header><main class="imported-book"><header class="book-heading"><p class="eyebrow">整册连续阅读 · 本机个人学习实验</p><h1>${escape(doc.title)}</h1><p>原教材完整导入。标注“本轮补充”的图解由当前 Codex 会话编写。正文尚未逐句核对，公式处理成功不代表内容正确。</p><p id="status" role="status" aria-live="polite">正文与静态图可阅读。</p><details><summary>本册目录 · ${doc.chapters.length} 章</summary><nav class="chapter-nav">${nav}</nav></details><p>公式无法排版：${stats.katexErrors} 处。<a href="${escape(url)}" rel="noopener">固定提交的原文</a></p></header>${htmlParts.join('')}<footer>课程内容仅供个人学习，请遵守原仓库说明。<a href="index.html">三个图解的独立实验页</a> · <a href="import-report.json">导入记录</a></footer></main>${bindings.length?'<script type="module" src="app.mjs"></script>':''}</body></html>`;
    fs.writeFileSync(path.join(output,`${id}.html`),page);
    report.files.push({id,kind,title:doc.title,source:path.relative(courses,file),sourceSha256:sha(raw),sourceBytes:Buffer.byteLength(raw),htmlBytes:Buffer.byteLength(page),chapters:doc.chapters.length,parts:doc.parts.length,sourceRoundTrip:doc.sourceRoundTrip??null,emptyChapterSources:doc.chapters.filter(p=>!p.markdown.trim()).length,blockAnchors:transformed.result.blockIndex.size,warnings:doc.warnings,notes:doc.notes,...stats,buildMs:performance.now()-started,htmlSha256:sha(page)});
  }
}
const list=kind=>report.files.filter(f=>f.kind===kind).map(f=>`<li><a href="${f.id}.html">${escape(f.title)}</a><small> ${f.chapters} 章 · ${f.katexErrors} 处公式排版失败${report.insertions.some(i=>i.book===f.id)?' · 含嵌入式图解':''}</small></li>`).join('');
fs.writeFileSync(path.join(output,'library.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CS336 本地可视化书架</title>${css}</head><body><main><header class="book-heading"><p class="eyebrow">从已有教材到 HTML 的实际导入</p><h1>同一条阅读流里，文字和图一起走</h1><p>9 册教材、12 篇笔记完整导入。第 1 册与第 4 册含本轮补充的阅读图解。其余内容保留静态阅读，未自动编造动画。</p><a href="index.html">先试三个图解</a><p>仅供本机个人学习。自动跟随的学习效果仍需真人阅读验证。</p></header><h2>教材</h2><ol>${list('textbooks')}</ol><h2>笔记</h2><ol>${list('notes')}</ol></main></body></html>`);
fs.writeFileSync(path.join(output,'import-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:report.files.length,chapters:report.files.reduce((n,f)=>n+f.chapters,0),katexErrors:report.files.reduce((n,f)=>n+f.katexErrors,0),insertions:report.insertions.length,output}));
