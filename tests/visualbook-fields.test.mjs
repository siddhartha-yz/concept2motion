import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { scalarField } = require("../packages/visualbook/fields.cjs"),
  C = require("../packages/visualbook/calculations.cjs");
const near = (a, b, tolerance = 1e-6) =>
  assert(
    Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)),
    `${a} differs from ${b}`,
  );
test("rotated and indefinite quadratic values and analytic derivatives", () => {
  const f = scalarField(
    {
      type: "quadratic",
      matrix: [
        [3, 1],
        [1, 1],
      ],
      center: [0.5, -0.5],
      constant: 2,
    },
    [1.5, 0.5],
  );
  assert.deepEqual(f.gradient, [4, 2]);
  near(f.value, 5);
  assert.deepEqual(f.hessian, [
    [3, 1],
    [1, 1],
  ]);
  const saddle = scalarField(
    {
      type: "quadratic",
      matrix: [
        [2, 0],
        [0, -2],
      ],
    },
    [0, 1],
  );
  near(saddle.value, -1);
  assert.deepEqual(saddle.gradient, [0, -2]);
});
test("gradients and Hessians agree with independent central differences", () => {
  let seed = 823071;
  const next = () =>
    ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32) * 3 - 1.5;
  for (const spec of [
    {
      type: "quadratic",
      matrix: [
        [4, 1.2],
        [1.2, 1],
      ],
      center: [0.3, -0.7],
    },
    {
      type: "quadratic",
      matrix: [
        [2, 0],
        [0, -2],
      ],
    },
    { type: "rosenbrock", a: 1, b: 8 },
    { type: "rosenbrock", a: 0.5, b: 100 },
  ])
    for (let trial = 0; trial < 20; trial++) {
      const p = [next(), next()],
        base = scalarField(spec, p),
        h = 1e-5;
      for (let j = 0; j < 2; j++) {
        const plus = [...p],
          minus = [...p];
        plus[j] += h;
        minus[j] -= h;
        const fp = scalarField(spec, plus),
          fm = scalarField(spec, minus);
        near(base.gradient[j], (fp.value - fm.value) / (2 * h));
        for (let i = 0; i < 2; i++)
          near(base.hessian[i][j], (fp.gradient[i] - fm.gradient[i]) / (2 * h));
      }
    }
});
test("invalid and overflowing fields cannot enter composed calculations", () => {
  for (const [s, p] of [
    [
      {
        type: "quadratic",
        matrix: [
          [1, 2],
          [3, 1],
        ],
      },
      [0, 0],
    ],
    [{ type: "rosenbrock", b: 0 }, [0, 0]],
    [{ type: "quadratic", typo: 1 }, [0, 0]],
    [{ type: "rosenbrock" }, [Infinity, 0]],
    [{ type: "rosenbrock" }, [1e200, 0]],
  ])
    assert.throws(() => scalarField(s, p));
  const c = C.compute("scalar-field", {
    spec: { type: "rosenbrock" },
    point: [1, 1],
  });
  near(c.result.value, 0);
  assert.deepEqual(c.result.gradient, [0, 0]);
  assert.throws(() =>
    C.compute("scalar-field", {
      spec: { type: "quadratic" },
      point: [0, 0],
      step: 1,
    }),
  );
});
