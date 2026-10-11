/* Finite auto-spacing controls keep fonts unchanged, reject impossible layouts. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { importMarkdown } from "../packages/visualbook/import.mjs";
import { build, preview } from "./visualbook.mjs";
const out = path.resolve(process.argv[2]);
if (fs.existsSync(out)) throw Error("Fresh output required");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(out + "/chapter.md", "# 比较行\n\n同一份数据保持对应。\n");
const source = importMarkdown(out + "/chapter.md", { id: "spacing" }),
  anchor = source.blocks.at(-1).id,
  rows = [
    { label: "输入", values: [0, 1] },
    { label: "变换一", values: [1, 2] },
    { label: "变换二", values: [2, 3] },
  ],
  records = [];
for (const [id, height, compact, expect] of [
  ["auto", 250, "auto", true],
  ["explicit", 250, false, false],
  ["impossible", 180, "auto", false],
]) {
  const props = { rows, domain: [-1, 4], statistics: false };
  if (compact !== "auto") props.compact = compact;
  const plan = {
    figures: [
      {
        id,
        afterAnchor: anchor,
        title: "保持字号的比较行",
        interaction: "static",
        height,
        mobileHeight: height,
        scene: { type: "aligned-points", props },
      },
    ],
  };
  fs.writeFileSync(out + "/" + id + ".html", build(source, plan));
  const r = await preview(
    out + "/" + id + ".html",
    out + "/" + id + "-preview",
  );
  assert.equal(r.status === "completed" && r.findings.length === 0, expect);
  if (expect)
    for (const v of r.viewports)
      for (const s of v.shapes)
        for (const f of s.frames) {
          assert.equal(f.facts.compact, true);
          assert.deepEqual(
            f.facts.rows.map((r) => r.values),
            rows.map((r) => r.values),
          );
          assert.equal(f.tiny.length, 0);
        }
  records.push({
    id,
    height,
    compact,
    expectedPass: expect,
    status: r.status,
    findings: r.findings,
  });
}
fs.writeFileSync(
  out + "/control.json",
  JSON.stringify(
    {
      passed: true,
      modelCalls: 0,
      scope:
        "Actual 250px auto spacing with unchanged values/fonts, explicit comfortable layout rejected when insufficient, too-small auto layout rejected. Not arbitrary layout solving or art quality.",
      records,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ passed: true, cases: records.length, modelCalls: 0 }),
);
