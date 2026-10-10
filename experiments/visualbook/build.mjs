import fs from 'node:fs';
import path from 'node:path';
import {prepare,output,root,dependencies,sha,escape} from './prepare.mjs';
import {renderer,validateResponse} from './figure.mjs';
const activePath=path.join(import.meta.dirname,'active.json');
const active=fs.existsSync(activePath)?JSON.parse(fs.readFileSync(activePath)):{};
let katexCss=fs.readFileSync(path.join(dependencies,'node_modules/katex/dist/katex.min.css'),'utf8');
katexCss=katexCss.replace(/url\(([^)]+)\)/g,(whole,name)=>{const file=path.join(dependencies,'node_modules/katex/dist',name);return fs.existsSync(file)?`url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')})`:whole});
const css=fs.readFileSync(path.join(import.meta.dirname,'style.css'),'utf8')+katexCss;
const app=fs.readFileSync(path.join(import.meta.dirname,'app.js'),'utf8');
const head=title=>`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'"><title>${escape(title)}</title><style>${css}</style></head>`;
const block=b=>`<div class="source-block" id="${b.id}" data-source-sha256="${b.sha256}">${b.html}</div>`;
const records=[];
for(const book of prepare()){
 const attempt=process.env.VISUALBOOK_ATTEMPT??active[book.id];
 let response={figures:[]},bindings=[],error=null;
 if(attempt){
  const candidate=path.join(import.meta.dirname,'candidates',book.id,attempt);
  try{
   const brief=JSON.parse(fs.readFileSync(path.join(candidate,'brief.json')));
   if(brief.sourceSha256!==book.sourceSha256||brief.sourceCommit!==book.sourceCommit)throw new Error('Candidate source is stale');
   response=JSON.parse(fs.readFileSync(path.join(candidate,'response.json')));bindings=validateResponse(book,response);
  }catch(e){error=String(e);response={figures:[]};bindings=[]}
 }
 const allFigures=[];
 function figure(f){
  const render=renderer(f.code),params=Object.fromEntries(f.controls.map(c=>[c.key,c.value]));
  const fallback=render({width:710,state:f.states[0].key,params}).svg;
  const mobile=render({width:335,state:f.states[0].key,params}).svg;
  const data=s=>'data:image/svg+xml;base64,'+Buffer.from(s).toString('base64');
  allFigures.push(f);
  const states=f.states.map(s=>`<button data-state="${escape(s.key)}" aria-pressed="${s===f.states[0]}">${escape(s.label)}</button>`).join('');
  const controls=f.controls.map(c=>`<label>${escape(c.label)}<input aria-label="${escape(c.label)}" type="range" data-param="${escape(c.key)}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}"><output>${c.value}</output></label>`).join('');
  return `<figure class="visual${f.states.length>1?' sticky':''}" id="figure-${f.id}" aria-label="${escape(f.alt)}"><div class="figure-top"><h3>${escape(f.title)}</h3><span class="kind">补充图解</span></div><div class="graphic"><div class="live">${fallback}</div><picture class="fallback"><source media="(max-width:600px)" srcset="${data(mobile)}"><img src="${data(fallback)}" alt="${escape(f.alt)}"></picture></div><details class="fig-controls"><summary>自己试一下</summary><div class="states">${states}</div><div class="ranges">${controls}</div><button class="reset">回到阅读位置</button></details><p class="figure-status" role="status" aria-live="polite"></p></figure>`;
 }
 let body='',i=1; // h1 is the displayed book title, retained once.
 while(i<book.blocks.length){
  const bind=bindings.find(b=>b.start===i);
  if(bind){
   const f=response.figures.find(f=>f.id===bind.id);body+='<div class="viz-scope">';
   for(let j=bind.start;j<=bind.end;j++){body+=block(book.blocks[j]);if(j===bind.after)body+=figure(f)}
   body+='</div>';i=bind.end+1;
  }else{body+=block(book.blocks[i]);i++}
 }
 const serial=JSON.stringify({figures:allFigures}).replaceAll('<','\\u003c');
 const functions=allFigures.map(f=>`${JSON.stringify(f.id)}:(()=>{${f.code}\n;return render})()`).join(',');
 const toc=book.blocks.filter(b=>b.type==='heading'&&b.depth===2).map(b=>`<a href="#${b.id}">${escape(b.raw.replace(/^#+ /,''))}</a>`).join('');
 const metadata=`<p class="source-note">来源：<a href="${book.sourceUrl}">D2L 原版</a>。本地保留正文、原图和 PyTorch 代码，未执行代码，也没有补造代码输出。新增图解来自实验生成，尚待你试读。</p>`;
 const top=`<a class="skip" href="#text">跳到正文</a><header class="top"><a class="brand" href="index.html">D2L / 试读书架</a><div class="top-actions"><label><input id="follow" type="checkbox" checked>随阅读</label><button id="original" aria-pressed="false">只看原文</button></div></header>`;
 const review=`<aside class="review-note"><details><summary>来源与实验说明</summary><p>原文作者：D2L 作者团队。固定源码提交 ${book.sourceCommit.slice(0,12)}；选择 PyTorch 版本，转换原文引用为来源链接、移除构建标记、插入独立图解；公式和图片由本地导入。<a href="D2L-LICENSE.txt">上游 Apache 2.0 许可证</a>。示意参数和实验假设见图的审查记录，不能当成训练结果。图运行失败时显示静态图。</p><p>新增图 ${allFigures.length} 幅；版本 ${escape(attempt??'未生成')}。${error?'本版本插入失败，已保留正文：'+escape(error):''}</p></details></aside>`;
 const html=head(book.title)+`<body>${top}<main class="book" id="text"><header class="book-head"><p class="eyebrow">边读 · 边看清关系</p><h1 id="${book.blocks[0].id}">${escape(book.title)}</h1>${metadata}<details><summary>本节目录</summary><nav class="toc">${toc}</nav></details></header>${body}${review}<footer><a href="index.html">回到试读书架</a></footer></main><noscript><style>.live{display:none}.graphic .fallback{display:block}.fig-controls,.top-actions{display:none}.visual.sticky{position:relative;top:0}</style></noscript><script type="application/json" id="visualbook-data">${serial}</script><script>${app}\nconst data=JSON.parse(document.querySelector('#visualbook-data').textContent);data.renderers={${functions}};startVisualbook(data);</script></body></html>`;
 fs.writeFileSync(path.join(output,`${book.id}${process.env.VISUALBOOK_ATTEMPT?'-'+attempt:''}.html`),html);
 records.push({id:book.id,title:book.title,attempt,sourceSha256:book.sourceSha256,adaptation:book.adaptation,blocks:book.blocks.length,figures:allFigures.length,bindings,error,htmlSha256:sha(html)});
}
fs.writeFileSync(path.join(output,'build-report.json'),JSON.stringify(records,null,2)+'\n');
const descriptions={spatial:'看清一个窗口如何汇总输入，以及各通道为何互不混合。',iteration:'观察随机更新与学习率变化，不把单次轨迹当成普遍结论。',routing:'把分数、掩蔽、权重和输出联系起来。',execution:'看清数据拆分、梯度聚合与相同参数更新。'};
const rows=records.map(b=>`<li><a href="${b.id}.html">${escape(b.title)}</a><p>${descriptions[b.id]}</p><div class="variants"><a href="${b.id}.html?original=1">原文对照</a><a href="${b.id}-first.html">保留的首版</a></div></li>`).join('');
fs.writeFileSync(path.join(output,'index.html'),head('D2L 可视化教材试读')+`<body><main class="library"><p class="eyebrow">TEXTBOOK → VISUALBOOK</p><h1>读懂一个关系，<br>再接着读下去。</h1><p class="library-intro">图解放在它解释的段落附近。默认随阅读变化；想多看一会儿，就打开图下方的“自己试一下”。没有自动播放，也不需要跟着鼠标。</p><ul class="book-list">${rows}</ul><p class="notice">四节从预登记候选池随机抽取。这是可供你审查的实验版本，不能据此宣称学习效率提高。原文对照保留原图与公式；本地源码不含代码运行输出，完整版请看每节的 D2L 原版链接。</p></main></body></html>`);
console.log(JSON.stringify(records.map(({id,attempt,figures,error})=>({id,attempt,figures,error}))));
