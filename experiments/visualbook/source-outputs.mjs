// Restore published D2L outputs only after an exact normalized code match.
// This is a downloaded upstream snapshot, never a local execution claim.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root, output, sha } from "./prepare.mjs";
const { chromium } = await import(
  pathToFileURL(
    path.join(
      root,
      "work/visualbook/runtime/node_modules/playwright-core/index.mjs",
    ),
  )
);
const folder = path.join(root, "work/visualbook/source-snapshots");
const normalize = (s) =>
  s
    .replace(/#@save/g, "")
    .split("\n")
    .map((s) => s.trimEnd())
    .filter((s) => s.trim())
    .join("\n")
    .trim();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ??
    "/home/yang-zhi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
});
const page = await browser.newPage();
await page.goto(`file://${output}/index.html`);
const summary = [];
for (const file of fs.readdirSync(folder).filter((n) => n.endsWith(".html"))) {
  const section = file.slice(0, -5),
    book = JSON.parse(
      fs.readFileSync(path.join(output, section + ".source.json")),
    );
  const html = fs.readFileSync(path.join(folder, file), "utf8");
  const cells = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html"),
      cells = [];
    for (const code of doc.querySelectorAll(".highlight-python pre")) {
      const panel = code.closest(".mdl-tabs__panel");
      if (panel && !panel.id.startsWith("pytorch-")) continue;
      const outputs = [];
      let container = code.closest(".highlight-python"),
        next = container.nextElementSibling;
      while (next && next.matches(".output,.figure")) {
        for (const p of next.querySelectorAll("pre"))
          outputs.push({ kind: "text", text: p.textContent });
        for (const img of next.querySelectorAll("img"))
          outputs.push({
            kind: "image",
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
          });
        next = next.nextElementSibling;
      }
      if (outputs.length)
        cells.push({
          code: code.textContent,
          panel: panel?.id ?? "common",
          outputs,
        });
    }
    return cells;
  }, html);
  const records = [];
  for (const cell of cells) {
    const matches = book.blocks.filter(
      (b) =>
        b.type === "code" &&
        normalize(b.raw.replace(/^```[^\n]*\n/, "").replace(/\n```$/, "")) ===
          normalize(cell.code),
    );
    records.push({
      matched: matches.length === 1,
      anchor: matches.length === 1 ? matches[0].id : null,
      anchorSha256: matches.length === 1 ? matches[0].sha256 : null,
      codeSha256: sha(normalize(cell.code)),
      code: cell.code,
      panel: cell.panel,
      outputs: cell.outputs.map((o) =>
        o.kind === "text"
          ? o
          : { ...o, url: new URL(o.src, book.sourceUrl).href },
      ),
    });
  }
  const result = {
    section,
    sourceUrl: book.sourceUrl,
    sourceCommit: book.sourceCommit,
    sourceSha256: book.sourceSha256,
    websiteSnapshotSha256: sha(html),
    snapshotDate: "2026-10-10",
    scope:
      "Published PyTorch/common D2L outputs; code normalized for blank lines/trailing spaces/#@save only; not local execution; website build commit unavailable",
    records,
  };
  fs.writeFileSync(
    path.join(folder, section + ".outputs.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  summary.push({
    section,
    cells: cells.length,
    matched: records.filter((r) => r.matched).length,
    unmatched: records.filter((r) => !r.matched).length,
    websiteSnapshotSha256: result.websiteSnapshotSha256,
  });
}
fs.writeFileSync(
  path.join(folder, "match-summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(JSON.stringify(summary));
await browser.close();
