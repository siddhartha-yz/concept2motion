import fs from "node:fs";
import path from "node:path";
import {
  prepare,
  output,
  root,
  dependencies,
  sha,
  escape,
  svgDimensions,
} from "./prepare.mjs";
import { renderer, validateResponse } from "./figure.mjs";
import { themeSvg } from "./theme.mjs";
const activePath = path.join(import.meta.dirname, "active.json");
const active = fs.existsSync(activePath)
  ? JSON.parse(fs.readFileSync(activePath))
  : {};
let katexCss = fs.readFileSync(
  path.join(dependencies, "node_modules/katex/dist/katex.min.css"),
  "utf8",
);
katexCss = katexCss.replace(/,url\([^)]+\) format\("(?:woff|truetype)"\)/g, "");
katexCss = katexCss.replace(/url\(([^)]+)\)/g, (whole, name) => {
  const file = path.join(dependencies, "node_modules/katex/dist", name);
  return fs.existsSync(file)
    ? `url(data:font/woff2;base64,${fs.readFileSync(file).toString("base64")})`
    : whole;
});
const css =
  fs.readFileSync(path.join(import.meta.dirname, "style.css"), "utf8") +
  katexCss;
const app = fs.readFileSync(path.join(import.meta.dirname, "app.js"), "utf8");
const themeScript = themeSvg.toString();
const head = (title, math = true) =>
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'"><title>${escape(title)}</title><style>${math ? css : fs.readFileSync(path.join(import.meta.dirname, "style.css"), "utf8")}</style></head>`;
const publishedBlocks = new Map();
const block = (b) =>
  `<div class="source-block" id="${b.id}" data-source-sha256="${b.sha256}">${b.html}${publishedBlocks.get(b.id) ?? ""}</div>`;
