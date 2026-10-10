import fs from "node:fs";
import path from "node:path";
import { build, preview, staticExport } from "./visualbook.mjs";
const root = path.resolve(import.meta.dirname, "..");
export async function buildCatalog(out, { ids = null } = {}) {
  const catalog = JSON.parse(
      fs.readFileSync(path.join(root, "packages/visualbook/catalog.json")),
    ),
    designs = ids
      ? catalog.designs.filter((d) => ids.includes(d.id))
      : catalog.designs;
  fs.mkdirSync(out, { recursive: true });
  const records = [];
  for (const design of designs) {
    const blocks = [
      {
        id: "design-001",
        raw: design.limits,
        type: "paragraph",
        sha256: "maintenance-control",
        html: `<p>${design.limits}</p>`,
        math: { expected: 0 },
      },
    ];
    const source = {
        title: design.title,
        sourceName: "维护者编写的共享设计示例",
        sourceUrl: "https://github.com/siddhartha-yz/visualbook-harness",
        sourceSha256: "maintenance-control",
        blocks,
      },
      plan = {
        figures: [
          { ...design, afterAnchor: "design-001", summary: design.limits },
        ],
      },
      file = path.join(out, design.id + ".html");
    const html = build(source, plan);
    fs.writeFileSync(file, html);
    const evidence = path.join(out, "evidence", design.id),
      report = await preview(file, evidence);
    staticExport(file, evidence, file);
    records.push({ ...design, file, evidence, findings: report.findings });
  }
  fs.writeFileSync(
    path.join(out, "catalog-record.json"),
    JSON.stringify(
      {
        kind: "maintenance-authored reusable designs, not generated books",
        modelCalls: 0,
        records,
      },
      null,
      2,
    ) + "\n",
  );
  return records;
}
if (process.argv[1] === import.meta.filename) {
  const records = await buildCatalog(path.resolve(process.argv[2]), {
    ids: process.argv[3] ? [process.argv[3]] : null,
  });
  console.log(
    JSON.stringify(
      records.map((r) => ({ id: r.id, findings: r.findings.length })),
    ),
  );
  if (records.some((r) => r.findings.length)) process.exitCode = 1;
}
