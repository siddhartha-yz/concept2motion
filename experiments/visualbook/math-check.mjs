// Independent oracles for frozen cases; new figures require an explicit review.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root} from './prepare.mjs';
import {renderer} from './figure.mjs';
const section=process.argv[2]??'spatial',attempt=process.argv[3]??'first';
const response=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'candidates',section,attempt,'response.json')));
const checks=[];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function maxPool(input,kernel,stride,padding){
 const h=input.length,w=input[0].length,result=[];
 for(let row=-padding[0];row+kernel[0]<=h+padding[0];row+=stride[0]){
  const values=[];for(let col=-padding[1];col+kernel[1]<=w+padding[1];col+=stride[1]){
   const window=[];for(let i=row;i<row+kernel[0];i++)for(let j=col;j<col+kernel[1];j++)window.push(i<0||j<0||i>=h||j>=w?-Infinity:input[i][j]);values.push(Math.max(...window));
  }result.push(values);
 }return result;
}
for(const figure of response.figures){
 const draw=renderer(figure.code),defaults=Object.fromEntries(figure.controls.map(c=>[c.key,c.value]));
 const params=[defaults];for(const c of figure.controls)for(let value=c.min;value<=c.max+1e-8;value+=c.step)params.push({...defaults,[c.key]:value});
 for(const state of figure.states)for(const p of params){
  const f=draw({width:710,state:state.key,params:p}).facts;let count=0;
  try{
   if(figure.id==='pooling-local-shift'){
    const outputs=f.inputs.map(x=>maxPool(x,[2,2],[1,1],[0,0])[0]);assert.deepEqual(f.outputs,outputs);assert.equal(f.changedOutputCount,outputs[0].filter((v,i)=>v!==outputs[1][i]).length);assert.deepEqual(f.selectedValues,outputs.map(x=>x[1]));count=3;
   }else if(figure.id==='pooling-padding-stride'){
    const out=maxPool(f.input,f.kernel,f.stride,f.padding);assert.deepEqual(f.output,out);assert.deepEqual(f.outputShape,[1,1,out.length,out[0].length]);assert.equal(f.paddingValue,'-Infinity');count=3;
   }else if(figure.id==='sgd-gradient-mean'){
    const losses=f.compatibleLosses;const gradients=losses.map(loss=>loss.b.map((b,i)=>f.parameterPoint[i]+b));assert.deepEqual(f.sampleGradients,gradients);const expected=[0,1].map(axis=>gradients.reduce((sum,g,i)=>sum+f.sampleProbabilities[i]*g[axis],0));expected.forEach((v,i)=>close(v,f.expectedGradient[i]));assert.deepEqual(f.selectedGradient,gradients[f.selectedIndex-1]);count=4;
   }else if(figure.id==='sgd-sampling-coverage'){
    // Binomial probability for a *fixed* item in n independent draws.
    const p=1/f.n,q=1-p;close(f.probabilities.omitted,q**f.n);close(f.probabilities.exactlyOnce,f.n*p*q**(f.n-1));close(f.probabilities.atLeastTwice,1-q**f.n-f.n*p*q**(f.n-1));const counts=Array(f.n).fill(0);f.replacement.draws.forEach(i=>counts[i-1]++);assert.deepEqual(f.replacement.countsBySample,counts);assert.equal(f.replacement.covered,counts.filter(c=>c).length);assert.deepEqual(f.shuffle.permutation.toSorted((a,b)=>a-b),Array.from({length:f.n},(_,i)=>i+1));assert.ok(f.shuffle.countsBySample.every(c=>c===1));count=7;
   }else if(figure.id==='masked-softmax-rows'){
    const rows=f.logits.flat(),lengths=f.validLens.flat();const perRow=f.validLens[0] instanceof Array?lengths:lengths.flatMap(n=>[n,n]);assert.deepEqual(f.expandedValidLens,perRow);
    rows.forEach((row,i)=>{const valid=row.slice(0,perRow[i]).map(Math.exp),sum=valid.reduce((a,b)=>a+b,0);row.forEach((_,j)=>close(f.weights[i][j],j<valid.length?valid[j]/sum:0));close(f.weights[i].reduce((a,b)=>a+b,0),1)});count=22;
   }else if(figure.id==='dot-product-exact-spread'){
    const choose=(n,k)=>{let result=1;for(let i=1;i<=k;i++)result=result*(n-i+1)/i;return result};
    assert.equal(f.distribution.length,f.d+1);
    f.distribution.forEach((point,j)=>{assert.equal(point.raw,f.d-2*j);close(point.probability,choose(f.d,j)/2**f.d);close(point.scaled,point.raw/Math.sqrt(f.d))});
    const mean=field=>f.distribution.reduce((a,p)=>a+p[field]*p.probability,0),variance=field=>f.distribution.reduce((a,p)=>a+(p[field]-mean(field))**2*p.probability,0);
    close(mean('raw'),0);close(mean('scaled'),0);close(variance('raw'),f.d);close(variance('scaled'),1);close(f.rawVariance,variance('raw'));close(f.scaledVariance,variance('scaled'));count=7+f.distribution.length*3;
   }else if(figure.id==='allreduce-vector-steps'){
    const sum=f.initial[0].map((v,i)=>v+f.initial[1][i]);assert.deepEqual(f.sum,sum);
    const expected=f.phase==='local'?f.initial:f.phase==='sum'?[sum,f.initial[1]]:[sum,sum];assert.deepEqual(f.current,expected);assert.equal(f.completedSteps,{local:0,sum:1,broadcast:2}[f.phase]);count=3;
   }else if(figure.id==='global-batch-gradient-normalization'){
    const gradients=f.sampleTargets.map(a=>f.initialParameter-a);assert.deepEqual(f.perSampleGradients,gradients);const total=gradients.reduce((a,b)=>a+b,0);close(f.aggregateGradientSum,total);assert.equal(f.normalizationDenominator,gradients.length);const indices=f.shards.flatMap(s=>Array.from({length:s.count},(_,i)=>s.start+i));assert.deepEqual(indices,gradients.map((_,i)=>i));f.shards.forEach(s=>close(s.localGradientSum,gradients.slice(s.start,s.endExclusive).reduce((a,b)=>a+b,0)));const updated=f.initialParameter-f.learningRate*total/gradients.length;f.updatedParameters.forEach(theta=>close(theta,updated));count=4+f.shards.length+f.updatedParameters.length;
   }else throw Error('No independent oracle for '+figure.id);
   checks.push({figure:figure.id,state:state.key,params:p,pass:true,assertions:count});
  }catch(error){checks.push({figure:figure.id,state:state.key,params:p,pass:false,error:String(error)})}
 }
}
const result={section,attempt,scope:'Independent numeric recomputation for reviewed frozen examples; not trained weights, runtime measurements or artistic acceptance',checks,passed:checks.filter(c=>c.pass).length,total:checks.length};
const out=path.join(root,'evaluation/2026-10-10/d2l-visualbook-v1/math');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${section}-${attempt}.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({section,attempt,passed:result.passed,total:result.total,failures:checks.filter(c=>!c.pass)}));process.exitCode=result.passed===result.total?0:1;