const records = [];
for (const book of prepare()) {
  const snapshotFile = path.join(
    root,
    "work/visualbook/source-snapshots",
    book.id + ".outputs.json",
  );
  let restored = 0;
  if (fs.existsSync(snapshotFile)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotFile));
    if (snapshot.sourceSha256 !== book.sourceSha256)
      throw Error("Supplemental output source changed");
    for (const record of snapshot.records.filter((r) => r.matched)) {
      const anchor = book.blocks.find(
        (b) => b.id === record.anchor && b.sha256 === record.anchorSha256,
      );
      if (!anchor) throw Error("Supplemental output anchor changed");
      const html = record.outputs
        .map((o) => {
          if (o.kind === "text")
            return `<pre class="published-output">${escape(o.text)}</pre>`;
          if (!o.assetFile) return "";
          const file = path.resolve(root, o.assetFile);
          if (!file.startsWith(path.join(root, "work") + path.sep))
            throw Error("Unexpected source asset path");
          const svg = fs.readFileSync(file);
          if (sha(svg) !== o.assetSha256)
            throw Error("Published image changed");
          const dims = svgDimensions(svg);
          return `<img class="published-output-image" ${dims.width ? `width="${dims.width}" height="${dims.height}"` : ""} src="data:image/svg+xml;base64,${svg.toString("base64")}" alt="原版代码输出图" loading="lazy">`;
        })
        .join("");
      if (html) {
        publishedBlocks.set(
          anchor.id,
          `<div class="source-output">${html}</div>`,
        );
        restored++;
      }
    }
  }
  const attempt = process.env.VISUALBOOK_ATTEMPT ?? active[book.id];
  let response = { figures: [] },
    bindings = [],
    error = null,
    candidateFileHash = null;
  if (attempt) {
    const candidate = path.join(
      import.meta.dirname,
      "candidates",
      book.id,
      attempt,
    );
    try {
      const brief = JSON.parse(
        fs.readFileSync(path.join(candidate, "brief.json")),
      );
      if (
        brief.sourceSha256 !== book.sourceSha256 ||
        brief.sourceCommit !== book.sourceCommit
      )
        throw new Error("Candidate source is stale");
      if (
        brief.anchorHashes &&
        brief.anchorHashes.some(
          (a) =>
            !book.blocks.some((b) => b.id === a.id && b.sha256 === a.sha256),
        )
      )
        throw Error(
          "Candidate anchors changed; explicit rebind/review required",
        );
      response = JSON.parse(
        fs.readFileSync(path.join(candidate, "response.json")),
      );
      candidateFileHash = sha(
        fs.readFileSync(path.join(candidate, "response.json")),
      );
      bindings = validateResponse(book, response);
    } catch (e) {
      error = String(e);
      response = { figures: [] };
      bindings = [];
    }
  }
  const allFigures = [];
  function figure(f) {
    const render = renderer(f.code),
      params = Object.fromEntries(f.controls.map((c) => [c.key, c.value]));
    const fallback = themeSvg(
      render({ width: 710, state: f.states[0].key, params }).svg,
    );
    const mobile = themeSvg(
      render({ width: 335, state: f.states[0].key, params }).svg,
    );
    const data = (s) =>
      "data:image/svg+xml;base64," + Buffer.from(s).toString("base64");
    const staticStates = f.states
      .slice(1)
      .map((s) => {
        const wide = themeSvg(render({ width: 710, state: s.key, params }).svg);
        const narrow = themeSvg(
          render({ width: 335, state: s.key, params }).svg,
        );
        return `<div class="static-state"><p>${escape(s.label)}</p><picture><source media="(max-width:600px)" srcset="${data(narrow)}"><img src="${data(wide)}" alt="${escape(f.alt + "：" + s.label)}"></picture></div>`;
      })
      .join("");
    allFigures.push(f);
    const states = f.states
      .map(
        (s) =>
          `<button data-state="${escape(s.key)}" aria-pressed="${s === f.states[0]}">${escape(s.label)}</button>`,
      )
      .join("");
    const controls = f.controls
      .map(
        (c) =>
          `<label><span class="param-name">${escape(c.label)}</span><input aria-label="${escape(c.label)}" type="range" data-param="${escape(c.key)}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}"><output>${c.value}</output></label>`,
      )
      .join("");
    return `<figure class="visual${f.states.length > 1 ? " sticky" : ""}" id="figure-${f.id}" aria-label="${escape(f.alt)}"><div class="figure-top"><h3>${escape(f.title)}</h3><span class="kind">补充图解</span></div><div class="graphic"><div class="live">${fallback}</div><picture class="fallback"><source media="(max-width:600px)" srcset="${data(mobile)}"><img src="${data(fallback)}" alt="${escape(f.alt)}"></picture></div><div class="static-states">${staticStates}</div><details class="fig-controls"><summary>自己试一下</summary><div class="states">${states}</div><div class="ranges">${controls}</div><button class="reset">回到阅读位置</button><button class="report-figure" data-report="${escape(f.id)}">记下问题</button><p class="assumptions">${escape(f.assumptions)}</p></details><p class="figure-status" role="status" aria-live="polite"></p></figure>`;
  }
  let body = "",
    i = 1; // h1 is the displayed book title, retained once.
  while (i < book.blocks.length) {
    const bind = bindings.find((b) => b.start === i);
    if (bind) {
      const f = response.figures.find((f) => f.id === bind.id);
      body += '<div class="viz-scope">';
      for (let j = bind.start; j <= bind.end; j++) {
        body += block(book.blocks[j]);
        if (j === bind.after) body += figure(f);
      }
      body += "</div>";
      i = bind.end + 1;
    } else {
      body += block(book.blocks[i]);
      i++;
    }
  }
  const serial = JSON.stringify({
    section: book.id,
    sourceSha256: book.sourceSha256,
    attempt,
    figures: allFigures,
    candidateSha256: candidateFileHash,
  }).replaceAll("<", "\\u003c");
  const functions = allFigures
    .map((f) => `${JSON.stringify(f.id)}:(()=>{${f.code}\n;return render})()`)
    .join(",");
  const toc = book.blocks
    .filter((b) => b.type === "heading" && b.depth === 2)
    .map((b) => `<a href="#${b.id}">${escape(b.raw.replace(/^#+ /, ""))}</a>`)
    .join("");
  const metadata = `<p class="source-note">来源：<a href="${book.sourceUrl}">D2L 原版</a>。保留正文、原图和 PyTorch 代码${restored ? "，补入 " + restored + " 处能与源码匹配的原版公开输出" : "；代码输出尚未补齐"}。本机未执行代码。新增图解来自实验生成，尚待你试读。</p>`;
  const top = `<a class="skip" href="#text">跳到正文</a><header class="top"><a class="brand" href="index.html">D2L / 试读书架</a><div class="top-actions"><label><input id="follow" type="checkbox" checked>随阅读</label><button id="original" aria-pressed="false">只看原文</button></div></header>`;
  const review = `<aside class="review-note"><details><summary>来源与实验说明</summary><p>原文作者：D2L 作者团队。固定源码提交 ${book.sourceCommit.slice(0, 12)}；选择 PyTorch 版本，转换原文引用为来源链接、移除构建标记、插入独立图解；公式和图片由本地导入。<a href="D2L-LICENSE.txt">上游 Apache 2.0 许可证</a>。示意参数和实验假设见图的审查记录，不能当成训练结果。图运行失败时显示静态图。</p><p>新增图 ${allFigures.length} 幅；版本 ${escape(attempt ?? "未生成")}。${error ? "本版本插入失败，已保留正文：" + escape(error) : ""}</p></details></aside>`;
  const feedback = `<dialog id="feedback-dialog" aria-labelledby="feedback-title"><form method="dialog"><h2 id="feedback-title">哪部分妨碍了阅读？</h2><p id="feedback-context"></p><label for="feedback-note">写下你看到的问题</label><textarea id="feedback-note" rows="4" placeholder="例如：这根箭头让我分不清谁传给谁。"></textarea><div class="dialog-actions"><button value="cancel">取消</button><button type="button" id="feedback-download">保存问题记录</button></div><p class="source-note">文件会带上当前图、状态和参数，方便修改。只保存到本机。</p></form></dialog>`;
  const html =
    head(book.title) +
    `<body>${top}<main class="book" id="text"><header class="book-head"><p class="eyebrow">边读 · 边看清关系</p><h1 id="${book.blocks[0].id}">${escape(book.title)}</h1>${metadata}<details><summary>本节目录</summary><nav class="toc">${toc}</nav></details></header>${body}${review}<footer><a href="index.html">回到试读书架</a></footer></main>${feedback}<noscript><style>.live{display:none}.graphic .fallback,.static-states{display:block}.fig-controls,.top-actions{display:none}.visual.sticky{position:relative;top:0}</style></noscript><script type="application/json" id="visualbook-data">${serial}</script><script>${themeScript}\n${app}\nconst data=JSON.parse(document.querySelector('#visualbook-data').textContent);data.renderers={${functions}};startVisualbook(data);</script></body></html>`;
  fs.writeFileSync(
    path.join(
      output,
      `${book.id}${process.env.VISUALBOOK_ATTEMPT ? "-" + attempt : ""}.html`,
    ),
    html,
  );
  records.push({
    id: book.id,
    title: book.title,
    attempt,
    sourceSha256: book.sourceSha256,
    adaptation: book.adaptation,
    restoredPublishedOutputBlocks: restored,
    blocks: book.blocks.length,
    figures: allFigures.length,
    bindings,
    error,
    htmlBytes: Buffer.byteLength(html),
    htmlSha256: sha(html),
  });
}
fs.writeFileSync(
  path.join(output, "build-report.json"),
  JSON.stringify(records, null, 2) + "\n",
);
const descriptions = {
  spatial: "看清一个窗口如何汇总输入，以及各通道为何互不混合。",
  iteration: "观察随机更新与学习率变化，不把单次轨迹当成普遍结论。",
  routing: "把分数、掩蔽、权重和输出联系起来。",
  execution: "看清数据拆分、梯度聚合与相同参数更新。",
  "holdout-iteration": "学习率如何抵消下降收益，曲率如何改变更新方向。",
  "holdout-spatial": "窗口中心为什么偏移，最后一个窗口何时能放下。",
};
const rows = records
  .filter((b) => b.attempt)
  .map(
    (b) =>
      `<li><a href="${b.id}.html">${escape(b.title)}</a><p>${descriptions[b.id] ?? "在原文中审查新增图解的关系、假设和阅读体验。"}</p><div class="variants"><a href="${b.id}.html?original=1">原文对照</a><a href="${b.id}-first.html">保留的首版</a></div></li>`,
  )
  .join("");
fs.copyFileSync(
  path.join(dependencies, "node_modules/katex/LICENSE"),
  path.join(output, "KATEX-LICENSE.txt"),
);
fs.writeFileSync(
  path.join(output, "index.html"),
  head("D2L 可视化教材试读", false) +
    `<body><main class="library"><p class="eyebrow">TEXTBOOK → VISUALBOOK</p><h1>读懂一个关系，<br>再接着读下去。</h1><p class="library-intro">图解放在它解释的段落附近。默认随阅读变化；想多看一会儿，就打开图下方的“自己试一下”。没有自动播放，也不需要跟着鼠标。</p><ul class="book-list">${rows}</ul><p class="notice">首批四节按题材分组随机抽取，随后从预先保留的候选中再随机抽取两节。这是可供你审查的实验版本，不能据此宣称学习效率提高。原文对照保留原图与公式，部分公开代码输出已匹配补入；完整版请看每节的 D2L 原版链接。</p></main></body></html>`,
);
process.exitCode = records.some((r) => r.attempt && r.error) ? 1 : 0;
console.log(
  JSON.stringify(
    records.map(({ id, attempt, figures, error }) => ({
      id,
      attempt,
      figures,
      error,
    })),
  ),
);
