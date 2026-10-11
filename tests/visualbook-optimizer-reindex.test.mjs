import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  O = require("../packages/visualbook/optimizers.cjs"),
  U = require("../packages/visualbook/updates.cjs"),
  I = require("../packages/visualbook/reindex.cjs"),
  C = require("../packages/visualbook/calculations.cjs");
const near = (a, b) =>
  assert(Math.abs(a - b) < 1e-12 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
test("constant gradients expose exact initialization mass and Adam bias correction", () => {
  const r = O.optimizerTrace({
    start: [0, 0],
    gradients: [
      [2, -3],
      [2, -3],
      [2, -3],
    ],
    beta1: 0.9,
    beta2: 0.99,
    eta: 0.1,
  });
  assert.equal(r.records[0].gradient, null);
  assert.equal(r.records[0].correctedFirst, null);
  for (const s of r.records.slice(1)) {
    near(s.firstMoment[0], 2 * (1 - 0.9 ** s.step));
    near(s.squareMoment[1], 9 * (1 - 0.99 ** s.step));
    near(s.correctedFirst[0], 2);
    near(s.correctedFirst[1], -3);
    near(s.correctedSecond[0], 4);
    near(s.correctedSecond[1], 9);
    near(s.point[0], (-s.step * 0.1 * 2) / (2 + 1e-8));
    assert.deepEqual(s.squareGradient, [4, 9]);
  }
});
test("optimizer steps preserve before-gradient/after-value identities and stated denominator convention", () => {
  for (const kind of ["sgd", "momentum", "adagrad", "rmsprop", "adam"])
    assert.deepEqual(
      O.optimizerTrace({
        kind,
        start: [1, -2],
        gradients: [
          [0, 0],
          [0, 0],
        ],
      }).selected.point,
      [1, -2],
    );
  const field = {
    type: "quadratic",
    matrix: [
      [3, 1],
      [1, 1],
    ],
  };
  const r = O.optimizerTrace({
    kind: "sgd",
    field,
    start: [1, 2],
    steps: 2,
    eta: 0.1,
    selectedStep: 0,
  });
  assert.deepEqual(r.visiblePoints, [[1, 2]]);
  assert.deepEqual(r.records[1].gradient, [5, 3]);
  near(r.records[1].point[0], 0.5);
  near(r.records[1].point[1], 1.7);
  near(r.records[1].value, 0.5 * (3 * 0.5 * 0.5 + 2 * 0.5 * 1.7 + 1.7 * 1.7));
  assert.deepEqual(
    O.optimizerTrace({
      kind: "momentum",
      start: [0],
      gradients: [[2], [3]],
      eta: 1,
      rho: 0.5,
    }).selected.point,
    [-6],
  );
  near(
    O.optimizerTrace({
      kind: "rmsprop",
      start: [0],
      gradients: [[2]],
      rho: 0.5,
      eta: 1,
      epsilon: 1,
    }).selected.update[0],
    2 / (Math.sqrt(2) + 1),
  );
});
test("ambiguous optimizer mechanisms, malformed shapes, invalid rates and overflow are rejected", () => {
  const field = {
    type: "quadratic",
    matrix: [
      [3, 1],
      [1, 1],
    ],
  };
  for (const input of [
    {},
    { field, gradients: [[1, 2]] },
    { field, start: [1] },
    { gradients: [] },
    { gradients: [[1, 2], [1]] },
    { gradients: [[NaN, 2]] },
    { field, beta1: 1 },
    { field, beta2: -0.1 },
    { field, rho: 1 },
    { field, epsilon: 0 },
    { field, eta: -1 },
    { field, steps: 101 },
    { field, steps: 1.5 },
    { field, selectedStep: 21 },
    { field, selectedStep: 0.5 },
    { field, kind: "magic" },
    { gradients: [[1e200]], start: [0] },
  ])
    assert.throws(() => O.optimizerTrace(input));
  assert.throws(() => C.compute("optimizer-trace", { field, typo: 1 }));
});
test("generic gradient step composes with real softmax loss and rejects incompatible data", () => {
  const before = C.compute("softmax-loss", {
    logits: [[-1, 0, 1]],
    labels: [1],
  }).result;
  const r = C.compute("gradient-step", {
    values: before.logits,
    gradient: before.gradient,
    eta: 0.5,
  }).result;
  assert(r.after[0][1] > 0);
  const after = C.compute("softmax-loss", {
    logits: r.after,
    labels: [1],
  }).result;
  assert(after.loss < before.loss);
  assert.deepEqual(
    U.gradientStep({ values: [[1, 2]], gradient: [[3, 4]], eta: 0.5 }).after,
    [[-0.5, 0]],
  );
  for (const x of [
    { values: [[1]], gradient: [[2, 3]] },
    { values: [[1]], gradient: [[Infinity]] },
    { values: [[1]], gradient: [[2]], eta: -1 },
    { values: [[1e308]], gradient: [[-1e308]], eta: 2 },
  ])
    assert.throws(() => U.gradientStep(x));
});
test("logical permutation, count-preserving reshape and selected identity have an exact inverse", () => {
  const r = I.tensorReindex({
    values: [0, 1, 2, 3, 4, 5, 6, 7],
    shape: [2, 2, 2],
    order: [1, 0, 2],
    inputColumns: 4,
    outputColumns: 4,
    inputCell: [1, 1],
  });
  assert.deepEqual(r.output, [0, 1, 4, 5, 2, 3, 6, 7]);
  assert.deepEqual(r.selected.inputIndex, [1, 0, 1]);
  assert.deepEqual(r.selected.outputIndex, [0, 1, 1]);
  const back = I.tensorReindex({
    values: r.output,
    shape: r.outputShape,
    order: [1, 0, 2],
    inputColumns: 4,
    outputColumns: 4,
  });
  assert.deepEqual(back.output, r.values);
  for (const order of [[0, 0], [0, 3], [0], [0, 1.5]])
    assert.throws(() =>
      I.tensorReindex({ values: [0, 1, 2, 3], shape: [2, 2], order }),
    );
  assert.throws(() =>
    I.tensorReindex({
      values: [0, 1, 2, 3],
      shape: [2, 2],
      order: [1, 0],
      reshape: [3],
    }),
  );
  assert.throws(() =>
    I.tensorReindex({
      values: [0, 1, 2, 3],
      shape: [2, 2],
      order: [1, 0],
      inputCell: [2, 0],
    }),
  );
});

test("Yogi keeps raw memory after a zero gradient while Adam decays; projected curves retain actual state identity", () => {
  const gradients = [
      [1, -2],
      [0, 0],
      [0, 0],
    ],
    options = { start: [0, 0], gradients, beta2: 0.9, eta: 0 };
  const adam = O.optimizerTrace({ ...options, kind: "adam" }),
    yogi = O.optimizerTrace({ ...options, kind: "yogi" });
  near(adam.records[3].squareMoment[0], 0.1 * 0.9 ** 2);
  near(yogi.records[3].squareMoment[0], 0.1);
  near(yogi.records[3].squareMoment[1], 0.4);
  for (const trace of [adam, yogi])
    for (const record of trace.records)
      for (let i = 0; i < 2; i++) {
        assert.deepEqual(trace.firstMomentCurves[i][record.step], [
          record.step,
          record.firstMoment[i],
        ]);
        assert.deepEqual(trace.squareMomentCurves[i][record.step], [
          record.step,
          record.squareMoment[i],
        ]);
        assert.deepEqual(
          record.squareMomentPoints[i],
          trace.squareMomentCurves[i][record.step],
        );
      }
  assert.deepEqual(yogi.points, [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
});
