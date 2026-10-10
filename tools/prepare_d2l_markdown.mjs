// Convert one pinned D2L chapter to portable Markdown plus local assets.
// Source prose stays unchanged except the documented Sphinx rendering adapter.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { adapt } from "../experiments/visualbook/prepare.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  up = path.join(root, "work/visualbook/upstreams/d2l-zh"),
  sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const [selected, directory] = process.argv.slice(2);
if (
  !selected ||
  !directory ||
  selected.includes("..") ||
  !/^chapter_[a-z-]+\/[a-z-]+\.md$/.test(selected)
)
  throw Error(
    "Use: node tools/prepare_d2l_markdown.mjs chapter_group/file.md fresh-output",
  );
const pin = JSON.parse(
  fs.readFileSync(path.join(root, "experiments/visualbook/sampling.json")),
).upstream_commit;
if (
  execFileSync("git", ["-C", up, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim() !== pin
)
  throw Error("Pinned D2L commit changed");
if (
  execFileSync("git", ["-C", up, "status", "--porcelain"], {
    encoding: "utf8",
  }).trim()
)
  throw Error(
    "Upstream has modifications; do not silently adapt changed source",
  );
const original = path.join(up, selected),
  out = path.resolve(directory),
  raw = fs.readFileSync(original);
if (fs.existsSync(out))
  throw Error(
    "Output exists; retain old adaptations and choose a fresh directory",
  );
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
const adapted = adapt(raw.toString("utf8")),
  sourceUrl = "https://zh.d2l.ai/" + selected.replace(/\.md$/, ".html"),
  assets = [];
let text = adapted.text.replaceAll("SOURCE_URL", sourceUrl);
text = text.replace(/!\[([^]*?)\]\(([^)]+)\)/g, (whole, alt, src) => {
  const source = fs.realpathSync(path.resolve(path.dirname(original), src));
  if (!source.startsWith(up + path.sep))
    throw Error("Asset outside pinned source");
  const bytes = fs.readFileSync(source),
    name = path.basename(source),
    target = path.join(out, "assets", name);
  if (fs.existsSync(target) && sha(fs.readFileSync(target)) !== sha(bytes))
    throw Error("Asset basename collision; use a source-specific mapping");
  fs.writeFileSync(target, bytes);
  assets.push({
    source: path.relative(up, source),
    file: "assets/" + name,
    sha256: sha(bytes),
  });
  return "![" + alt + "](assets/" + name + ")";
});
fs.writeFileSync(path.join(out, "chapter.md"), text);
fs.copyFileSync(path.join(up, "LICENSE"), path.join(out, "D2L-LICENSE.txt"));
const record = {
  original: { selected, upstream_commit: pin, source_sha256: sha(raw) },
  adaptation: adapted.report,
  assets,
  adapted_sha256: sha(text),
  sourceUrl,
  changes:
    "Existing D2L tab/math/directive adapter plus local image link rewrite; no prose rewrite.",
};
fs.writeFileSync(
  path.join(out, "adaptation.json"),
  JSON.stringify(record, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    input: path.join(out, "chapter.md"),
    assets: assets.length,
    sha256: record.adapted_sha256,
  }),
);
