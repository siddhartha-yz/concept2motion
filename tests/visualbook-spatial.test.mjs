import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { computeMath, operations } from "../tools/visualbook_math.mjs";
const S = createRequire(import.meta.url)("../packages/visualbook/spatial.cjs");
const close = (a, b) => assert(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
test("receptive fields distinguish holes, padding, strides and composed input dependencies", () => {
  const holes = S.receptiveField(15, [{ kernel: 3, dilation: 3 }], {
    index: 4,
  });
  assert.deepEqual(holes.inputIndices, [4, 7, 10]);
  assert.equal(holes.span, 7);
  assert.equal(holes.jump, 1);
  assert.deepEqual(holes.extent, [4, 10]);
  const composed = S.receptiveField(
    8,
    [
      { kernel: 3, padding: "same" },
      { kernel: 2, stride: 2 },
    ],
    { index: 1 },
  );
  assert.deepEqual(composed.selectedByLayer, [[1, 2, 3, 4], [2, 3], [1]]);
  assert.deepEqual(composed.inputIndices, [1, 2, 3, 4]);
  assert.equal(composed.span, 4);
  assert.equal(composed.center, 2.5);
  assert.equal(composed.jump, 2);
  const boundary = S.receptiveField(
    8,
    [
      { kernel: 3, padding: "same" },
      { kernel: 2, stride: 2 },
    ],
    { index: 0 },
  );
  assert.deepEqual(boundary.inputIndices, [0, 1, 2]);
  assert.deepEqual(boundary.extent, [-1, 2]);
  assert.equal(boundary.span, 4);
  const asymmetric = S.receptiveField(
    6,
    [{ kernel: 3, stride: 2, padding: "same" }],
    { index: 2 },
  );
  assert.deepEqual(asymmetric.layers[0].padding, [0, 1]);
  assert.deepEqual(asymmetric.inputIndices, [4, 5]);
  assert.equal(asymmetric.outputLength, 3);
  assert.throws(() => S.receptiveField(5, [{ kernel: 7 }]), /Output length/);
  assert.throws(
    () => S.receptiveField(5, [{ kernel: 3 }], { index: 3 }),
    /Selected output/,
  );
  assert.throws(
    () => S.receptiveField(5, [{ kernel: 3, strides: 2 }]),
    /Unknown/,
  );
});
test("all small composed fields agree with an independent Boolean dependency matrix", (t) => {
  let checked = 0;
  for (const n of [5, 8, 12])
    for (const k of [1, 2, 3])
      for (const s of [1, 2])
        for (const d of [1, 2])
          for (const padding of [
            [0, 0],
            [1, 2],
          ]) {
            const layers = [
              { kernel: k, stride: s, dilation: d, padding },
              { kernel: 2, stride: 1, dilation: 1, padding: [1, 0] },
            ];
            let matrix = Array.from({ length: n }, (_, i) =>
              Array.from({ length: n }, (_, j) => i === j),
            );
            let invalid = false;
            for (const layer of layers) {
              const count =
                Math.floor(
                  (matrix.length +
                    layer.padding[0] +
                    layer.padding[1] -
                    layer.dilation * (layer.kernel - 1) -
                    1) /
                    layer.stride,
                ) + 1;
              if (count < 1) {
                invalid = true;
                break;
              }
              matrix = Array.from({ length: count }, (_, o) =>
                Array.from({ length: n }, (_, input) => {
                  for (let source = 0; source < matrix.length; source++) {
                    const offset =
                      source - (o * layer.stride - layer.padding[0]);
                    if (
                      offset >= 0 &&
                      offset % layer.dilation === 0 &&
                      offset / layer.dilation < layer.kernel &&
                      matrix[source][input]
                    )
                      return true;
                  }
                  return false;
                }),
              );
            }
            if (invalid) continue;
            for (let index = 0; index < matrix.length; index++) {
              const actual = S.receptiveField(n, layers, { index });
              assert.deepEqual(
                actual.inputIndices,
                matrix[index].flatMap((active, i) => (active ? [i] : [])),
              );
              checked++;
            }
          }
  assert(checked > 0);
  t.diagnostic(
    `${checked} selected outputs checked against Boolean dependency matrices`,
  );
});
test("Gaussian normalized weights agree with direct ratios and remain convex at bandwidth extremes", () => {
  const keys = [[-2], [0], [1], [3]],
    values = [-1, 2, 3, 0];
  for (const q of [-2.5, 0, 0.5, 2])
    for (const b of [0.2, 0.7, 2]) {
      const r = S.gaussianWeights([q], keys, values, { bandwidth: b }),
        raw = keys.map(([x]) => Math.exp(-((q - x) ** 2) / (2 * b * b))),
        sum = raw.reduce((a, b) => a + b, 0);
      r.weights.forEach((w, i) => close(w, raw[i] / sum));
      close(r.weightSum, 1);
      close(
        r.output[0],
        r.weights.reduce((sum, w, i) => sum + w * values[i], 0),
      );
      assert(r.output[0] >= -1 && r.output[0] <= 3);
    }
  const tie = S.gaussianWeights([0], [[-1], [1], [100]], [2, 4, 999], {
    bandwidth: 1e-6,
  });
  assert.deepEqual(tie.weights, [0.5, 0.5, 0]);
  assert.equal(tie.output[0], 3);
  const vector = S.gaussianWeights(
    [0, 0],
    [
      [1, 0],
      [0, 1],
    ],
    [
      [2, 4],
      [-2, 6],
    ],
  );
  assert.deepEqual(vector.output, [0, 5]);
  assert.throws(
    () => S.gaussianWeights([0], [[1]], [2], { bandwidth: 0 }),
    /bandwidth/,
  );
  assert.throws(() => S.gaussianWeights([0], [[1]], {}), /value per key/);
  assert.throws(() => S.gaussianWeights([1e308], [[-1e308]], [1]), /overflow/);
});
test("spatial CLI and scene metadata expose actual outputs, reject typos", () => {
  for (const [operation, inputs] of Object.entries({
    "receptive-field": { inputLength: 8, layers: [{ kernel: 3 }] },
    "gaussian-weights": { query: [0], keys: [[1]], values: [2] },
  }))
    assert.deepEqual(
      Object.keys(computeMath(operation, inputs).result).sort(),
      operations[operation].outputs.slice().sort(),
    );
  assert.throws(
    () =>
      computeMath("gaussian-weights", {
        query: [0],
        keys: [[1]],
        values: [2],
        bandwith: 1,
      }),
    /Unknown input/,
  );
});
