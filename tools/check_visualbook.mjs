import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { build, preview, staticExport } from "./visualbook.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  out = path.resolve(
    process.argv[2] ??
      path.join(root, "work/harness-v2/tool-check-" + Date.now()),
  );
if (fs.existsSync(out)) throw Error("Check output exists");
fs.mkdirSync(out, { recursive: true });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const blocks = Array.from({ length: 6 }, (_, i) => ({
  id: `check-${i + 1}`,
  raw: "工具控制样本",
  type: "paragraph",
  sha256: "maintenance-fixture",
  math: { expected: 0 },
  html: "<p>这是工具控制样本，不是模型产出的教材。</p>",
}));
const source = {
  title: "工具控制样本",
  sourceUrl: "https://github.com/siddhartha-yz/visualbook-harness",
  sourceSha256: "maintenance-authored",
  blocks,
};
const plan = {
  figures: [
    {
      id: "matrix-control",
      title: "矩阵工具",
      afterAnchor: "check-1",
      endAnchor: "check-2",
      height: 300,
      mobileHeight: 400,
      params: [],
      code: "function draw({board,progress}){return board.product('multiply',[[1,2],[3,4]],[[5,6],[7,8]],{progress,row:1,col:0});}",
    },
    {
      id: "optimizer-control",
      title: "优化工具",
      afterAnchor: "check-3",
      endAnchor: "check-4",
      height: 340,
      params: [],
      code: "function draw({board,progress}){return board.optimization('opt',{progress,compare:null});}",
    },
    {
      id: "probability-control",
      title: "概率工具",
      afterAnchor: "check-5",
      endAnchor: "check-6",
      height: 320,
      params: [],
      code: "function draw({board,progress}){return board.probabilities('prob',[1,2,3],{progress,labels:['甲','乙','丙']});}",
    },
  ],
};
const file = path.join(out, "controls.html");
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
let result;
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 900 },
  });
  await page.addInitScript(() => (window.__VH_SNAPSHOT = true));
  await page.goto(pathToFileURL(file).href);
  result = await page.evaluate(() => {
    const mul = VisualBook.matmul(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ),
      dot = VisualBook.dot([1, -2, 3], [4, 5, 6]);
    const optimizer = VisualBook.trace("rmsprop", () => [2, -4], [1, 2], {
      eta: 0.1,
      rho: 0.9,
      epsilon: 1e-6,
      steps: 2,
    });
    const i = VisualBookRuntime.instances[0];
    i.setProgress(0.25, true);
    const node = i.svg.querySelector('[data-viz-key="multiply-contribution"]'),
      x = +node.getAttribute("cx");
    i.setProgress(0.26, true);
    const same =
      node === i.svg.querySelector('[data-viz-key="multiply-contribution"]');
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.append(svg);
    const b = new VisualBook.Board(svg);
    b.begin(600, 300);
    const f = b.axes("equal", {
      xDomain: [-1, 5],
      yDomain: [-2, 2],
      equalUnits: true,
    });
    b.end();
    const nodes = [
      { id: "a", label: "输入" },
      { id: "b", label: "隐藏层" },
      { id: "c", label: "输出" },
    ];
    b.begin(600, 300);
    b.sequence("signal", nodes, { active: 1.99 });
    b.end();
    const signal = svg.querySelector('[data-viz-key="signal-signal"]'),
      sx = +signal.getAttribute("cx");
    b.begin(600, 300);
    b.sequence("signal", nodes, { active: 2.01 });
    b.end();
    const signalSame =
        signal === svg.querySelector('[data-viz-key="signal-signal"]'),
      signalDelta = Math.abs(sx - +signal.getAttribute("cx"));
    const conv = VisualBook.correlate2d(
      [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ],
      [
        [0, 1],
        [2, 3],
      ],
    );
    const invalid = [
      () => VisualBook.matmul([[1, 2], [3]], [[4], [5]]),
      () => VisualBook.dot([NaN], [1]),
      () => VisualBook.trace("rmsprop", () => [1], [0], { rho: 1 }),
      () => VisualBook.trace("sgd", () => [1], [0], { steps: -1 }),
    ].map((run) => {
      try {
        run();
        return false;
      } catch {
        return true;
      }
    });
    svg.remove();
    return {
      mul,
      dot,
      optimizer,
      nodeSame: same,
      nodeMoved: x !== +node.getAttribute("cx"),
      unitX: f.unitX,
      unitY: f.unitY,
      probability: VisualBookRuntime.instances[2].facts,
      signalSame,
      signalDelta,
      conv,
      invalid,
    };
  });
  assert.deepEqual(result.mul, [
    [19, 22],
    [43, 50],
  ]);
  assert.equal(result.dot, 12);
  close(result.optimizer[1].square[0], 0.4);
  close(result.optimizer[1].square[1], 1.6);
  close(result.optimizer[2].square[0], 0.76);
  close(result.optimizer[2].square[1], 3.04);
  close(result.optimizer[1].theta[0], 1 - 0.2 / Math.sqrt(0.400001));
  close(result.optimizer[1].theta[1], 2 + 0.4 / Math.sqrt(1.600001));
  close(result.unitX, result.unitY);
  close(result.probability.sum, 1);
  assert.equal(result.nodeSame, true);
  assert.equal(result.nodeMoved, true);
  assert.equal(result.signalSame, true);
  assert.ok(result.signalDelta > 0 && result.signalDelta < 20);
  assert.deepEqual(result.conv, [
    [19, 25],
    [37, 43],
  ]);
  assert.ok(result.invalid.every(Boolean));
  const exported = path.join(out, "offline.html");
  staticExport(file, path.join(out, "preview"), exported);
  const nojs = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  await nojs.goto(pathToFileURL(exported).href);
  assert.equal(await nojs.locator(".vh-static img:visible").count(), 3);
  const decoded = await nojs.evaluate(async () => {
    const images = [...document.querySelectorAll(".vh-static img")];
    for (const image of images) await image.decode();
    return images.every((image) => image.complete && image.naturalWidth > 0);
  });
  assert.equal(decoded, true, "Static SVG fallback must actually decode");
  await nojs.close();
} finally {
  await browser.close();
}
fs.writeFileSync(
  path.join(out, "checks.json"),
  JSON.stringify(
    {
      mathematicalControls: result,
      renderFindings: report.findings,
      renderVariants: report.viewports.reduce(
        (n, v) => n + v.shapes.reduce((s, f) => s + f.frames.length, 0),
        0,
      ),
      noJavascriptStaticFigures: 3,
      noJavascriptStaticImagesDecoded: true,
      modelCalls: 0,
      scope: "tool controls, not independent generation or artistic acceptance",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ output: out, findings: report.findings, modelCalls: 0 }),
);
if (report.findings.length) process.exitCode = 1;
