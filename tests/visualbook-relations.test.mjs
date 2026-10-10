import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { computeMath, operations } from "../tools/visualbook_math.mjs";
const N = createRequire(import.meta.url)(
  "../packages/visualbook/relations.cjs",
);
test("weighted contributions preserve cancellation, each partial sum and vector dimensions", () => {
  const terms = [
    { id: "data", value: [-1, 2] },
    { id: "penalty", value: [2, 1], weight: 0.5 },
  ];
  const r = N.contributions(terms, { prefix: 1.5 });
  assert.deepEqual(r.sum, [0, 2.5]);
  assert.deepEqual(r.visibleSum, [-0.5, 2.25]);
  assert.deepEqual(r.partialSums, [
    [0, 0],
    [-1, 2],
    [0, 2.5],
  ]);
  assert.deepEqual(N.contributions(terms, { prefix: 0 }).visibleSum, [0, 0]);
  assert.deepEqual(
    N.contributions([
      { id: "a", value: 2, weight: -1 },
      { id: "b", value: 2 },
    ]).sum,
    [0],
  );
  // Independent derivative of (2*w-1)^2/2 + lambda*w^2/2.
  for (const w of [-1, 0, 0.4, 2])
    for (const lambda of [0, 1, 3]) {
      const h = 1e-6,
        f = (x) => (2 * x - 1) ** 2 / 2 + (lambda * x * x) / 2;
      const derivative = (f(w + h) - f(w - h)) / (2 * h);
      assert(
        Math.abs(
          N.contributions([
            { id: "fit", value: 2 * (2 * w - 1) },
            { id: "regularizer", value: w, weight: lambda },
          ]).sum[0] - derivative,
        ) < 1e-7,
      );
    }
  assert.throws(
    () =>
      N.contributions([
        { id: "x", value: [1] },
        { id: "y", value: [1, 2] },
      ]),
    /dimensions/,
  );
  assert.throws(() => N.contributions(terms, { prefix: -1 }), /prefix/);
});
test("half-open lifetimes handle simultaneous release/allocation and varying sizes", () => {
  const intervals = [
    { id: "a", start: 0, end: 2, size: 4 },
    { id: "b", start: 1, end: 3, size: 7 },
    { id: "c", start: 2, end: 4, size: 2 },
  ];
  const r = N.lifetimes(intervals, { time: 2 });
  assert.deepEqual(r.active, ["b", "c"]);
  assert.equal(r.activeSize, 9);
  assert.equal(r.peakSize, 11);
  assert.equal(r.peakCount, 2);
  assert.deepEqual(
    r.series.map((s) => [s.time, s.count, s.size]),
    [
      [0, 1, 4],
      [1, 2, 11],
      [2, 2, 9],
      [3, 1, 2],
      [4, 0, 0],
    ],
  );
  assert.equal(N.lifetimes(intervals, { time: 4 }).activeSize, 0);
  const sameTime = N.lifetimes([
    { id: "a", start: 0, end: 1, size: 9 },
    { id: "b", start: 1, end: 2, size: 8 },
  ]);
  assert.equal(sameTime.peakSize, 9); // not 17, since a is released at t=1.
  assert.throws(() => N.lifetimes([{ id: "x", start: 1, end: 1 }]), /start/);
  assert.throws(
    () =>
      N.lifetimes([
        { id: "x", start: 0, end: 1 },
        { id: "x", start: 2, end: 3 },
      ]),
    /Unique/,
  );
});
test("relation metadata describes actual canonical outputs", () => {
  for (const [operation, inputs] of Object.entries({
    contributions: { terms: [{ id: "x", value: 1 }] },
    lifetimes: { intervals: [{ id: "x", start: 0, end: 1 }] },
  }))
    assert.deepEqual(
      Object.keys(computeMath(operation, inputs).result).sort(),
      operations[operation].outputs.slice().sort(),
    );
});
