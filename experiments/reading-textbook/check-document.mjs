import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {splitDocument,transformDocument} from './document.mjs';
import {sanitize} from './html-policy.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const {toHtml}=await import(pathToFileURL(path.join(root,'work/reading-textbook/node-mirror/node_modules/hast-util-to-html/index.js')));
const {splitDocument:original}=await import(pathToFileURL(path.join(root,'work/reading-textbook/upstreams/video2book-reader/packages/reader/src/model/split-document.ts')));
const out=path.join(root,'evaluation/2026-10-10/reading-textbook-v1/raw/source-audit');fs.mkdirSync(out,{recursive:true});
const checks=[];
function check(name,fn){try{checks.push({name,pass:true,evidence:fn()});}catch(e){checks.push({name,pass:false,error:String(e.stack)});}console.log(`${checks.at(-1).pass?'PASS':'FAIL'} ${name}`);}
check('fenced headings never become chapters',()=>{
  const raw='# Title\n\n## One\n\n```markdown\n## Fake\n$$x\n```\n\n## Two\nText\n';
  const d=splitDocument(raw);assert.deepEqual(d.chapters.map(c=>c.title),['One','Two']);assert.equal(d.sourceRoundTrip,true);return {chapters:d.chapters.length};
});
check('broken formula cannot empty or relocate a chapter source',()=>{
  const raw='# Title\n\n## One\n$$x=\ntext\n\n## Two\nsecond chapter\n$$\n';
  const d=splitDocument(raw);assert.equal(d.sourceRoundTrip,true);assert.equal(d.chapters.length,2);assert.ok(d.chapters[0].markdown.startsWith('## One'));assert.ok(d.chapters[1].markdown.startsWith('## Two'));return {sources:d.chapters.map(c=>c.markdown)};
});
check('oversized math preserves source and falls back visibly',()=>{
  const raw='# Title\n## One\n$$\n'+Array.from({length:20},(_,i)=>`x_${i}=1`).join('\n')+'\n$$\nText after math\n';
  const d=splitDocument(raw);assert.equal(d.sourceRoundTrip,true);assert.equal(d.notes.length,1);const h=transformDocument(d.tree,d.parts);const html=h.parts.map(p=>toHtml(p)).join('');assert.ok(html.includes('Text after math'));assert.ok(html.includes('x_19'));return {notes:d.notes};
});
check('raw HTML, script URLs and tracking images do not execute',()=>{
  const raw='# Title\n## One\n<script>window.BAD=1</script>\n\n[unsafe](javascript:alert(1))\n\n![tracker](https://example.com/track.png)\n\n$\\href{javascript:alert(1)}{x}$\n';
  const d=splitDocument(raw),h=transformDocument(d.tree,d.parts),stats={imagesSuppressed:0,katexErrors:0};h.parts.forEach(p=>sanitize(p,stats));const html=h.parts.map(p=>toHtml(p)).join('');assert.ok(!/<script|<img|href="javascript:/i.test(html));assert.equal(stats.imagesSuppressed,1);return {stats,html};
});
const course=path.join(root,'work/reading-textbook/upstreams/video2book-courses/计算机/人工智能/大模型/Stanford-CS336-从头构建大语言模型');
const audit=[];
for(const kind of ['textbooks','notes'])for(const filename of fs.readdirSync(path.join(course,kind)).filter(n=>n.endsWith('.md')).sort()){
  check(`source identity: ${kind}/${filename}`,()=>{
    const raw=fs.readFileSync(path.join(course,kind,filename),'utf8'),a=original(raw),b=splitDocument(raw);
    assert.equal(b.sourceRoundTrip,true);assert.deepEqual(b.chapters.map(c=>c.title),a.chapters.map(c=>c.title));assert.ok(b.chapters.every(c=>c.markdown.startsWith('## ')));
    const record={filename,kind,chapters:b.chapters.length,originalEmptyChapters:a.chapters.filter(c=>!c.markdown.trim()).map(c=>c.title),originalWrongChapterStart:a.chapters.filter(c=>c.markdown.trim()&&!c.markdown.startsWith(`## ${c.title}`)).map(c=>({title:c.title,starts:c.markdown.slice(0,100)})),ownEmptyChapters:b.chapters.filter(c=>!c.markdown.trim()).length,ownRoundTrip:b.sourceRoundTrip,guardedRegions:b.notes};audit.push(record);return record;
  });
}
const report={checks,audit,passed:checks.filter(c=>c.pass).length,total:checks.length,scope:'Source-preservation and input-policy probes, not factual validation of every chapter'};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,total:report.total,originalEmptyChapters:audit.reduce((n,f)=>n+f.originalEmptyChapters.length,0),originalWrongStarts:audit.reduce((n,f)=>n+f.originalWrongChapterStart.length,0)}));process.exitCode=report.passed===report.total?0:1;
