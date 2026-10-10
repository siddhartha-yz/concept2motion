import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { renderingMath, countMath, inspectMath } from "../../packages/visualbook/math.mjs";
export const root = path.resolve(import.meta.dirname, "../..");
export const output = path.resolve(
  process.env.VISUALBOOK_OUTPUT ?? path.join(root, "outputs/visualbook"),
);
export const upstream = path.join(root, "work/visualbook/upstreams/d2l-zh");
export const dependencies = path.resolve(
  process.env.VISUALBOOK_DEPENDENCIES ??
    path.join(root, "work/visualbook/runtime"),
);
export const evidence = path.resolve(
  process.env.VISUALBOOK_EVIDENCE_DIR ??
    path.join(root, "evaluation/2026-10-10/d2l-visualbook-v1"),
);
export const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const get = async (name, file = "index.js") =>
  import(pathToFileURL(path.join(dependencies, "node_modules", name, file)));
const { unified } = await get("unified"),
  { default: parse } = await get("remark-parse"),
  { default: gfm } = await get("remark-gfm"),
  { default: math } = await get("remark-math");
const { toHast } = await get("mdast-util-to-hast"),
  { VFile } = await get("vfile"),
  { toHtml } = await get("hast-util-to-html"),
  { default: katex } = await get("rehype-katex");
const parser = unified().use(parse).use(gfm).use(math);

export function adapt(source) {
  const report = {
    excludedTabBlocks: 0,
    excludedCodeBlocks: 0,
    keptCodeBlocks: 0,
    removedDirectives: 0,
  };
  // Keep line breaks for traceable locations. Untagged Python input is D2L's
  // default MXNet variant; explicit `all`/PyTorch variants are retained.
  let text = source.replace(
    /:begin_tab:`([^`]+)`\s*\n([\s\S]*?):end_tab:/g,
    (whole, tabs, body) => {
      if (tabs.split(/[, ]+/).some((t) => ["pytorch", "all"].includes(t)))
        return body;
      report.excludedTabBlocks++;
      return "\n".repeat(whole.split("\n").length - 1);
    },
  );
  text = text.replace(/```([^\n]*)\n([\s\S]*?)```/g, (whole, lang, body) => {
    const tab = body.match(/^#@tab (.+)$/m)?.[1];
    const keep =
      !lang.includes(".input") ||
      (tab && tab.split(/[, ]+/).some((t) => ["pytorch", "all"].includes(t)));
    if (!keep) {
      report.excludedCodeBlocks++;
      return "\n".repeat(whole.split("\n").length - 1);
    }
    report.keptCodeBlocks++;
    return (
      "```" +
      (lang.includes(".python") ? "python" : lang) +
      "\n" +
      body.replace(/^#@(tab|save).*\n/gm, "") +
      "```"
    );
  });
  text = text.replace(/^:(label|eqlabel):`[^`]+`\s*$/gm, () => {
    report.removedDirectives++;
    return "";
  });
  // D2L permits closing $$ after a formula on the same line. Remark requires
  // it on a delimiter line for a multiline block; otherwise it eats the rest
  // of the chapter as one math node. Normalize delimiters, never formula text.
  text = text.replace(
    /^\$\$(?![^\n]*\$\$)([\s\S]*?)\$\$(?=[ \t]*\n|$)/gm,
    (whole, body) => {
      const fixed = "$$\n" + body.trim() + "\n$$";
      if (fixed !== whole)
        report.mathDelimitersAdapted = (report.mathDelimitersAdapted ?? 0) + 1;
      return fixed;
    },
  );
  text = text
    .replace(/\[\*\*([^]*?)\*\*\]/g, "**$1**")
    .replace(/\(\*\*([^]*?)\*\*\)/g, "**$1**");
  // Keep cross-reference identity rather than inventing section numbers.
  text = text.replace(
    /:(numref|eqref|cite):`([^`]+)`/g,
    "[原文引用：$2](SOURCE_URL)",
  );
  return { text, report };
}

