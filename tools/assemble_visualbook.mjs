// Assemble already-generated chapters. No model call, no authored-source rewrite.
import fs from "node:fs";
import crypto from "node:crypto";
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
import path from "node:path";
import { build, preview, staticExport } from "./visualbook.mjs";
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const [manifestFile, outDir] = process.argv.slice(2);
if (!manifestFile || !outDir)
  throw Error(
    "Use: node tools/assemble_visualbook.mjs manifest.json output-directory",
  );
const manifest = JSON.parse(fs.readFileSync(manifestFile)),
  out = path.resolve(outDir),
  records = [];
if (!Array.isArray(manifest.chapters)) throw Error("Missing chapters");
fs.mkdirSync(out, { recursive: true });
for (const c of manifest.chapters) {
  if (!/^[a-z][a-z0-9-]*$/.test(c.id)) throw Error("Invalid chapter id");
  const source = JSON.parse(fs.readFileSync(c.source)),
    plan = JSON.parse(fs.readFileSync(c.plan)),
    file = path.join(out, c.id + ".html");
  fs.writeFileSync(file, build(source, plan, { direct: c.arm === "direct" }));
  const previewDir = path.join(out, "evidence", c.id);
  const report = await preview(file, previewDir);
  if (report.findings.length) {
    fs.writeFileSync(
      path.join(out, "build-failure.json"),
      JSON.stringify({ id: c.id, findings: report.findings }, null, 2),
    );
    throw Error(
      "Assembly found unresolved render issues in " +
        c.id +
        "; diagnostics retained",
    );
  }
  staticExport(file, previewDir, file);
  records.push({
    id: c.id,
    title: source.title,
    file: c.id + ".html",
    figures: plan.figures.length,
    sourceSha256: source.sourceSha256,
    arm: c.arm,
    finalHtmlSha256: sha(fs.readFileSync(file)),
    sourceJsonSha256: sha(fs.readFileSync(c.source)),
    planSha256: sha(fs.readFileSync(c.plan)),
    renderFindings: report.findings,
    preview: previewDir,
  });
}
const css = fs.readFileSync(
  new URL("../packages/visualbook/theme.css", import.meta.url),
  "utf8",
);
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(manifest.title ?? "VisualBook")}</title><style>${css}</style><body><main class="library"><div class="eyebrow">VISUALBOOK</div><h1>${esc(manifest.title ?? "读懂变化")}</h1><p>${esc(manifest.description ?? "保留完整教材，边读边看关系怎样变化。")}</p>${records.map((c) => `<article class="book-link"><h2><a href="${c.file}">${esc(c.title)}</a></h2>${manifest.labels?.[c.id] ? `<p>${esc(manifest.labels[c.id])}</p>` : ""}</article>`).join("")}<p class="source-note">原文来源与许可证随章节保留。图中参数用于解释，读者可以自行控制变化。</p></main></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
fs.writeFileSync(
  path.join(out, "build-record.json"),
  JSON.stringify(
    {
      records,
      modelCalls: 0,
      indexSha256: sha(Buffer.from(html)),
      quality:
        "rendered chapters; artistic acceptance requires separate review",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    index: path.join(out, "index.html"),
    chapters: records.length,
    findings: records.reduce((n, c) => n + c.renderFindings.length, 0),
    modelCalls: 0,
  }),
);
