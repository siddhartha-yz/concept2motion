import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { formatNumber } = createRequire(import.meta.url)(
  "../packages/visualbook/format.cjs",
);
test("nonzero tiny values keep their sign and order of magnitude, while exact zero stays zero", () => {
  for (const value of [
    Number.MIN_VALUE,
    -Number.MIN_VALUE,
    1e-12,
    -7.25e-8,
    0.0042,
    -0.009,
  ])
    for (const precision of [0, 2, 6]) {
      const text = formatNumber(value, { precision }),
        parsed = Number(text);
      assert.notEqual(parsed, 0);
      assert.equal(Math.sign(parsed), Math.sign(value));
      assert(Math.abs(parsed / value) >= 0.5 && Math.abs(parsed / value) <= 2);
    }
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber(-0), "0");
  assert.equal(formatNumber(0.0042), "4.2e-3");
  assert.equal(formatNumber(1e308), "1e308");
});
test("ordinary values retain requested decimal rounding and invalid display inputs fail explicitly", () => {
  assert.equal(formatNumber(1.23456), "1.235");
  assert.equal(formatNumber(-12.3456, { precision: 2 }), "-12.35");
  assert.equal(formatNumber(123456), "1.235e5");
  for (const value of [NaN, Infinity, null, "1"])
    assert.throws(() => formatNumber(value), /Finite/);
  for (const precision of [-1, 7, 0.5])
    assert.throws(() => formatNumber(1, { precision }), /precision/);
});
