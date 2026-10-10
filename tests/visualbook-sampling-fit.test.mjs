import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  G = require("../packages/visualbook/sampling.cjs"),
  Q = require("../packages/visualbook/polynomial.cjs"),
  C = require("../packages/visualbook/calculations.cjs");
const near = (a, b) =>
  assert(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
test("cell centres, boundaries and composed analytic field values have one explicit convention", () => {
  const g = G.sampleGrid({
    xDomain: [-2, 2],
    yDomain: [-2, 2],
    resolution: 5,
    field: {
      type: "quadratic",
      matrix: [
        [2, 0],
        [0, 2],
      ],
    },
  });
  assert.deepEqual(g.shape, [5, 5]);
  assert.deepEqual(g.points[0], [-1.6, 1.6]);
  assert.deepEqual(G.sampleIndex(g.grid, [2, -2]).sampledPoint, [1.6, -1.6]);
  assert.equal(G.sampleIndex(g.grid, [0, 0]).index, 12);
  for (let i = 0; i < 25; i++)
    near(g.values[i][0], g.points[i][0] ** 2 + g.points[i][1] ** 2);
  assert.deepEqual(
    C.compute("sample-grid", { resolution: 5 }).result.grid.points,
    g.points,
  );
  const corrupt = structuredClone(g.grid);
  corrupt.points[0][0] += 0.01;
  assert.throws(() => G.sampleIndex(corrupt, [0, 0]));
  assert.throws(() => G.sampleGrid({ resolution: 32 }));
  assert.throws(() => G.sampleGrid({ xDomain: [-1e308, 1e308] }));
  assert.throws(() => G.sampleIndex(g.grid, [3, 0]));
});
test("QR recovers a known cubic, follows its curve and stationarity", () => {
  const data = Array.from({ length: 15 }, (_, i) => {
    const x = -1 + i / 7;
    return [x, 2 + 3 * x - 4 * x * x + x * x * x];
  });
  const f = Q.polynomialFit({ data, degree: 3 });
  f.coefficients.forEach((v, i) => near(v, [2, 3, -4, 1][i]));
  assert(f.trainingMSE < 1e-24);
  f.gradient.forEach((v) => near(v, 0));
  for (const [x, y] of f.curve) near(y, 2 + 3 * x - 4 * x * x + x * x * x);
  assert.equal(C.compute("polynomial-fit", { data, degree: 3 }).result.rank, 4);
});
test("regularization excludes intercept, rank and basis scaling are explicit", () => {
  const data = [
    [0, 1],
    [0, 2],
    [0, 3],
  ];
  assert.throws(
    () => Q.polynomialFit({ data, degree: 3, xDomain: [-1, 1] }),
    /rank|underdetermined/,
  );
  const f = Q.polynomialFit({ data, degree: 3, lambda: 0.1, xDomain: [-1, 1] });
  near(f.coefficients[0], 2);
  f.coefficients.slice(1).forEach((v) => near(v, 0));
  near(f.trainingMSE, 2 / 3);
  near(f.regularization, 0);
  f.gradient.forEach((v) => near(v, 0));
  const transformed = Q.polynomialFit({
    data: [
      [-2, 5],
      [0, 1],
      [2, 5],
    ],
    degree: 2,
    center: 0,
    scale: 2,
  });
  transformed.coefficients.forEach((v, i) => near(v, [1, 0, 4][i]));
  assert.throws(() =>
    Q.polynomialFit({
      data: [
        [1, 1],
        [2, 2],
      ],
      degree: 2,
    }),
  );
  assert.throws(
    () =>
      C.compute("polynomial-fit", {
        data: [
          [1, 1],
          [2, 2],
        ],
        degre: 1,
      }),
    /Unknown input/,
  );
  assert.throws(
    () =>
      Q.polynomialFit({
        data: [
          [1e200, 1],
          [2e200, 2],
        ],
        degree: 4,
      }),
    /overflow/,
  );
});
