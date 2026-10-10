/* Maintainer-authored negative controls with actual Chromium renders. No model calls. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { build, preview, staticExport } from "./visualbook.mjs";
const out = path.resolve(process.argv[2]);
if (fs.existsSync(out)) throw Error("Output exists");
fs.mkdirSync(out, { recursive: true });
const source = {
  title: "失败证据控制",
  sourceSha256: "maintenance-control",
  blocks: [
    {
      id: "failure-1",
      raw: "控制",
      type: "paragraph",
      html: "<p>维护者负控制，不是模型生成。</p>",
      sha256: "maintenance-control",
      math: { expected: 0 },
    },
  ],
};
const base = {
  id: "failure",
  title: "实际失败保留",
  afterAnchor: "failure-1",
  height: 200,
};
const cases = [
  {
    id: "raw-svg-invalid",
    direct: true,
    figure: {
      ...base,
      code: "function draw({svg,progress}){let n=svg.querySelector('path');if(!n){n=document.createElementNS('http://www.w3.org/2000/svg','path');svg.append(n);}n.setAttribute('d','MNaN,20 L40,30');n.setAttribute('stroke','#337a98');return {progress};}",
    },
    check: (r) =>
      assert(
        r.findings.some(
          (f) => f.kind === "figure-layout" && f.invalidGeometry?.length,
        ),
      ),
  },
  {
    id: "wrong-path-api",
    figure: {
      ...base,
      code: "function draw({board}){board.path('bad','M20,30 L40,50');return {}; }",
    },
    check: (r) => {
      assert.equal(r.status, "failed");
      assert(r.findings.some((f) => f.error?.includes("Board.path needs")));
    },
  },
  {
    id: "draw-error",
    figure: {
      ...base,
      code: "function draw({board,progress}){board.circle('point',100+20*progress,80,8);if(progress===0.25)throw Error('intentional draw failure');return {progress};}",
    },
    check: (r) => {
      assert.equal(r.status, "failed");
      assert(
        r.findings.some(
          (f) => f.kind === "render-runtime-error" && f.progress === 0.25,
        ),
      );
      assert(r.screenshots.some((f) => f.endsWith("failed-render.png")));
    },
  },
  {
    id: "adaptive-error",
    figure: {
      ...base,
      params: [
        { key: "n", label: "离散条件", min: 0, max: 2, step: 1, value: 0 },
      ],
      code: "function draw({board,progress,params}){if(params.n===1&&progress===0)throw Error('intentional adaptive failure');board.circle('point',100+(progress<0.5?10*params.n:0),80,8);return {progress,n:params.n};}",
    },
    check: (r) =>
      assert(
        r.findings.some(
          (f) =>
            f.kind === "parameter-boundary" &&
            f.problem === "parameter-runtime-error" &&
            f.value === 1 &&
            f.progress === 0,
        ),
      ),
  },
  {
    id: "integer-step",
    figure: {
      ...base,
      interaction: "parameters",
      params: [
        { key: "n", label: "整数条件", min: 0, max: 3, step: 1, value: 0 },
      ],
      code: "function draw({board,params}){if(!Number.isInteger(params.n))throw Error('illegal fractional integer control');board.circle('point',100,80,8);return {n:params.n};}",
    },
    check: (r) => {
      assert(
        !r.findings.some((f) =>
          JSON.stringify(f).includes("illegal fractional"),
        ),
      );
      assert(
        r.findings.some((f) => f.problem === "parameter-no-visual-effect"),
      );
    },
  },
];
const records = [];
for (const sample of cases) {
  const file = path.join(out, sample.id + ".html"),
    dir = path.join(out, sample.id);
  fs.writeFileSync(
    file,
    build(
      source,
      { figures: [sample.figure] },
      { direct: sample.direct ?? false },
    ),
  );
  const report = await preview(file, dir);
  sample.check(report);
  assert.throws(
    () => staticExport(file, dir, path.join(out, sample.id + "-export.html")),
    /Known render findings/,
  );
  assert(fs.existsSync(path.join(dir, "attempt.json")));
  records.push({
    id: sample.id,
    status: report.status,
    findings: report.findings,
    exportBlocked: true,
  });
}
fs.writeFileSync(
  path.join(out, "control.json"),
  JSON.stringify(
    {
      kind: "actual browser negative controls, not generated books or artistic review",
      modelCalls: 0,
      passed: true,
      records,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    negativeControls: records.length,
    modelCalls: 0,
  }),
);
