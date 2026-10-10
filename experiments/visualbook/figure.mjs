import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from './prepare.mjs';
const {parse}=await import(pathToFileURL(path.join(root,'work/visualbook/runtime/node_modules/@babel/parser/lib/index.js')));
// This is a guard against accidental I/O, not a hostile-code security boundary.
// Only reviewed Codex candidates are run here. Never accept uploaded code.
export function validateCode(code){
  if(/<\/script/i.test(code))throw new Error('Closing script tag in candidate');
  const tree=parse(code,{sourceType:'script'});
  const forbidden=new Set(['process','require','module','exports','global','globalThis','window','document','fetch','XMLHttpRequest','WebSocket','eval','Function','setTimeout','setInterval','Date','performance','constructor','__proto__','prototype']);
  function walk(n,parent=null,key=null){
    if(!n||typeof n!=='object')return;
    if(['ImportDeclaration','ImportExpression','ExportNamedDeclaration','ExportDefaultDeclaration','WithStatement','ThisExpression','NewExpression'].includes(n.type))throw new Error('Unsupported syntax '+n.type);
    const ordinaryKey=(parent?.type==='ObjectProperty'&&key==='key'&&!parent.computed)||(parent?.type==='MemberExpression'&&key==='property'&&!parent.computed);
    if(n.type==='Identifier'&&forbidden.has(n.name)&&(!ordinaryKey||['constructor','__proto__','prototype'].includes(n.name)))throw new Error('Unsupported global/property '+n.name);
    if(n.type==='MemberExpression'&&(n.computed&&!['NumericLiteral'].includes(n.property.type)&&n.object.type==='Identifier'&&['Math','Object','Reflect'].includes(n.object.name)))throw new Error('Dynamic standard-object access');
    if(n.type==='MemberExpression'&&n.object?.name==='Math'&&n.property?.name==='random')throw new Error('Unseeded randomness');
    for(const [k,v] of Object.entries(n))if(!['loc','start','end','extra','comments'].includes(k)){if(Array.isArray(v))v.forEach(child=>walk(child,n,k));else walk(v,n,k)}
  }
  walk(tree);return true;
}
export function renderer(code){
  validateCode(code);
  const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
  new vm.Script(code+'\nif (typeof render !== "function") throw Error("Missing render");').runInContext(context,{timeout:500});
  return args=>{
    context.input=JSON.parse(JSON.stringify(args));
    const value=new vm.Script('JSON.stringify(render(input))').runInContext(context,{timeout:500});
    const result=JSON.parse(value);
    if(typeof result.svg!=='string'||!/^\s*<svg\b/.test(result.svg))throw new Error('Missing SVG');
    if(/<(script|foreignObject|image|iframe)\b|\bon\w+\s*=|\b(?:href|src)\s*=|javascript:|url\(\s*["']?https?:/i.test(result.svg))throw new Error('Unsupported SVG content');
    if(!result.facts||typeof result.facts!=='object')throw new Error('Missing numerical facts');
    return result;
  };
}
export function validateResponse(book,response){
  if(!Array.isArray(response.figures)||response.figures.length<1||response.figures.length>2)throw new Error('Need one or two figures');
  const ids=new Set();const bindings=[];
  for(const f of response.figures){
    if(!/^[a-z][a-z0-9-]*$/.test(f.id)||ids.has(f.id))throw new Error('Invalid/duplicate figure id');ids.add(f.id);
    const find=id=>{const i=book.blocks.findIndex(b=>b.id===id);if(i<0)throw new Error('Missing anchor '+id);return i};
    const after=find(f.afterAnchor),positions=f.states.map(s=>find(s.anchor));
    if(f.states.length<1||f.states.length>5||new Set(f.states.map(s=>s.key)).size!==f.states.length)throw new Error('Invalid states');
    if(positions.some((p,i)=>i>0&&p<positions[i-1]))throw new Error('States out of source order');
    if(Math.max(after,...positions)-Math.min(after,...positions)>12)throw new Error('Figure spans too much source; split the explanation');
    for(const c of f.controls)if(!/^[a-z][a-zA-Z0-9]*$/.test(c.key)||![c.min,c.max,c.step,c.value].every(Number.isFinite)||c.min>=c.max||c.step<=0||c.value<c.min||c.value>c.max)throw new Error('Invalid parameter '+c.key);
    const draw=renderer(f.code),params=Object.fromEntries(f.controls.map(c=>[c.key,c.value]));
    for(const width of [320,760])for(const state of f.states)draw({width,state:state.key,params});
    bindings.push({id:f.id,after,start:Math.min(after,...positions),end:Math.max(after,...positions),anchors:[...new Set([f.afterAnchor,...f.states.map(s=>s.anchor)])].map(id=>({id,sha256:book.blocks[find(id)].sha256}))});
  }
  const sorted=bindings.toSorted((a,b)=>a.start-b.start);
  if(sorted.some((b,i)=>i>0&&b.start<=sorted[i-1].end))throw new Error('Figure scopes overlap');
  return bindings;
}
