// Independent small importer, using licensed parser libraries. Split the source
// BEFORE math interpretation so a broken formula cannot swallow chapter sources.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const modules=path.resolve(import.meta.dirname,'../../work/reading-textbook/node-mirror/node_modules');
const get=async name=>import(pathToFileURL(path.join(modules,name,'index.js')));
const {unified}=await get('unified');
const {default:remarkParse}=await get('remark-parse');
const {default:remarkGfm}=await get('remark-gfm');
const {default:remarkMath}=await get('remark-math');
const {toHast}=await get('mdast-util-to-hast');
const {default:rehypeKatex}=await get('rehype-katex');
const {toString}=await get('mdast-util-to-string');
const structural=unified().use(remarkParse).use(remarkGfm);
const mathematical=unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const nodeText=n=>toString(n).replace(/\s+/g,' ').trim();

function boundedMath(raw,globalStartLine,notes){
  const tree=mathematical.parse(raw);
  function walk(parent){
    for(let i=0;i<(parent.children??[]).length;i++){
      const node=parent.children[i];
      const oversized=node.type==='math'&&((node.position.end.line-node.position.start.line)>11||/^#{1,6} /m.test(node.value));
      const longInline=node.type==='inlineMath'&&node.value.length>300;
      if(oversized||longInline){
        const original=raw.slice(node.position.start.offset,node.position.end.offset);
        notes.push({kind:node.type,from:globalStartLine+node.position.start.line-1,to:globalStartLine+node.position.end.line-1,reason:'formula interpretation too large; exact source rendered as ordinary Markdown/text'});
        const replacements=node.type==='math'?structural.parse(original).children:[{type:'text',value:original,position:node.position}];
        parent.children.splice(i,1,...replacements);i+=replacements.length-1;
      }else walk(node);
    }
  }
  walk(tree);return tree;
}

export function splitDocument(markdown){
  const structure=structural.parse(markdown);
  const headings=structure.children.filter(n=>n.type==='heading'&&n.depth===2);
  const firstTitle=structure.children.find(n=>n.type==='heading'&&n.depth===1);
  const title=firstTitle?nodeText(firstTitle):'无标题';
  const bounds=[0,...headings.map(n=>n.position.start.offset),markdown.length].filter((n,i,a)=>i===0||n!==a[i-1]);
  const parts=[],notes=[],children=[];
  let chapterIndex=0;
  const guide=headings.find(n=>nodeText(n).includes('全景目录'));
  const summary=[...headings].reverse().find(n=>/小结|总结/.test(nodeText(n)));
  for(let i=0;i<bounds.length-1;i++){
    const from=bounds[i],to=bounds[i+1],source=markdown.slice(from,to);
    const heading=headings.find(n=>n.position.start.offset===from);
    const role=heading===guide&&guide?'guide':heading===summary&&summary?'summary':heading?'chapter':'head';
    if(role==='chapter')chapterIndex++;
    const startLine=markdown.slice(0,from).split('\n').length;
    const parsed=boundedMath(source,startLine,notes),start=children.length;
    children.push(...parsed.children);
    parts.push({ordinal:parts.length,role,chapterIndex:role==='chapter'?chapterIndex:0,title:heading?nodeText(heading):title,nodeRange:[start,children.length],markdown:source,source:{from,to,startLine,endLine:markdown.slice(0,to).split('\n').length}});
  }
  return {title,tree:{type:'root',children},parts,chapters:parts.filter(p=>p.role==='chapter'),notes,warnings:[],sourceRoundTrip:parts.map(p=>p.markdown).join('')===markdown};
}

export function transformDocument(tree,parts){
  const result={blockIndex:new Map()};
  const output=parts.map(part=>{
    const hast=toHast({type:'root',children:tree.children.slice(...part.nodeRange)},{allowDangerousHtml:false});
    unified().use(rehypeKatex,{trust:false,strict:'warn'}).runSync(hast);
    let count=0;
    for(const node of hast.children){
      if(node.type!=='element')continue;
      const id=`${part.ordinal}-${++count}`;
      node.properties={...node.properties,'data-block-id':id};
      if(/^h[1-6]$/.test(node.tagName))node.properties.id=id;
      result.blockIndex.set(id,{chapterIndex:part.chapterIndex});
    }
    return hast;
  });
  return {parts:output,result};
}
