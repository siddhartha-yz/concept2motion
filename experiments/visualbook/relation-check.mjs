// Checks selected mathematical relations in actual SVG elements, not facts alone.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { dependencies, evidence, sha } from "./prepare.mjs";
import { renderer } from "./figure.mjs";
import { launchBrowser } from "./browser.mjs";
const browser = await launchBrowser();
const page = await browser.newPage();
await page.route("**/*", (route) => route.abort());
const records = [];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
async function check(
  section,
  attempt,
  id,
  width,
  state,
  params,
  expectedPass,
  verify,
) {
  const file = path.join(
    import.meta.dirname,
    "candidates",
    section,
    attempt,
    "response.json",
  );
  const f = JSON.parse(fs.readFileSync(file)).figures.find((f) => f.id === id);
  const svg = renderer(f.code)({ width, state, params }).svg;
  await page.setContent(svg);
  const actual = await page.evaluate(() => {
    const attrs = (n) =>
      Object.fromEntries([...n.attributes].map((a) => [a.name, a.value]));
    return {
      texts: [...document.querySelectorAll("svg text")].map(
        (n) => n.textContent,
      ),
      arrows: [...document.querySelectorAll("g > line")]
        .filter((n) => n.parentElement.querySelector("polygon"))
        .map(attrs),
      bars: [...document.querySelectorAll('rect[height="12"]')].map(attrs),
      ellipses: [...document.querySelectorAll("ellipse")].map(attrs),
      stems: [...document.querySelectorAll("g[opacity] line")].map(attrs),
    };
  });
  let pass = true,
    error = null;
  try {
    verify(actual);
  } catch (e) {
    pass = false;
    error = String(e);
  }
  records.push({
    section,
    attempt,
    figure: id,
    width,
    state,
    params,
    pass,
    expectedPass,
    error,
    candidateSha256: sha(fs.readFileSync(file)),
    svgSha256: sha(svg),
  });
}
for (const width of [320, 710]) {
  for (const state of ["raw", "scaled"])
    for (let d = 1; d <= 16; d++)
      await check(
        "routing",
        "axis-revised",
        "dot-product-exact-spread",
        width,
        state,
        { d },
        true,
        (a) => {
          const probabilities = [];
          let p = 2 ** -d;
          for (let j = 0; j <= d; j++) {
            if (j) p = (p * (d - j + 1)) / j;
            probabilities.push(p);
          }
          const max = Math.max(...probabilities);
          assert.equal(a.stems.length, 2 * (d + 1));
          a.stems.forEach((line, i) =>
            close(
              ((+line.y1 - +line.y2) * max) / 44,
              probabilities[i % (d + 1)],
            ),
          );
          assert.equal(a.texts.filter((t) => t === max.toFixed(2)).length, 2);
          assert.ok(a.texts.some((t) => t.includes("高度为概率")));
        },
      );
  for (const attempt of ["first", "revised"])
    for (const state of ["sample", "mean"])
      for (let sample = 1; sample <= 4; sample++)
        await check(
          "iteration",
          attempt,
          "sgd-gradient-mean",
          width,
          state,
          { sample },
          attempt === "revised",
          (a) => {
            const gradients = [
              [3, 1],
              [-1, 3],
              [2, -1],
              [0, 1],
              [1, 1],
            ];
            assert.equal(a.arrows.length, 5);
            const first = a.arrows[0],
              sx = (+first.x2 - +first.x1) / 3,
              sy = +first.y1 - +first.y2;
            close(sx, sy);
            a.arrows.forEach((l, i) => {
              close(+l.x2 - +l.x1, sx * gradients[i][0]);
              close(+l.y1 - +l.y2, sy * gradients[i][1]);
            });
            assert.ok(
              a.texts.includes("g₁") && a.texts.includes("g₂"),
              "Gradient axes must be labeled as gradient components",
            );
          },
        );
  for (const attempt of ["first", "revised"])
    for (const state of ["local", "sum", "broadcast"])
      await check(
        "execution",
        attempt,
        "allreduce-vector-steps",
        width,
        state,
        {},
        attempt === "revised" || state !== "local",
        (a) => {
          const visible = a.texts.join(" ");
          const showsSum = /\[\s*3,\s*3\s*\]/.test(visible);
          if (state === "local")
            assert.ok(
              !showsSum,
              "Initial stage prematurely displays the final sum",
            );
          else assert.ok(showsSum);
        },
      );
  for (const state of ["change", "curvature"])
    for (let step = 1; step <= 24; step++) {
      const eta = step * 0.05;
      await check(
        "holdout-iteration",
        "first",
        "gd-step-balance",
        width,
        state,
        { eta },
        true,
        (a) => {
          const values = [
              -400 * eta,
              400 * eta * eta,
              (10 - 20 * eta) ** 2 - 100,
            ],
            scale = (width - 48) / 1100,
            zero = 24 + 500 * scale;
          assert.equal(a.bars.length, 3);
          a.bars.forEach((r, i) => {
            close(+r.width, Math.abs(values[i]) * scale);
            close(+r.x, Math.min(zero, zero + values[i] * scale));
          });
        },
      );
    }
  for (let kappa = 1; kappa <= 12; kappa++)
    await check(
      "holdout-iteration",
      "first",
      "diagonal-coordinate-step",
      width,
      "compare",
      { kappa },
      true,
      (a) => {
        const arrows = a.arrows.filter((l) => l["stroke-width"] === "2.2");
        assert.equal(arrows.length, 2);
        assert.equal(a.ellipses.length, 6);
        const scale = +a.ellipses[0].rx / 2;
        a.ellipses.forEach((e, i) => {
          const level = [4, 16, 36][i % 3];
          close((+e.rx / scale) ** 2, level);
          close(kappa * (+e.ry / scale) ** 2, level);
        });
        close(+arrows[0].x2 - +arrows[0].x1, scale);
        close(+arrows[0].y1 - +arrows[0].y2, 0.4 * kappa * scale);
        close(+arrows[1].x2 - +arrows[1].x1, 0.5 * scale);
        close(+arrows[1].y1 - +arrows[1].y2, 0.2 * scale);
      },
    );
}
const result = {
  scope:
    "Actual SVG element relations for selected frozen figures; first-version failures are expected controls, not artistic acceptance",
  browserVersion: browser.version(),
  checkerSha256: sha(fs.readFileSync(new URL(import.meta.url))),
  records,
  expectedFailures: records.filter((r) => !r.expectedPass).length,
  unexpected: records.filter((r) => r.pass !== r.expectedPass),
};
const dest = path.join(evidence, "relations");
fs.mkdirSync(dest, { recursive: true });
const file = path.join(dest, process.argv[2] ?? "final-v2.json");
if (fs.existsSync(file)) throw Error("Use a new evidence filename");
fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    checks: records.length,
    expectedFailures: result.expectedFailures,
    unexpected: result.unexpected,
  }),
);
await browser.close();
process.exitCode = result.unexpected.length ? 1 : 0;
