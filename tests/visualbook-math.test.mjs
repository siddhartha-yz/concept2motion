import test from 'node:test';
import assert from 'node:assert/strict';
import {renderingMath,countMath,inspectMath} from '../packages/visualbook/math.mjs';
test('standalone display adaptation contains HTML math metadata rather than raw text',()=>{
 const node={type:'math',value:'\\frac{1}{2} + \\sum_i x_i'};
 const converted=renderingMath(node);
 assert.equal(converted.data.hChildren[0].properties.className[1],'math-display');
 assert.equal(converted.data.hChildren[0].children[0].value,node.value);
 assert.deepEqual(node,{type:'math',value:'\\frac{1}{2} + \\sum_i x_i'});
});
test('line-break adaptation changes the value actually consumed by HTML compiler',()=>{
 const converted=renderingMath({type:'math',value:'a=b\\\\ c=d',data:{hChildren:[{value:'old'}]}});
 assert.equal(converted.data.hChildren[0].children[0].value,'\\begin{aligned}\na=b\\\\ c=d\n\\end{aligned}');
});
test('formula with no renderer error still fails when it was not rendered',()=>{
 assert.throws(()=>inspectMath({type:'root',children:[{type:'text',value:'\\frac{1}{2}'}]},1),/expected=1, rendered=0/);
 assert.throws(()=>inspectMath({properties:{className:['language-math']},children:[]},1),/pending=1/);
});
test('counts nested inline formulas separately from code text',()=>{
 assert.equal(countMath({type:'paragraph',children:[{type:'inlineMath',value:'x'},{type:'inlineCode',value:'$x$'},{type:'strong',children:[{type:'inlineMath',value:'y'}]}]}),2);
});
