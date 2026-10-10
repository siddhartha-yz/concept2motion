// Actual rendering and geometry evidence. These checks do not judge pedagogy.
import fs from "node:fs";
import path from "node:path";
import { root, output, evidence, dependencies, sha } from "./prepare.mjs";
import { launchBrowser } from "./browser.mjs";
const section = process.argv[2] ?? "spatial",
  attempt = process.argv[3] ?? "first";
const auditId = process.argv[4] ?? "initial";
const raw = path.join(evidence, "raw", section, attempt, "browser", auditId);
if (fs.existsSync(raw))
  throw Error("Refuse to overwrite browser evidence; use a new audit id");
fs.mkdirSync(raw, { recursive: true });
const browser = await launchBrowser();
const records = [],
  errors = [];
const context = await browser.newContext();
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
const active = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "active.json")),
);
const filename = `${section}${active[section] === attempt ? "" : "-" + attempt}.html`;
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 600, height: 800 },
  { width: 375, height: 812 },
  { width: 360, height: 640 },
]) {
  await page.setViewportSize(viewport);
  await page.goto(`file://${output}/${filename}`);
  await page.waitForFunction(() => !!window.visualbook);
  await page.evaluate(() => document.fonts.ready);
  const ids = await page.evaluate(() =>
    window.visualbook.controllers.map((c) => c.f.id),
  );
  for (const id of ids) {
    const controller = await page.evaluate((id) => {
      const c = window.visualbook.controllers.find((c) => c.f.id === id);
      return { states: c.f.states, controls: c.f.controls };
    }, id);
    let variants = [
      {
        name: "default",
        params: Object.fromEntries(
          controller.controls.map((c) => [c.key, c.value]),
        ),
      },
    ];
    for (const c of controller.controls)
      for (const [name, value] of [
        ["min", c.min],
        ["max", c.max],
      ])
        variants.push({
          name: c.key + "-" + name,
          params: { ...variants[0].params, [c.key]: value },
        });
    if (process.argv.includes("--full-controls")) {
      let grid = [{}];
      for (const c of controller.controls) {
        const values = [];
        for (let v = c.min; v <= c.max + 1e-8; v += c.step)
          values.push(Number(v.toFixed(10)));
        if (grid.length * values.length > 64)
          throw Error("Full control grid exceeds 64; choose a bounded sample");
        grid = grid.flatMap((p) => values.map((v) => ({ ...p, [c.key]: v })));
      }
      variants = grid.map((params, i) => ({ name: "grid-" + i, params }));
    }
    for (const state of controller.states)
      for (const v of variants) {
        await page.evaluate(
          ({ id, state, params }) => {
            const c = window.visualbook.controllers.find((c) => c.f.id === id);
            Object.assign(c.params, params);
            c.setState(state, true);
            window.visualbook.sizePolicy();
          },
          { id, state: state.key, params: v.params },
        );
        const figure = page.locator("#figure-" + id);
        await figure.scrollIntoViewIfNeeded();
        await page.waitForTimeout(30);
        const geometry = await figure.evaluate((el) => {
          const svg = el.querySelector(".live svg"),
            r = svg.getBoundingClientRect(),
            vb = svg.viewBox.baseVal;
          const texts = [...svg.querySelectorAll("text")]
            .filter((n) => !n.closest("title,desc"))
            .map((n) => {
              const a = n.getBoundingClientRect();
              return {
                text: n.textContent,
                // Screen bounds include SVG group transforms; getBBox alone does not.
                x: vb.x + ((a.x - r.x) * vb.width) / r.width,
                y: vb.y + ((a.y - r.y) * vb.height) / r.height,
                width: (a.width * vb.width) / r.width,
                height: (a.height * vb.height) / r.height,
                font: Number.parseFloat(getComputedStyle(n).fontSize),
                pixelHeight: a.height,
              };
            });
          const outside = texts.filter(
            (t) =>
              t.x < vb.x - 0.5 ||
              t.y < vb.y - 0.5 ||
              t.x + t.width > vb.x + vb.width + 0.5 ||
              t.y + t.height > vb.y + vb.height + 0.5,
          );
          const overlaps = [];
          for (let i = 0; i < texts.length; i++)
            for (let j = i + 1; j < texts.length; j++) {
              const a = texts[i],
                b = texts[j],
                dx =
                  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
                dy =
                  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
              if (dx > 2 && dy > 3) overlaps.push([a.text, b.text]);
            }
          return {
            viewBox: { width: vb.width, height: vb.height },
            display: { width: r.width, height: r.height },
            small: texts.filter((t) => t.font < 13.9),
            outside,
            overlaps,
            textCount: texts.length,
            documentOverflow:
              document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        const name = `${viewport.width}-${id}-${state.key}-${v.name}`;
        const screenshot = path.join(raw, name + ".png");
        await figure.screenshot({ path: screenshot });
        const facts = await page.evaluate(
          (id) =>
            window.visualbook.controllers.find((c) => c.f.id === id).facts,
          id,
        );
        records.push({
          name,
          viewport,
          figure: id,
          state: state.key,
          params: v.params,
          ...geometry,
          screenshotSha256: (await import("node:crypto"))
            .createHash("sha256")
            .update(fs.readFileSync(screenshot))
            .digest("hex"),
          facts,
        });
      }
  }
}
// Whole-page reading, source preservation and offline fallback are separate.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`file://${output}/${filename}`);
await page.waitForFunction(() => !!window.visualbook);
const source = JSON.parse(
  fs.readFileSync(path.join(output, section + ".source.json")),
);
const preservation = await page.evaluate(() =>
  [...document.querySelectorAll("[data-source-sha256]")].map((n) => ({
    id: n.id,
    sha256: n.dataset.sourceSha256,
  })),
);
await page.locator("#original").click();
const originalHidden = (await page.locator(".visual:visible").count()) === 0;
await page.locator("#original").click();
const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  }),
  staticPage = await nojs.newPage();
await staticPage.goto(`file://${output}/${filename}`);
const staticFigures = await staticPage
  .locator(".graphic .fallback img:visible")
  .count();
await staticPage.screenshot({ path: path.join(raw, "nojs.png") });
const result = {
  section,
  attempt,
  auditId,
  browserVersion: browser.version(),
  htmlSha256: sha(fs.readFileSync(path.join(output, filename))),
  checkerSha256: sha(fs.readFileSync(new URL(import.meta.url))),
  scope:
    "Actual offline Chromium render; label geometry and source hash presence, not artistic or learning acceptance",
  errors,
  sourceBlocksExpected: source.blocks.length - 1,
  sourceBlocksPresent: preservation.length,
  sourcePreserved:
    preservation.length === source.blocks.length - 1 &&
    preservation.every(
      (n, i) =>
        n.id === source.blocks[i + 1].id &&
        n.sha256 === source.blocks[i + 1].sha256,
    ),
  originalHidden,
  staticFigures,
  records,
};
fs.writeFileSync(
  path.join(raw, "audit.json"),
  JSON.stringify(result, null, 2) + "\n",
);
const summary = { ...result, records: records.map(({ facts, ...r }) => r) };
const dest = path.join(evidence, "browser");
fs.mkdirSync(dest, { recursive: true });
fs.writeFileSync(
  path.join(dest, `${section}-${attempt}-${auditId}.json`),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    section,
    attempt,
    errors,
    sourcePreserved: result.sourcePreserved,
    originalHidden,
    staticFigures,
    renders: records.length,
    outside: records
      .filter((r) => r.outside.length)
      .map((r) => ({ name: r.name, text: r.outside })),
    overlaps: records
      .filter((r) => r.overlaps.length)
      .map((r) => ({ name: r.name, pairs: r.overlaps })),
    small: records.filter((r) => r.small.length).length,
  }),
);
await context.close();
await nojs.close();
await browser.close();
process.exitCode =
  errors.length ||
  !result.sourcePreserved ||
  !originalHidden ||
  staticFigures !== idsCount(result) ||
  records.some(
    (r) =>
      r.outside.length ||
      r.overlaps.length ||
      r.small.length ||
      r.documentOverflow,
  )
    ? 1
    : 0;
function idsCount(result) {
  return new Set(result.records.map((r) => r.figure)).size;
}
