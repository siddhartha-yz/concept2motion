import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  N = require("../packages/visualbook/neural.cjs");
const A = [
    [1, 2],
    [3, 4],
    [5, 6],
  ],
  t = N.transpose(A, { index: [2, 1] });
assert.deepEqual(t.output, [
  [1, 3, 5],
  [2, 4, 6],
]);
assert.deepEqual(t.selectedOutput, [1, 2]);
assert.equal(t.selectedValue, 6);
assert.deepEqual(N.transpose(t.output).output, A);
// The transpose implements the adjoint identity for a nonsymmetric matrix.
const x = [[2], [-1]],
  y = [[1], [-2], [3]],
  Ax = N.matmul(A, x),
  ATy = N.matmul(t.output, y);
assert.equal(
  Ax.reduce((s, row, i) => s + row[0] * y[i][0], 0),
  x.reduce((s, row, i) => s + row[0] * ATy[i][0], 0),
);
for (const index of [
  [3, 0],
  [-1, 0],
  [0, 2],
  [0.5, 0],
])
  assert.throws(() => N.transpose(A, { index }));
assert.throws(() => N.transpose([[1], [2, 3]]));
