/* Actual encode/decode and negative controls, zero model calls. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { build, preview } from "./visualbook.mjs";
import { exportMotion } from "./export_visualbook_motion.mjs";
const out = path.resolve(process.argv[2]);
if (fs.existsSync(out)) throw Error("Output exists");
fs.mkdirSync(out, { recursive: true });
const source = {
  title: "固定帧导出控制",
  sourceSha256: "maintenance-control",
  blocks: [
    {
      id: "motion-1",
      raw: "控制",
      type: "paragraph",
      html: "<p>维护者导出控制，不是生成教材或艺术评审。</p>",
      sha256: "maintenance-control",
      math: { expected: 0 },
    },
  ],
};
const plan = {
  figures: [
    {
      id: "motion",
      title: "固定进度的同一个对象",
      afterAnchor: "motion-1",
      height: 200,
      mobileHeight: 200,
      code: "function draw({board,progress}){board.line('guide',40,100,280,100,VisualBook.palette.faint);board.circle('point',40+240*progress,100,9,VisualBook.palette.blue);return {x:40+240*progress};}",
    },
  ],
};
const file = path.join(out, "book.html"),
  evidence = path.join(out, "preview");
fs.writeFileSync(file, build(source, plan));
const previewed = await preview(file, evidence);
assert.equal(previewed.findings.length, 0);
const success = await exportMotion(file, evidence, path.join(out, "success"), {
  id: "motion",
  width: 375,
  fps: 10,
  duration: 2,
  formats: ["gif", "mp4"],
});
assert.equal(success.status, "completed", JSON.stringify(success.findings));
assert(success.replays.every((r) => r.matches));
assert.equal(success.frames[0].facts.x, 40);
assert.equal(success.frames.at(-1).facts.x, 280);
assert(
  success.outputs.every(
    (o) =>
      o.decodedFrameCount === 20 &&
      o.decodedDuration === 2 &&
      !o.repeat &&
      o.sampledFrames.length === 3,
  ),
);
const failures = [];
fs.appendFileSync(file, "<!--input changed-->");
await assert.rejects(
  exportMotion(file, evidence, path.join(out, "stale"), { id: "motion" }),
  /exact HTML/,
);
assert(!fs.existsSync(path.join(out, "stale")));
failures.push("changed HTML rejected before capture");
fs.writeFileSync(file, build(source, plan));
const inert = await exportMotion(file, evidence, path.join(out, "inert"), {
  id: "motion",
  width: 375,
  fps: 5,
  duration: 1,
  from: 0,
  to: 0,
});
assert.equal(inert.status, "failed");
assert(inert.findings.some((f) => f.error.includes("identical")));
assert(fs.existsSync(path.join(out, "inert/report.json")));
failures.push("inert sequence rejected and frames retained");
plan.figures[0].code =
  "function draw({board,progress}){const x=40+240*Math.random();board.circle('point',x,100,9);return {x,progress};}";
const randomFile = path.join(out, "random.html"),
  randomPreview = path.join(out, "random-preview");
fs.writeFileSync(randomFile, build(source, plan));
const randomReport = await preview(randomFile, randomPreview);
assert.equal(randomReport.findings.length, 0); // spatial checks alone do not catch it.
const random = await exportMotion(
  randomFile,
  randomPreview,
  path.join(out, "random-motion"),
  { id: "motion", width: 375, fps: 5, duration: 1 },
);
assert.equal(random.status, "failed");
assert(random.findings.some((f) => f.error.includes("Replayed pose differs")));
assert(fs.existsSync(path.join(out, "random-motion/replay-0.png")));
failures.push(
  "nondeterministic drawing rejected despite passing ordinary preview",
);
fs.writeFileSync(
  path.join(out, "control.json"),
  JSON.stringify(
    {
      kind: "actual Chromium frame capture, FFmpeg encode/decode and negative controls; no models or artistic verdict",
      modelCalls: 0,
      passed: true,
      success: {
        frameCount: success.frameCount,
        outputs: success.outputs,
        captureMs: success.captureMs,
        wallMs: success.wallMs,
      },
      negativeControls: failures,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    formats: 2,
    framesPerFormat: 20,
    negativeControls: failures.length,
    modelCalls: 0,
  }),
);
