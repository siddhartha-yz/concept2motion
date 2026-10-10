// Real control-boundary audit, no model calls and no self-assigned quality score.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
const root = path.resolve(import.meta.dirname, ".."),
  hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
export async function auditParameters(file, out) {
  if (fs.existsSync(out))
    throw Error("Parameter evidence exists; choose a fresh directory");
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = await import(
      pathToFileURL(
        path.join(
          root,
          "work/visualbook/runtime/node_modules/playwright-core/index.mjs",
        ),
      )
    ),
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath(),
    });
  const report = {
    file: path.resolve(file),
    sha256: hash(fs.readFileSync(file)),
    cases: [],
    findings: [],
    modelCalls: 0,
    scope:
      "Parameter extremes at progress 0.5 and 1, not exhaustive parameter combinations or artistic review.",
  };
  try {
    for (const width of [1280, 375]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.addInitScript(() => (window.__VH_SNAPSHOT = true));
      await page.goto(pathToFileURL(path.resolve(file)).href);
      await page.waitForFunction(() => document.fonts.status === "loaded");
      const figures = await page.evaluate(() =>
        VisualBookRuntime.instances.map((i) => ({
          id: i.id,
          params: i.figure.params ?? [],
        })),
      );
      for (const figure of figures) {
        const cases = [
          {
            name: "default",
            values: Object.fromEntries(
              figure.params.map((p) => [p.key, p.value]),
            ),
          },
        ];
        for (const param of figure.params)
          for (const [name, value] of [
            ["min", param.min],
            ["max", param.max],
          ])
            cases.push({
              name: param.key + "-" + name,
              values: { ...cases[0].values, [param.key]: value },
            });
        if (figure.params.length > 1) {
          cases.push({
            name: "all-min",
            values: Object.fromEntries(
              figure.params.map((p) => [p.key, p.min]),
            ),
          });
          cases.push({
            name: "all-max",
            values: Object.fromEntries(
              figure.params.map((p) => [p.key, p.max]),
            ),
          });
        }
        for (const c of cases)
          for (const progress of [0.5, 1]) {
            const state = await page.evaluate(
              ({ id, values, progress }) => {
                const i = VisualBookRuntime.instances.find((i) => i.id === id);
                let error = null;
                try {
                  for (const [k, v] of Object.entries(values)) i.setParam(k, v);
                  i.setProgress(progress, true);
                } catch (e) {
                  error = String(e);
                }
                const svg = i.svg,
                  box = svg.viewBox.baseVal;
                const visible = (n) => {
                  let alpha = 1;
                  for (
                    let p = n;
                    p && p !== svg.parentElement;
                    p = p.parentElement
                  ) {
                    const s = getComputedStyle(p);
                    if (s.display === "none" || s.visibility === "hidden")
                      return false;
                    alpha *= Number(s.opacity || 1);
                  }
                  return alpha > 0.015;
                };
                const bounds = (n) => {
                  const b = n.getBBox(),
                    m = svg.getScreenCTM().inverse().multiply(n.getScreenCTM()),
                    points = [
                      [b.x, b.y],
                      [b.x + b.width, b.y],
                      [b.x, b.y + b.height],
                      [b.x + b.width, b.y + b.height],
                    ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m)),
                    xs = points.map((p) => p.x),
                    ys = points.map((p) => p.y);
                  return {
                    x: Math.min(...xs),
                    y: Math.min(...ys),
                    w: Math.max(...xs) - Math.min(...xs),
                    h: Math.max(...ys) - Math.min(...ys),
                  };
                };
                const clipped = (n) => {
                  let b = bounds(n);
                  for (
                    let p = n;
                    p && p !== svg.parentElement;
                    p = p.parentElement
                  ) {
                    const clip =
                      p.getAttribute("clip-path") ??
                      getComputedStyle(p).clipPath;
                    const ident = clip?.match(/#([^\)\"']+)/)?.[1];
                    if (!ident) continue;
                    const shape = svg.querySelector(
                      '[id=\"' + ident + '\"] rect',
                    );
                    if (!shape) continue;
                    const r = bounds(shape),
                      x = Math.max(b.x, r.x),
                      y = Math.max(b.y, r.y);
                    b = {
                      x,
                      y,
                      w: Math.max(0, Math.min(b.x + b.w, r.x + r.w) - x),
                      h: Math.max(0, Math.min(b.y + b.h, r.y + r.h) - y),
                    };
                  }
                  return b;
                };
                const nodes = [
                    ...svg.querySelectorAll("text,circle,path,line,rect"),
                  ]
                    .filter((n) => !n.closest("defs") && visible(n))
                    .map((n) => ({
                      tag: n.tagName,
                      text: n.textContent,
                      key: n.dataset.vizKey,
                      ...clipped(n),
                      size: parseFloat(getComputedStyle(n).fontSize),
                    })),
                  texts = nodes.filter((n) => n.tag === "text"),
                  overlaps = [];
                for (let a = 0; a < texts.length; a++)
                  for (let b = a + 1; b < texts.length; b++) {
                    const x = texts[a],
                      y = texts[b];
                    if (
                      x.w &&
                      y.w &&
                      x.x < y.x + y.w - 2 &&
                      x.x + x.w > y.x + 2 &&
                      x.y < y.y + y.h - 2 &&
                      x.y + x.h > y.y + 2
                    )
                      overlaps.push([x.text, y.text]);
                  }
                return {
                  error: error ?? i.error ?? null,
                  facts: i.facts,
                  svg: svg.outerHTML,
                  outside: nodes.filter(
                    (n) =>
                      n.x < -3 ||
                      n.y < -3 ||
                      n.x + n.w > box.width + 3 ||
                      n.y + n.h > box.height + 3,
                  ),
                  tiny: texts.filter((n) => n.size < 12),
                  overlaps,
                };
              },
              { id: figure.id, values: c.values, progress },
            );
            const record = {
              width,
              id: figure.id,
              control: c.name,
              params: c.values,
              progress,
              ...state,
              svgHash: hash(state.svg),
              svg: undefined,
            };
            report.cases.push(record);
            if (
              state.error ||
              state.outside.length ||
              state.tiny.length ||
              state.overlaps.length
            ) {
              report.findings.push({ ...record, facts: undefined });
              await page
                .locator("#figure-" + figure.id)
                .screenshot({
                  path: path.join(
                    out,
                    `${width}-${figure.id}-${c.name}-${progress}.png`,
                  ),
                });
            }
          }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  return report;
}
if (process.argv[1] === import.meta.filename) {
  const report = await auditParameters(process.argv[2], process.argv[3]);
  console.log(
    JSON.stringify({
      cases: report.cases.length,
      findings: report.findings.length,
      scope: report.scope,
    }),
  );
}
