/* Callable canonical numerics, independent of drawing and browser installation. */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  N = require("../packages/visualbook/numeric.cjs");
export const operations = {
  "normal-cdf": {
    keys: ["x"],
    required: ["x"],
    run: (i) => ({ value: N.normalCDF(i.x), absoluteErrorBound: 7.5e-8 }),
  },
  binomial: {
    keys: ["n", "p"],
    required: ["n", "p"],
    run: (i) => N.binomial(i.n, i.p),
  },
  histogram: {
    keys: ["samples", "domain", "count"],
    required: ["samples", "domain"],
    run: (i) => N.histogram(i.samples, i.domain, i.count),
  },
  bayes: {
    keys: ["prior", "sensitivity", "falsePositive"],
    required: ["prior", "sensitivity", "falsePositive"],
    run: (i) => N.bayes(i.prior, i.sensitivity, i.falsePositive),
  },
  regression: {
    keys: ["data", "weight", "bias", "lambda"],
    required: ["data"],
    run: (i) => N.regression(i.data, i.weight, i.bias, i.lambda),
  },
  "regression-optimum": {
    keys: ["data", "lambda"],
    required: ["data"],
    run: (i) => N.regressionOptimum(i.data, i.lambda),
  },
  pca: { keys: ["data"], required: ["data"], run: (i) => N.pca2d(i.data) },
};
export function computeMath(operation, input) {
  const spec = operations[operation];
  if (!spec) throw Error("Unknown numeric operation");
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Numeric input must be an object");
  if (Object.keys(input).some((k) => !spec.keys.includes(k)))
    throw Error("Unknown input field; allowed: " + spec.keys.join(", "));
  if (spec.required.some((k) => input[k] === undefined))
    throw Error("Required numeric inputs: " + spec.required.join(", "));
  const result = spec.run(input);
  function check(v) {
    if (typeof v === "number" && !Number.isFinite(v))
      throw Error("Calculation overflowed; reduce the input scale");
    if (v && typeof v === "object") Object.values(v).forEach(check);
  }
  check(result);
  return {
    operation,
    inputs: input,
    result,
    scope:
      "Canonical calculation only; not independent math review, rendering or a model result",
  };
}
if (process.argv[1] === import.meta.filename) {
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk;
    if (text.length > 65536) throw Error("Numeric input exceeds 64 KiB");
  }
  const request = JSON.parse(text);
  console.log(JSON.stringify(computeMath(request.operation, request.inputs)));
}
