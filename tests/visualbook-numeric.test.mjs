import { createRequire } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { computeMath } from "../tools/visualbook_math.mjs";
import { validateScene } from "../tools/visualbook.mjs";
const N = createRequire(import.meta.url)("../packages/visualbook/numeric.cjs");
const close = (a, b, t = 1e-8) =>
  assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
test("regression gradients agree with independently written loss finite differences", () => {
  const data = [
      [-2, -1],
      [-0.5, 0.8],
      [1, 2],
    ],
    w = 0.7,
    b = 0.2,
    lambda = 0.3,
    h = 1e-5;
  const loss = (w, b) =>
    data.reduce((sum, [x, y]) => sum + (w * x + b - y) ** 2, 0) /
      (2 * data.length) +
    (lambda * w * w) / 2;
  const result = N.regression(data, w, b, lambda);
  close(result.loss, loss(w, b));
  close(result.weightGradient, (loss(w + h, b) - loss(w - h, b)) / (2 * h));
  close(result.biasGradient, (loss(w, b + h) - loss(w, b - h)) / (2 * h));
  assert.throws(() => N.regression([[1e308, 0]], 1e308), /Finite/);
});
test("probability denominators and boundary samples remain explicit", () => {
  close(N.bayes(0.1, 0.8, 0.2).posterior, 4 / 13);
  assert.equal(N.bayes(0, 1, 0).posterior, null);
  const bins = N.histogram([-1, 0, 1, 2, 3, 4, 5], [0, 4], 4);
  assert.deepEqual(
    bins.bins.map((b) => b.count),
    [1, 1, 1, 2],
  );
  assert.equal(bins.outside, 2);
  close(
    bins.bins.reduce((s, b) => s + b.probability, 0),
    5 / 7,
  );
  assert.deepEqual(
    N.binomial(4, 0.5).probabilities,
    [1, 4, 6, 4, 1].map((v) => v / 16),
  );
  close(N.normalCDF(1), 0.8413447460685429, 7.5e-8);
  assert.throws(() => N.bayes(1.1, 0.5, 0.5), /Probability/);
  assert.throws(() => N.histogram([0], [-1e308, 1e308], 2), /Finite/);
});
test("PCA identifies the known line and reports an undetermined repeated-eigenvalue direction", () => {
  const r = N.pca2d([
    [-1, -2],
    [0, 0],
    [1, 2],
  ]);
  close(r.eigenvalues[0], 10 / 3);
  close(r.eigenvalues[1], 0);
  close(r.axis[0], 1 / Math.sqrt(5));
  close(r.axis[1], 2 / Math.sqrt(5));
  assert.equal(
    N.pca2d([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]).degenerate,
    true,
  );
  assert.equal(
    N.pca2d([
      [1, 1],
      [1, 1],
    ]).explained,
    null,
  );
});
test("the callable kernel rejects silent typos and scene connections reject unknown outputs early", () => {
  assert.throws(
    () => computeMath("regression", { data: [[1, 2]], weights: 3 }),
    /Unknown input/,
  );
  assert.throws(
    () => validateScene({ type: "unit-circle", props: { angles: 1 } }),
    /Unknown unit-circle input/,
  );
  assert.throws(
    () =>
      validateScene({
        type: "readout",
        props: { items: [{ label: "x", value: { $result: "later.value" } }] },
      }),
    /earlier component/,
  );
  assert.throws(
    () =>
      validateScene({
        type: "unit-circle",
        props: { angle: { $param: "missing" } },
      }),
    /Unknown scene parameter/,
  );
});
