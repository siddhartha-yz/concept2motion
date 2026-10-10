// Broader parser coverage, without any model generation or source modification.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),base=path.join(root,'work/visualbook/upstreams/d2l-zh'),out=path.resolve(process.argv[2]??path.join(root,'work/harness-v2/import-audit'));
if(fs.existsSync(out))throw Error('Audit directory exists');fs.mkdirSync(out,{recursive:true});
process.env.VISUALBOOK_OUTPUT=path.join(out,'sources');process.env.VISUALBOOK_SAMPLING=path.join(out,'sampling.json');
const {prepare}=await import('../experiments/visualbook/prepare.mjs');
const groups=['chapter_preliminaries','chapter_linear-networks','chapter_multilayer-perceptrons','chapter_convolutional-neural-networks','chapter_optimization','chapter_deep-learning-computation'];
const results=[];
for(const dir of groups)for(const filename of fs.readdirSync(path.join(base,dir)).filter(f=>f.endsWith('.md')&&!f.endsWith('_origin.md')&&f!=='index.md').sort()) {
 const selected=dir+'/'+filename,bytes=fs.readFileSync(path.join(base,selected)),id=(dir.replace('chapter_','')+'-'+filename.slice(0,-3)).replaceAll('_','-');
 const manifest={upstream_commit:'e6b18ccea71451a55fcd861d7b96fddf2587b09a',sections:[{stratum:id,selected,source_sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]};
 fs.writeFileSync(process.env.VISUALBOOK_SAMPLING,JSON.stringify(manifest));
 try{const book=prepare()[0];results.push({source:selected,blocks:book.blocks.length,math:book.adaptation.mathExpected,status:'compiled-with-coverage'});}catch(error){results.push({source:selected,status:'failed',error:String(error)});}
}
const report={groups,chapters:results.length,compiled:results.filter(r=>r.status==='compiled-with-coverage').length,failed:results.filter(r=>r.status==='failed'),formulas:results.reduce((n,r)=>n+(r.math??0),0),results,modelCalls:0,scope:'source parser/KaTeX coverage only; no claim of browser layout, formula truth or generated book quality'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:undefined}));
