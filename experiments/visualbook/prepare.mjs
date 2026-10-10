import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
export const root=path.resolve(import.meta.dirname,'../..');
export const output=path.resolve(process.env.VISUALBOOK_OUTPUT??path.join(root,'outputs/visualbook'));
export const upstream=path.join(root,'work/visualbook/upstreams/d2l-zh');
export const dependencies=path.resolve(process.env.VISUALBOOK_DEPENDENCIES??path.join(root,'work/visualbook/runtime'));
export const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
export const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const get=async (name,file='index.js')=>import(pathToFileURL(path.join(dependencies,'node_modules',name,file)));
const {unified}=await get('unified'),{default:parse}=await get('remark-parse'),{default:gfm}=await get('remark-gfm'),{default:math}=await get('remark-math');
const {toHast}=await get('mdast-util-to-hast'),{toHtml}=await get('hast-util-to-html'),{default:katex}=await get('rehype-katex');
const parser=unified().use(parse).use(gfm).use(math);

export function adapt(source){
  const report={excludedTabBlocks:0,excludedCodeBlocks:0,keptCodeBlocks:0,removedDirectives:0};
  // Keep line breaks for traceable locations. Untagged Python input is D2L's
  // default MXNet variant; explicit `all`/PyTorch variants are retained.
  let text=source.replace(/:begin_tab:`([^`]+)`\s*\n([\s\S]*?):end_tab:/g,(whole,tabs,body)=>{
    if(tabs.split(/[, ]+/).some(t=>['pytorch','all'].includes(t)))return body;
    report.excludedTabBlocks++;return '\n'.repeat(whole.split('\n').length-1);
  });
  text=text.replace(/```([^\n]*)\n([\s\S]*?)```/g,(whole,lang,body)=>{
    const tab=body.match(/^#@tab (.+)$/m)?.[1];
    const keep=!lang.includes('.input')||(tab&&tab.split(/[, ]+/).some(t=>['pytorch','all'].includes(t)));
    if(!keep){report.excludedCodeBlocks++;return '\n'.repeat(whole.split('\n').length-1)}
    report.keptCodeBlocks++;
    return '```'+(lang.includes('.python')?'python':lang)+'\n'+body.replace(/^#@(tab|save).*\n/gm,'')+'```';
  });
  text=text.replace(/^:(label|eqlabel):`[^`]+`\s*$/gm,()=>{report.removedDirectives++;return ''});
  text=text.replace(/\[\*\*([^]*?)\*\*\]/g,'**$1**').replace(/\(\*\*([^]*?)\*\*\)/g,'**$1**');
  // Keep cross-reference identity rather than inventing section numbers.
  text=text.replace(/:(numref|eqref|cite):`([^`]+)`/g,'[原文引用：$2](SOURCE_URL)');
  return {text,report};
}

function inlineImages(hast,sourcePath,stats){
  for(const n of hast.children??[]){
    if(n.tagName==='img'){
      const target=path.resolve(path.dirname(sourcePath),n.properties.src);
      if(!target.startsWith(upstream+path.sep)||!fs.existsSync(target))throw new Error('Image outside source or missing: '+target);
      const ext=path.extname(target).slice(1);n.properties.src=`data:image/${ext==='svg'?'svg+xml':ext};base64,${fs.readFileSync(target).toString('base64')}`;
      n.properties.loading='lazy';stats.images++;
    }
    if(n.properties?.className?.includes('katex-error'))stats.mathErrors++;
    inlineImages(n,sourcePath,stats);
  }
}
export function prepare(){
  const sampling=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'sampling.json')));
  const pin=execFileSync('git',['-C',upstream,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(pin!==sampling.upstream_commit)throw new Error('D2L commit changed');
  fs.mkdirSync(output,{recursive:true});
  const books=[];
  for(const sample of sampling.sections){
    const sourcePath=path.join(upstream,sample.selected),source=fs.readFileSync(sourcePath,'utf8');
    if(sha(source)!==sample.source_sha256)throw new Error('D2L source changed');
    const sourceUrl=`https://zh.d2l.ai/${sample.selected.replace(/\.md$/,'.html')}`;
    const {text,report}=adapt(source);const adapted=text.replaceAll('SOURCE_URL',sourceUrl);
    const tree=parser.parse(adapted),stats={images:0,mathErrors:0};
    const blocks=tree.children.map((node,index)=>{
      const raw=adapted.slice(node.position.start.offset,node.position.end.offset);
      const id=`${sample.stratum}-${String(index+1).padStart(3,'0')}`;
      // D2L's Sphinx renderer wraps top-level line breaks in `split`. KaTeX
      // requires an explicit environment. Keep raw/hash unchanged; this is
      // solely a rendering adaptation, not a source or equation rewrite.
      let renderedNode=node;
      if(node.type==='math'&&node.value.includes('\\\\')&&!node.value.includes('\\begin{')){
        renderedNode={...node,value:'\\begin{aligned}\n'+node.value+'\n\\end{aligned}'};
        report.multilineMathWrapped=(report.multilineMathWrapped??0)+1;
      }
      const hast=toHast({type:'root',children:[renderedNode]},{allowDangerousHtml:false});
      unified().use(katex,{trust:false,strict:'ignore'}).runSync(hast);inlineImages(hast,sourcePath,stats);
      return {id,sha256:sha(raw),type:node.type,depth:node.depth??null,line:node.position.start.line,raw,html:toHtml(hast)};
    });
    const book={id:sample.stratum,title:blocks.find(b=>b.type==='heading')?.raw.replace(/^#+ /,'')??sample.stratum,source:sample.selected,sourceUrl,sourceCommit:pin,sourceSha256:sha(source),adaptedSha256:sha(adapted),adaptation:{...report,...stats},blocks};
    fs.writeFileSync(path.join(output,`${book.id}.source.json`),JSON.stringify(book,null,2)+'\n');books.push(book);
  }
  fs.copyFileSync(path.join(upstream,'LICENSE'),path.join(output,'D2L-LICENSE.txt'));
  return books;
}
if(process.argv[1]===import.meta.filename)console.log(JSON.stringify(prepare().map(b=>({id:b.id,title:b.title,blocks:b.blocks.length,...b.adaptation}))));
