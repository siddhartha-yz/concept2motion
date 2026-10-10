/* Deliberate input defects in real Chromium, retained independently of author reviews. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { build, preview, staticExport } from "./visualbook.mjs";
import { auditInteractions } from "./audit_visualbook_interactions.mjs";
const out = path.resolve(process.argv[2]);
if (fs.existsSync(out)) throw Error("Output exists");
fs.mkdirSync(out, { recursive: true });
const source = {
  title: "交互正负控制",
  sourceSha256: "maintenance-control",
  blocks: ["good", "inert", "throwing", "random"].map((id) => ({
    id,
    raw: "control",
    html: "<p>维护者控制，不是模型生成。</p>",
    type: "paragraph",
    sha256: "maintenance-control",
    math: { expected: 0 },
  })),
};
const code = (callback, random = false) =>
  `function draw({board,controls,state}){const f=VisualBook.plotFrame(board,'axes',{xDomain:[-2,2],yDomain:[-2,2],grid:false});const v=state.v??[1,1];board.circle('actual',f.x(v[0]),f.y(v[1]),4,VisualBook.palette.orange);board.handle('query',f,v,{onChange:${callback},ariaLabel:'控制点'});${random ? "board.circle('random',50+Math.random()*100,50,3);" : ""}return {actual:v};}`;
const figures = [
  {
    id: "good",
    title: "真实连接",
    afterAnchor: "good",
    interaction: "parameters",
    state: { v: [1, 1] },
    code: code("v=>controls.setState('v',v)"),
  },
  {
    id: "inert",
    title: "没有连接的把手",
    afterAnchor: "inert",
    interaction: "parameters",
    state: { v: [1, 1] },
    code: code("()=>{}"),
  },
  {
    id: "throwing",
    title: "操作后出错",
    afterAnchor: "throwing",
    interaction: "parameters",
    state: { v: [1, 1] },
    code: code("()=>{throw Error('Deliberate callback failure')}"),
  },
  {
    id: "random",
    title: "无输入也随机变化",
    afterAnchor: "random",
    interaction: "parameters",
    state: { v: [1, 1] },
    code: code("v=>controls.setState('v',v)", true),
  },
];
const file = path.join(out, "book.html");
fs.writeFileSync(file, build(source, { figures }));
const report = await auditInteractions(file, path.join(out, "audit"));
assert.equal(report.status, "completed");
assert(
  report.cases.some(
    (c) => c.id === "good" && c.input === "pointer" && c.changed,
  ),
);
assert(!report.findings.some((f) => f.id === "good"));
assert(
  report.findings.some(
    (f) => f.id === "inert" && f.kind === "interaction-no-visible-effect",
  ),
);
assert(
  report.findings.some(
    (f) =>
      f.kind === "interaction-console-error" &&
      f.errors.some((e) => e.includes("Deliberate callback failure")),
  ),
);
assert(
  report.findings.some(
    (f) => f.id === "random" && f.kind === "interaction-nonrepeatable",
  ),
);
// Verify the real authoring gate, not only the standalone audit result.
const gateFile = path.join(out, "gate.html"),
  gateDirectory = path.join(out, "preview");
fs.writeFileSync(gateFile, build(source, { figures: figures.slice(0, 2) }));
const gate = await preview(gateFile, gateDirectory);
assert(
  gate.findings.some(
    (f) => f.kind === "interaction-control" && f.id === "inert",
  ),
);
assert(
  gate.screenshots.some((file) => path.basename(file).startsWith("failure-")),
);
assert.throws(
  () =>
    staticExport(
      gateFile,
      gateDirectory,
      path.join(out, "must-not-export.html"),
    ),
  /Known render findings/,
);
assert(!fs.existsSync(path.join(out, "must-not-export.html")));
fs.writeFileSync(
  path.join(out, "control.json"),
  JSON.stringify(
    {
      passed: true,
      modelCalls: 0,
      realBrowser: true,
      cases: report.cases.length,
      positive: "linked actual point",
      integration:
        "inert on-diagram input reaches preview findings, failure PNG and export rejection",
      negativeControls: [
        "inert callback",
        "throwing callback",
        "random redraw",
      ],
      scope: "input/geometry controls; not human learning or artistic review",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    cases: report.cases.length,
    negativeControls: 3,
    modelCalls: 0,
  }),
);
