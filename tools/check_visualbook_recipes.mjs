/* Real rendering and numeric output of data replacements; zero model calls. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { build, resolvePlan, preview, staticExport } from "./visualbook.mjs";
const out = path.resolve(process.argv[2]);
if (fs.existsSync(out)) throw Error("Output exists");
fs.mkdirSync(out, { recursive: true });
const source = {
  title: "命名设计的数据复用控制",
  sourceSha256: "maintenance-control",
  blocks: [1, 2, 3].map((i) => ({
    id: "recipe-" + i,
    raw: "control",
    type: "paragraph",
    html: "<p>维护者数据替换控制，不是模型生成。</p>",
    sha256: "maintenance-control",
    math: { expected: 0 },
  })),
};
const plan = {
  figures: [
    {
      id: "sum",
      design: "gradient-contributions",
      afterAnchor: "recipe-1",
      overrides: [
        { path: "/scene/props/terms/0/value", value: [-2, 3] },
        { path: "/params/0/value", value: 0.7 },
      ],
    },
    {
      id: "posterior",
      design: "bayes-area",
      afterAnchor: "recipe-2",
      overrides: [
        { path: "/scene/children/0/props/sensitivity", value: 0.9 },
        { path: "/scene/children/0/props/falsePositive", value: 0.1 },
      ],
    },
    {
      id: "array",
      design: "array-strides",
      afterAnchor: "recipe-3",
      overrides: [
        { path: "/scene/props/buffer", value: [10, 11, 12, 13, 14, 15] },
      ],
    },
  ],
};
fs.writeFileSync(
  path.join(out, "source.json"),
  JSON.stringify(source, null, 2),
);
fs.writeFileSync(path.join(out, "book.json"), JSON.stringify(plan, null, 2));
fs.writeFileSync(
  path.join(out, "resolved-plan.json"),
  JSON.stringify(resolvePlan(plan), null, 2),
);
const file = path.join(out, "book.html");
fs.writeFileSync(file, build(source, plan));
const report = await preview(file, path.join(out, "preview"));
assert.equal(report.findings.length, 0, JSON.stringify(report.findings));
const checks = [];
staticExport(file, path.join(out, "preview"), path.join(out, "exported.html"));
for (const width of [1280, 375]) {
  const svg = fs.readFileSync(
    path.join(out, "preview/static", width + "-sum.svg"),
    "utf8",
  );
  assert(
    svg.includes(">-0.6<"),
    "Static fallback must show the actual complete initial state, not timeline zero",
  );
}
for (const view of report.viewports) {
  const sum = view.shapes
    .find((s) => s.id === "sum")
    .frames.find((f) => f.progress === 1).facts;
  // One root component's output is directly the returned facts.
  assert(Math.abs(sum.sum[0] - -0.6) < 1e-10);
  assert(Math.abs(sum.sum[1] - 3.7) < 1e-10);
  const bayes = view.shapes
    .find((s) => s.id === "posterior")
    .frames.find((f) => f.progress === 1).facts.prob;
  assert(
    Math.abs(
      bayes.posterior -
        (bayes.prior * 0.9) / (bayes.prior * 0.9 + (1 - bayes.prior) * 0.1),
    ) < 1e-10,
  );
  const array = view.shapes
    .find((s) => s.id === "array")
    .frames.find((f) => f.progress === 0).facts;
  assert.deepEqual(array.matrix, [
    [10, 13],
    [11, 14],
    [12, 15],
  ]);
  checks.push({
    width: view.width,
    checks: [
      "changed weighted sum",
      "changed Bayes numerator/denominator",
      "same addresses, changed buffer values",
    ],
  });
}
fs.writeFileSync(
  path.join(out, "control.json"),
  JSON.stringify(
    {
      kind: "actual compiled named designs, changed inputs and Chromium outputs; no models or artistic verdict",
      passed: true,
      modelCalls: 0,
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ passed: true, designs: 3, viewports: 2, modelCalls: 0 }),
);
