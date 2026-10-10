import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { computeMath } from "../tools/visualbook_math.mjs";
import {operations} from '../tools/visualbook_math.mjs';
const T = createRequire(import.meta.url)("../packages/visualbook/neural.cjs");
import {validateScene} from '../tools/visualbook.mjs';
const close = (a, b, t = 1e-9) =>
  assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
test("attention equals an independently expanded dot/exp/weighted sum, including allowed-mask semantics", () => {
  const query = [1, 2],
    keys = [
      [1, 0],
      [0, 1],
      [-1, 1],
    ],
    values = [
      [2, 1],
      [0, 3],
      [-2, 4],
    ],
    temperature = 0.7;
  const scores = keys.map(
    (k) => (query[0] * k[0] + query[1] * k[1]) / Math.sqrt(2),
  );
  const terms = scores.map((s) => Math.exp(s / temperature));
  const z = terms.reduce((a, b) => a + b);
  const expected = values[0].map((_, c) =>
    terms.reduce((s, t, i) => s + (t * values[i][c]) / z, 0),
  );
  const r = T.attention([query], keys, values, { temperature });
  r.output[0].forEach((v, i) => close(v, expected[i]));
  close(
    r.weights[0].reduce((a, b) => a + b),
    1,
  );
  assert.deepEqual(
    T.attention([query], keys, values, { mask: [[false, true, false]] }).output,
    [[0, 3]],
  );
  assert.throws(
    () => T.attention([query], keys, values, { mask: [[false, false, false]] }),
    /All-masked/,
  );
  assert.throws(() => T.attention([[1]], keys, values), /matching/);
  assert.deepEqual(T.softmax([1e308, 1e308], 1e-300), [0.5, 0.5]);
  assert.deepEqual(T.softmax([2, -1], 0.01), [1, Math.exp(-300)]);
});
test("normalization distinguishes axes, denominator, epsilon and feature affine parameters", () => {
  const data = [
    [1, 2, 3],
    [3, 4, 5],
  ];
  const batch = T.normalize(data, { epsilon: 1e-4 });
  assert.deepEqual(batch.mean, [2, 3, 4]);
  assert.deepEqual(batch.variance, [1, 1, 1]);
  close(batch.output[0][0], -1 / Math.sqrt(1.0001));
  const layer = T.normalize(data, {
    axis: 1,
    epsilon: 0.01,
    gamma: [2, 3, 4],
    beta: [1, 2, 3],
  });
  assert.deepEqual(layer.mean, [2, 4]);
  layer.variance.forEach((v) => close(v, 2 / 3));
  close(layer.output[0][0], 1 - 2 / Math.sqrt(2 / 3 + 0.01));
  close(layer.output[1][2], 3 + 4 / Math.sqrt(2 / 3 + 0.01));
  assert.deepEqual(T.normalize([[7, 7]], { axis: 1 }).output, [[0, 0]]);
  const running = T.normalize([[3, 5]], {
    mode: "running",
    runningMean: [1, 1],
    runningVariance: [4, 16],
    epsilon: 0.0001,
  });
  close(running.output[0][1], 4 / Math.sqrt(16.0001));
  assert.throws(
    () => T.normalize(data, { axis: 1, mode: "running" }),
    /per-feature/,
  );
  assert.throws(() => T.normalize(data, { mode: "running" }), /Running mean/);
  assert.throws(() => T.normalize(data, { epsilon: 0 }), /epsilon/);
});
test("dense layers and fixed-mask dropout preserve explicit input/output conventions", () => {
  assert.deepEqual(
    T.matmul(
      [[1, 2]],
      [
        [3, 4],
        [5, 6],
      ],
    ),
    [[13, 16]],
  );
  const r = T.dense(
    [[1, 2]],
    [
      [1, -2],
      [3, 1],
    ],
    { bias: [1, 0], activation: "relu" },
  );
  assert.deepEqual(r.preactivation, [[8, 0]]);
  assert.deepEqual(r.output, [[8, 0]]);
  const data = [
      [1, -2],
      [3, 4],
    ],
    mask = [
      [true, false],
      [false, true],
    ];
  assert.deepEqual(T.dropout(data, mask, { rate: 0.5 }).output, [
    [2, 0],
    [0, 8],
  ]);
  assert.deepEqual(
    T.dropout(data, mask, { rate: 0.5, training: false }).output,
    data,
  );
  assert.throws(() => T.dropout(data, mask, { rate: 1 }), /rate/);
  assert.throws(() => T.dense([[1]], [[1e308]], { bias: 1e308 }), /Finite/);
  assert.throws(
    () =>
      computeMath("attention", {
        queries: [[1]],
        keys: [[1]],
        values: [[1]],
        temparature: 2,
      }),
    /Unknown input/,
  );
});
test("dense backward agrees with independent finite differences of a weighted target, with no implicit averaging", () => {
  const input = [
      [0.7, -1],
      [0.2, 0.3],
    ],
    weights = [
      [0.4, -0.2],
      [0.8, 0.5],
    ],
    bias = [0.1, -0.3],
    seeds = [
      [2, -1],
      [0.3, 0.2],
    ],
    h = 1e-5;
  const objective = (x, w, b) =>
    x.reduce(
      (sum, row, r) =>
        sum +
        w[0].reduce(
          (s, _, c) =>
            s +
            seeds[r][c] *
              Math.tanh(row.reduce((a, v, i) => a + v * w[i][c], b[c])),
          0,
        ),
      0,
    );
  const gradient = T.denseBackward(input, weights, {
    bias,
    activation: "tanh",
    seeds,
  });
  close(gradient.seededValue, objective(input, weights, bias));
  const copy = (x) => x.map((r) => [...r]);
  for (let r = 0; r < input.length; r++)
    for (let c = 0; c < input[0].length; c++) {
      const high = copy(input),
        low = copy(input);
      high[r][c] += h;
      low[r][c] -= h;
      close(
        gradient.inputGradient[r][c],
        (objective(high, weights, bias) - objective(low, weights, bias)) /
          (2 * h),
        1e-8,
      );
    }
  for (let r = 0; r < weights.length; r++)
    for (let c = 0; c < weights[0].length; c++) {
      const high = copy(weights),
        low = copy(weights);
      high[r][c] += h;
      low[r][c] -= h;
      close(
        gradient.weightGradient[r][c],
        (objective(input, high, bias) - objective(input, low, bias)) / (2 * h),
        1e-8,
      );
    }
  for (let c = 0; c < bias.length; c++) {
    const high = [...bias],
      low = [...bias];
    high[c] += h;
    low[c] -= h;
    close(
      gradient.biasGradient[c],
      (objective(input, weights, high) - objective(input, weights, low)) /
        (2 * h),
      1e-8,
    );
  }
  assert.deepEqual(
    T.denseBackward([[0]], [[1]], { activation: "relu" }).inputGradient,
    [[0]],
  );
  assert.throws(
    () => T.denseBackward([[1, 2]], [[1], [2]], { seeds: [[1, 2]] }),
    /shape/,
  );
});
test('loss reductions and stable logits agree with an independent finite-difference objective',()=>{
 const logits=[[.2,-.4,1.3],[.7,-.2,.1]],labels=[2,0],h=1e-5;
 const objective=z=>z.reduce((sum,row,r)=>sum-Math.log(Math.exp(row[labels[r]])/row.reduce((s,v)=>s+Math.exp(v),0))/z.length,0);
 const result=T.softmaxLoss(logits,labels);close(result.loss,objective(logits));
 for(let r=0;r<logits.length;r++)for(let c=0;c<logits[0].length;c++){const high=logits.map(row=>[...row]),low=logits.map(row=>[...row]);high[r][c]+=h;low[r][c]-=h;close(result.gradient[r][c],(objective(high)-objective(low))/(2*h),1e-8);}
 close(T.softmaxLoss([[-1000,1000]],[0]).loss,2000);assert.deepEqual(T.softmaxLoss([[-1000,1000]],[0]).gradient,[[-1,1]]);
 const mean=T.squaredLoss([[1,2],[3,4]],[[0,0],[0,0]]),sum=T.squaredLoss([[1,2],[3,4]],[[0,0],[0,0]],{reduction:'sum'});close(mean.loss,3.75);close(sum.loss,15);assert.equal(mean.denominator,4);
});
test('composed calculation connections reject missing fields, future results and misspelled outputs before drawing',()=>{
 const visual={type:'tensor',props:{values:{$result:'layer.output'}}};
 const scene={type:'compose',calculations:[{id:'layer',operation:'dense',inputs:{input:[[1,2]],weights:[[1],[2]]}}],visual};
 assert.equal(validateScene(scene).nodes,3);
 assert.throws(()=>validateScene({...scene,calculations:[{id:'layer',operation:'dense',inputs:{input:[[1,2]],weigths:[[1],[2]]}}]}),/Calculation inputs/);
 assert.throws(()=>validateScene({...scene,visual:{type:'tensor',props:{values:{$result:'layer.outputs'}}}}),/Unknown component output/);
 assert.throws(()=>validateScene({...scene,calculations:[{id:'layer',operation:'dense',inputs:{input:{$result:'future.output'},weights:[[1],[2]]}}]}),/earlier/);
});
test('discovery contracts expose only actual calculation result fields',()=>{
 const inputs={
 'normal-cdf':{x:1},binomial:{n:4,p:.5},histogram:{samples:[0,1,2],domain:[0,3]},bayes:{prior:.1,sensitivity:.8,falsePositive:.2},regression:{data:[[1,2],[2,3]]},'regression-optimum':{data:[[1,2],[2,3]]},pca:{data:[[1,2],[2,3]]},matmul:{a:[[1,2]],b:[[3],[4]]},softmax:{scores:[1,2]},attention:{queries:[[1,2]],keys:[[1,2]],values:[[3]]},normalization:{data:[[1,2],[3,4]]},dense:{input:[[1,2]],weights:[[1],[2]]},'dense-backward':{input:[[1,2]],weights:[[1],[2]]},dropout:{data:[[1,2]],mask:[[true,false]]},'squared-loss':{prediction:[[1]],target:[[0]]},'softmax-loss':{logits:[[1,2]],labels:[1]}
 };
 assert(Object.keys(inputs).every(name=>Object.hasOwn(operations,name)));
 for(const [operation,input]of Object.entries(inputs)){const result=computeMath(operation,input).result;assert.deepEqual([...operations[operation].outputs].sort(),Object.keys(result).sort(),operation);}
});