export function svgDimensions(bytes) {
  const tag = bytes.toString("utf8").match(/<svg\b[^>]*>/)?.[0] ?? "";
  const parse = (name) => {
    const value = tag.match(
      new RegExp("\\b" + name + '="([0-9.]+)(px|pt|in|cm|mm)?"'),
    );
    return value
      ? +value[1] *
          ({ pt: 96 / 72, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 }[value[2]] ?? 1)
      : null;
  };
  const w = parse("width"),
    h = parse("height");
  if (w > 0 && h > 0) return { width: w, height: h };
  const box = tag
    .match(/\bviewBox="([^"]+)"/)?.[1]
    .trim()
    .split(/[ ,]+/)
    .map(Number);
  return box?.length === 4 && box[2] > 0 && box[3] > 0
    ? { width: box[2], height: box[3] }
    : {};
}
function inlineImages(hast, sourcePath, stats) {
  for (const n of hast.children ?? []) {
    if (n.tagName === "img") {
      const target = path.resolve(path.dirname(sourcePath), n.properties.src);
      if (!target.startsWith(upstream + path.sep) || !fs.existsSync(target))
        throw new Error("Image outside source or missing: " + target);
      const ext = path.extname(target).slice(1);
      const bytes = fs.readFileSync(target);
      n.properties.src = `data:image/${ext === "svg" ? "svg+xml" : ext};base64,${bytes.toString("base64")}`;
      if (ext === "svg") Object.assign(n.properties, svgDimensions(bytes));
      n.properties.loading = "lazy";
      stats.images++;
    }
    if (n.properties?.className?.includes("katex-error")) stats.mathErrors++;
    inlineImages(n, sourcePath, stats);
  }
}
function referenceIndex() {
  const refs = new Map();
  for (const dir of fs
    .readdirSync(upstream)
    .filter((n) => n.startsWith("chapter_"))) {
    for (const file of fs
      .readdirSync(path.join(upstream, dir))
      .filter((n) => n.endsWith(".md") && !n.endsWith("_origin.md"))) {
      const src = fs.readFileSync(path.join(upstream, dir, file), "utf8");
      const title = src.match(/^# (.+)$/m)?.[1]?.replace(/[\[\]*]/g, "");
      for (const m of src.matchAll(/:(label|eqlabel):`([^`]+)`/g))
        refs.set(m[2], {
          url: `https://zh.d2l.ai/${dir}/${file.replace(/\.md$/, ".html")}`,
          title,
          kind: m[1],
          prefix: src.slice(0, m.index).trim(),
        });
    }
  }
  return refs;
}
function readableReferences(hast, refs, sourceUrl, blocks) {
  for (const n of hast.children ?? []) {
    if (n.tagName === "a" && n.children?.[0]?.type === "text") {
      const label = n.children[0].value.match(/^原文引用：(.+)$/)?.[1];
      if (label) {
        const ref = refs.get(label);
        let text =
          ref?.kind === "eqlabel"
            ? "这个公式"
            : label.startsWith("fig_") || label.startsWith("img_")
              ? "图示"
              : (ref?.title ?? "参考文献");
        n.children = [{ type: "text", value: text }];
        if (ref) {
          n.properties.href = ref.url;
          if (ref.url === sourceUrl) {
            const last = ref.prefix.split("\n").at(-1);
            const match = blocks.find(
              (b) => b.raw.includes(last) && last.length > 4,
            );
            if (match) n.properties.href = "#" + match.id;
          }
        }
        n.properties.title = "原文引用 " + label;
      }
    }
    readableReferences(n, refs, sourceUrl, blocks);
  }
}
export function prepare() {
  const sampling = JSON.parse(
    fs.readFileSync(process.env.VISUALBOOK_SAMPLING ?? path.join(import.meta.dirname, "sampling.json")),
  );
  const reserved = path.join(import.meta.dirname, "holdout-sampling.json");
  if (!process.env.VISUALBOOK_SAMPLING && fs.existsSync(reserved)) {
    const extra = JSON.parse(fs.readFileSync(reserved));
    if (extra.upstream_commit !== sampling.upstream_commit)
      throw Error("Reserved source version differs");
    sampling.sections.push(...extra.sections);
  }
  const pin = execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (pin !== sampling.upstream_commit) throw new Error("D2L commit changed");
  fs.mkdirSync(output, { recursive: true });
  const books = [],
    refs = referenceIndex();
  for (const sample of sampling.sections) {
    const sourcePath = path.join(upstream, sample.selected),
      source = fs.readFileSync(sourcePath, "utf8");
    if (sha(source) !== sample.source_sha256)
      throw new Error("D2L source changed");
    const sourceUrl = `https://zh.d2l.ai/${sample.selected.replace(/\.md$/, ".html")}`;
    const { text, report } = adapt(source);
    const adapted = text.replaceAll("SOURCE_URL", sourceUrl);
    const tree = parser.parse(adapted),
      stats = { images: 0, mathErrors: 0, mathExpected: 0, mathRendered: 0 };
    for (const node of tree.children)
      if (
        node.type === "math" &&
        (/^#{1,6} /m.test(node.value) || node.value.includes("```"))
      )
        throw Error(
          "Math parser swallowed prose/code; refuse to build " +
            sample.selected,
        );
    const blocks = tree.children.map((node, index) => {
      const raw = adapted.slice(
        node.position.start.offset,
        node.position.end.offset,
      );
      const id = `${sample.stratum}-${String(index + 1).padStart(3, "0")}`;
      // D2L's Sphinx renderer wraps top-level line breaks in `split`. KaTeX
      // requires an explicit environment. Keep raw/hash unchanged; this is
      // solely a rendering adaptation, not a source or equation rewrite.
      let renderedNode = node;
      // A standalone one-line $$...$$ is display math in D2L, while Remark
      // parses it as an inline math paragraph. Fix presentation only: retain
      // the original raw block and hash used by saved generation inputs.
      if (
        node.type === "paragraph" &&
        node.children.length === 1 &&
        node.children[0].type === "inlineMath" &&
        raw.trim().startsWith("$$") &&
        raw.trim().endsWith("$$")
      ) {
        renderedNode = {
          type: "math",
          value: node.children[0].value,
          position: node.position,
        };
        report.oneLineDisplayMath = (report.oneLineDisplayMath ?? 0) + 1;
      }
      const boldFixed = raw.replace(/([^\s\p{P}])\*\*(?=`)/gu, "$1 **");
      if (boldFixed !== raw) {
        renderedNode = parser.parse(boldFixed).children[0];
        report.emphasisAdapted = (report.emphasisAdapted ?? 0) + 1;
      }
      renderedNode = renderingMath(renderedNode, report);
      const hast = toHast(
        { type: "root", children: [renderedNode] },
        { allowDangerousHtml: false },
      );
      if (
        node.type === "paragraph" &&
        node.children.length === 1 &&
        node.children[0].type === "image"
      ) {
        const alt = node.children[0].alt;
        if (alt) {
          const caption = toHast(parser.parse(alt));
          hast.children[0].tagName = "figure";
          hast.children[0].properties.className = ["original-figure"];
          hast.children[0].children.push({
            type: "element",
            tagName: "figcaption",
            properties: {},
            children: caption.children[0]?.children ?? [],
          });
          report.figureCaptions = (report.figureCaptions ?? 0) + 1;
        }
      }
      const diagnostics = new VFile();
      unified().use(katex, { trust: false, strict: "ignore" }).runSync(hast, diagnostics);
      if (diagnostics.messages.length) throw Error("KaTeX diagnostic in " + sample.selected + ": " + diagnostics.messages.map(m => m.cause?.message ?? m.reason).join("; "));
      const coverage = inspectMath(hast, countMath(renderedNode));
      stats.mathExpected += coverage.expected;
      stats.mathRendered += coverage.rendered;
      inlineImages(hast, sourcePath, stats);
      return {
        id,
        sha256: sha(raw),
        type: node.type,
        depth: node.depth ?? null,
        line: node.position.start.line,
        raw,
        math: coverage,
        hast,
      };
    });
    for (const b of blocks) {
      readableReferences(b.hast, refs, sourceUrl, blocks);
      b.html = toHtml(b.hast);
      delete b.hast;
    }
    const book = {
      id: sample.stratum,
      title:
        blocks.find((b) => b.type === "heading")?.raw.replace(/^#+ /, "") ??
        sample.stratum,
      source: sample.selected,
      sourceUrl,
      sourceCommit: pin,
      sourceSha256: sha(source),
      adaptedSha256: sha(adapted),
      adaptation: { ...report, ...stats },
      blocks,
    };
    fs.writeFileSync(
      path.join(output, `${book.id}.source.json`),
      JSON.stringify(book, null, 2) + "\n",
    );
    books.push(book);
  }
  fs.copyFileSync(
    path.join(upstream, "LICENSE"),
    path.join(output, "D2L-LICENSE.txt"),
  );
  return books;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    JSON.stringify(
      prepare().map((b) => ({
        id: b.id,
        title: b.title,
        blocks: b.blocks.length,
        ...b.adaptation,
      })),
    ),
  );
