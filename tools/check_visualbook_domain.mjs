/* Independent analytic controls plus real changing-input graph rendering. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { build, preview } from "./visualbook.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  out = path.resolve(
    process.argv[2] ?? path.join(root, "work/harness-v3/domain-" + Date.now()),
  );
if (fs.existsSync(out)) throw Error("Output exists");
fs.mkdirSync(out, { recursive: true });
const source = {
  title: "领域工具数值控制",
  sourceName: "维护者控制",
  sourceSha256: "maintenance-fixture",
  blocks: [
    {
      id: "domain-1",
      raw: "数学控制",
      type: "paragraph",
      sha256: "maintenance-fixture",
      math: { expected: 0 },
      html: "<p>这是数值与实际画面控制，不是模型产出的教材。</p>",
    },
  ],
};
const plan = {
  figures: [
    {
      id: "graph",
      title: "2x² 的计算图",
      afterAnchor: "domain-1",
      height: 330,
      mobileHeight: 420,
      params: [{ key: "x", label: "x", min: -2, max: 3, step: 0.1, value: 1 }],
      scene: {
        type: "autograd",
        props: {
          title: null,
          nodes: [
            { id: "x", op: "input", value: { $param: "x" } },
            { id: "two", op: "constant", value: 2 },
            { id: "square", label: "x²", op: "mul", inputs: ["x", "x"] },
            { id: "y", label: "2x²", op: "mul", inputs: ["two", "square"] },
          ],
          progress: { $progress: true },
        },
      },
    },
  ],
};
const file = path.join(out, "domain.html");
fs.writeFileSync(file, build(source, plan));
const report = await preview(file, path.join(out, "preview"));
const { chromium } = await import(
  pathToFileURL(
    path.join(
      root,
      "work/visualbook/runtime/node_modules/playwright-core/index.mjs",
    ),
  )
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath(),
});
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
let results;
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(pathToFileURL(file).href);
  results = await page.evaluate(() => {
    const square = (x) =>
      VisualBook.traceGraph([
        { id: "x", op: "input", value: x },
        { id: "two", op: "constant", value: 2 },
        { id: "square", op: "mul", inputs: ["x", "x"] },
        { id: "y", op: "mul", inputs: ["two", "square"] },
      ]);
    const points = [-2, 0, 1.25, 3],
      graphs = points.map((x) => {
        const r = square(x);
        return {
          x,
          value: r.value,
          gradient: r.gradients.x,
          contributions: r.edges
            .filter((e) => e.from === "x")
            .map((e) => e.contribution),
        };
      });
    const inputs = points.map((x) => {
      const f = VisualBook.scalarFunction({
        kind: "polynomial",
        coefficients: [3, -2, 0.5],
      });
      return { x, value: f.f(x), gradient: f.df(x) };
    });
    const integrals = [4, 12, 24].map((count) =>
      VisualBook.riemannSum(
        { kind: "polynomial", coefficients: [0, 0, 1] },
        0,
        2,
        { count },
      ),
    );
    const invalid = [
      () =>
        VisualBook.traceGraph([
          { id: "a", op: "mul", inputs: ["b", "b"] },
          { id: "b", op: "mul", inputs: ["a", "a"] },
        ]),
      () =>
        VisualBook.traceGraph([
          { id: "a", op: "input", value: 0 },
          { id: "b", op: "log", inputs: ["a"] },
        ]),
      () => VisualBook.scalarFunction({ kind: "gaussian", sigma: 0 }),
      () => VisualBook.riemannSum({ kind: "sin" }, 0, 1, { count: 0 }),
    ].map((run) => {
      try {
        run();
        return false;
      } catch {
        return true;
      }
    });
    const i = VisualBookRuntime.instances[0];
    i.setProgress(1);
    i.setParam("x", 2);
    const changed = {
      value: i.facts.trace.value,
      gradient: i.facts.trace.gradients.x,
      text: i.svg.querySelector('[data-viz-key="value-x"]').textContent,
    };
    const observer = new MutationObserver(() => {});
    observer.observe(i.svg, {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    i.paint(i.progress);
    const mutations = observer
      .takeRecords()
      .map((m) => ({
        type: m.type,
        tag: m.target.tagName,
        attribute: m.attributeName,
      }));
    observer.disconnect();
    return {
      graphs,
      inputs,
      integrals,
      invalid,
      projection: VisualBook.project([2, 3], [1, 1]),
      changed,
      unchangedMutations: mutations.length,
      mutations,
    };
  });
  fs.writeFileSync(
    path.join(out, "raw-controls.json"),
    JSON.stringify(results, null, 2) + "\n",
  );
  for (const r of results.graphs) {
    close(r.value, 2 * r.x * r.x);
    close(r.gradient, 4 * r.x);
    close(
      r.contributions.reduce((a, b) => a + b, 0),
      4 * r.x,
    );
  }
  for (const r of results.inputs) {
    close(r.value, 3 - 2 * r.x + 0.5 * r.x * r.x);
    close(r.gradient, -2 + r.x);
  }
  for (const r of results.integrals) {
    close(r.exact, 8 / 3);
    close(r.sum, 8 / 3 - 2 / (3 * r.count * r.count));
  }
  assert.deepEqual(results.projection.projection, [2.5, 2.5]);
  assert.deepEqual(results.projection.residual, [-0.5, 0.5]);
  close(results.projection.orthogonality, 0);
  assert.ok(results.invalid.every(Boolean));
  assert.equal(results.changed.value, 8);
  assert.equal(results.changed.gradient, 8);
  assert.equal(results.changed.text, "g = 8");
  assert.equal(
    results.unchangedMutations,
    0,
    "Painting the same graph must not rewrite or reorder its SVG",
  );
} finally {
  await browser.close();
}
fs.writeFileSync(
  path.join(out, "checks.json"),
  JSON.stringify(
    {
      results,
      findings: report.findings,
      modelCalls: 0,
      scope:
        "Independent analytic controls and actual graph text; not artistic acceptance",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    out,
    findings: report.findings,
    unchangedMutations: results.unchangedMutations,
    modelCalls: 0,
  }),
);
if (report.findings.length) process.exitCode = 1;
