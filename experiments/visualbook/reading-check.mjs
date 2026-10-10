// Scripted real-browser reading controls, explicitly not human learning evidence.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { root, output, dependencies, evidence, sha } from "./prepare.mjs";
import { launchBrowser } from "./browser.mjs";
const browser = await launchBrowser();
const runId = process.argv[2] ?? "final-v2";
const raw = path.join(evidence, "raw/reading", runId);
if (fs.existsSync(raw)) throw Error("Refuse to overwrite reading evidence");
fs.mkdirSync(raw, { recursive: true });
const records = [],
  errors = [],
  network = [];
const active = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "active.json")),
);
async function record(label, fn) {
  try {
    const detail = await fn();
    records.push({ label, pass: true, detail });
  } catch (e) {
    records.push({ label, pass: false, error: String(e) });
  }
}
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("request", (r) => {
  if (/^https?:/.test(r.url())) network.push(r.url());
});
async function settle() {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function clickHeaderButton(selector) {
  // Locator.click may scroll a sticky element to its normal-flow position
  // before clicking. A reader clicks its visible screen coordinates.
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 900);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function reach(anchor) {
  await page
    .locator("#" + anchor)
    .evaluate((el) =>
      scrollBy(
        0,
        el.getBoundingClientRect().top - Math.min(innerHeight * 0.48, 380) + 2,
      ),
    );
  await settle();
}
for (const section of Object.keys(active)) {
  await page.goto(`file://${output}/${section}.html`);
  await page.waitForFunction(() => !!window.visualbook);
  await settle();
  const figures = await page.evaluate(() =>
    window.visualbook.controllers.map((c) => ({
      id: c.f.id,
      states: c.f.states,
      controls: c.f.controls,
    })),
  );
  for (const f of figures) {
    for (const state of f.states)
      await record(`${section}/${f.id}/forward/${state.key}`, async () => {
        await reach(state.anchor);
        const actual = await page.evaluate(
          (id) =>
            window.visualbook.controllers.find((c) => c.f.id === id).state,
          f.id,
        );
        assert.equal(actual, state.key);
        return { state: actual };
      });
    await record(`${section}/${f.id}/backward`, async () => {
      await reach(f.states[0].anchor);
      assert.equal(
        await page.evaluate(
          (id) =>
            window.visualbook.controllers.find((c) => c.f.id === id).state,
          f.id,
        ),
        f.states[0].key,
      );
    });
    await record(`${section}/${f.id}/stable-height`, async () => {
      const heights = await page.evaluate((id) => {
        const c = window.visualbook.controllers.find((c) => c.f.id === id),
          r = [];
        for (const s of c.f.states) {
          for (const p of [
            Object.fromEntries(c.f.controls.map((x) => [x.key, x.value])),
            ...c.f.controls.flatMap((x) =>
              [x.min, x.max].map((v) => ({ ...c.params, [x.key]: v })),
            ),
          ]) {
            Object.assign(c.params, p);
            c.setState(s.key, true);
            r.push(
              c.el.querySelector(".graphic").getBoundingClientRect().height,
            );
          }
        }
        c.resume();
        return r;
      }, f.id);
      assert.ok(Math.max(...heights) - Math.min(...heights) < 1);
      return { min: Math.min(...heights), max: Math.max(...heights) };
    });
    if (f.states.length > 1)
      await record(`${section}/${f.id}/manual-pause-and-reset`, async () => {
        const figure = page.locator("#figure-" + f.id);
        await figure.locator("details").evaluate((el) => (el.open = true));
        await figure.locator('[data-state="' + f.states[0].key + '"]').click();
        await reach(f.states.at(-1).anchor);
        assert.equal(
          await page.evaluate(
            (id) =>
              window.visualbook.controllers.find((c) => c.f.id === id).state,
            f.id,
          ),
          f.states[0].key,
        );
        await figure.locator(".reset").click();
        await reach(f.states.at(-1).anchor);
        assert.equal(
          await page.evaluate(
            (id) =>
              window.visualbook.controllers.find((c) => c.f.id === id).state,
            f.id,
          ),
          f.states.at(-1).key,
        );
        await figure.locator("details").evaluate((el) => (el.open = false));
      });
    if (f.controls.length)
      await record(`${section}/${f.id}/keyboard-parameter`, async () => {
        const figure = page.locator("#figure-" + f.id);
        await figure.locator("details").evaluate((el) => (el.open = true));
        const input = figure.locator(
          '[data-param="' + f.controls[0].key + '"]',
        );
        await input.focus();
        await input.press("Home");
        await input.press("ArrowRight");
        const value = await input.inputValue();
        assert.equal(+value, f.controls[0].min + f.controls[0].step);
        assert.equal(
          await page.evaluate(
            (id) =>
              window.visualbook.controllers.find((c) => c.f.id === id).manual,
            f.id,
          ),
          true,
        );
        await figure.locator(".reset").click();
        await figure.locator("details").evaluate((el) => (el.open = false));
        return { value: +value };
      });
  }
  await record(`${section}/original-toggle-keeps-paragraph`, async () => {
    const f = figures[0],
      anchor = f.states.at(-1).anchor;
    await reach(anchor);
    const before = await page
      .locator("#" + anchor)
      .evaluate((n) => n.getBoundingClientRect().top);
    await clickHeaderButton("#original");
    await settle();
    assert.equal(await page.locator(".visual:visible").count(), 0);
    const after = await page
      .locator("#" + anchor)
      .evaluate((n) => n.getBoundingClientRect().top);
    assert.ok(Math.abs(before - after) < 3, `${before} -> ${after}`);
    await clickHeaderButton("#original");
    return { pixelShift: after - before };
  });
}
await page.goto(`file://${output}/iteration.html`);
await page.waitForFunction(() => !!window.visualbook);
await record("global-pause/keeps-exploration", async () => {
  const figure = page.locator("#figure-sgd-gradient-mean");
  await figure.locator("details").evaluate((el) => (el.open = true));
  const slider = figure.locator('[data-param="sample"]');
  await slider.focus();
  await slider.press("End");
  await clickHeaderButton("#follow");
  assert.equal(await slider.inputValue(), "4");
  await clickHeaderButton("#follow");
  assert.equal(await slider.inputValue(), "1");
  await figure.locator("details").evaluate((el) => (el.open = false));
});
await record("feedback/export-and-version-bound-capsule", async () => {
  const figure = page.locator(".visual").first();
  await figure.locator("details").evaluate((el) => (el.open = true));
  await figure.locator(".report-figure").click();
  await page
    .locator("#feedback-note")
    .fill("[Engineering smoke, not a human review] 请检查这个参数标签。");
  const download = page.waitForEvent("download");
  await page.locator("#feedback-download").click();
  const noteFile = path.join(raw, "exported-note.json");
  await (await download).saveAs(noteFile);
  const note = JSON.parse(fs.readFileSync(noteFile));
  note.kind = "engineering smoke; not human feedback";
  fs.writeFileSync(noteFile, JSON.stringify(note, null, 2));
  const capsule = path.join(raw, "capsule.json");
  execFileSync(
    "python3",
    [path.join(import.meta.dirname, "feedback.py"), noteFile, capsule],
    { cwd: root },
  );
  assert.equal(JSON.parse(fs.readFileSync(capsule)).targetFigure, note.figure);
  const staleFile = path.join(raw, "stale-note.json");
  fs.writeFileSync(
    staleFile,
    JSON.stringify({ ...note, candidateSha256: "0".repeat(64) }),
  );
  let rejected = false;
  try {
    execFileSync(
      "python3",
      [
        path.join(import.meta.dirname, "feedback.py"),
        staleFile,
        path.join(raw, "stale-capsule.json"),
      ],
      { cwd: root, stdio: "pipe" },
    );
  } catch {
    rejected = true;
  }
  assert.ok(rejected && !fs.existsSync(path.join(raw, "stale-capsule.json")));
  return {
    exportedSha256: sha(fs.readFileSync(noteFile)),
    staleRejected: rejected,
    modelCalls: 0,
  };
});
await record("runtime-failure/static-fallback", async () => {
  const html = fs
    .readFileSync(path.join(output, "iteration.html"), "utf8")
    .replace(
      "startVisualbook(data);",
      'data.renderers[data.figures[0].id]=()=>{throw Error("Injected renderer failure")};startVisualbook(data);',
    );
  const injected = path.join(raw, "failure-injected.html");
  fs.writeFileSync(injected, html);
  await page.goto("file://" + injected);
  await page.waitForFunction(() => !!window.visualbook);
  assert.equal(
    await page.locator(".graphic.failed .fallback img:visible").count(),
    1,
  );
  assert.equal(await page.locator("[data-source-sha256]").count(), 68);
  return { explicitlyInjected: true };
});
for (const section of Object.keys(active))
  await record(`${section}/no-js-print-reduced-motion`, async () => {
    const nojs = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 375, height: 812 },
      }),
      p = await nojs.newPage();
    await p.goto(`file://${output}/${section}.html`);
    const candidate = JSON.parse(
      fs.readFileSync(
        path.join(
          import.meta.dirname,
          "candidates",
          section,
          active[section],
          "response.json",
        ),
      ),
    );
    const expected = candidate.figures.reduce((n, f) => n + f.states.length, 0);
    assert.equal(await p.locator(".visual img:visible").count(), expected);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "No-JS mobile page overflows",
    );
    await p.setViewportSize({ width: 360, height: 640 });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Short no-JS mobile page overflows",
    );
    await nojs.close();
    const reduced = await browser.newContext({ reducedMotion: "reduce" }),
      q = await reduced.newPage();
    await q.goto(`file://${output}/${section}.html`);
    await q.waitForFunction(() => !!window.visualbook);
    assert.ok(
      await q
        .locator(".visual")
        .evaluateAll((nodes) =>
          nodes.every((n) => getComputedStyle(n).position === "relative"),
        ),
    );
    await q.emulateMedia({ media: "print" });
    assert.equal(await q.locator(".visual img:visible").count(), expected);
    assert.equal(await q.locator(".fig-controls:visible").count(), 0);
    await reduced.close();
    return { staticStates: expected };
  });
const result = {
  scope:
    "Scripted actual Chromium controls and explicitly injected fallback; no human review or learning claim",
  browserVersion: browser.version(),
  checkerSha256: sha(fs.readFileSync(new URL(import.meta.url))),
  records,
  errors,
  externalRequests: network,
  passed: records.filter((r) => r.pass).length,
  total: records.length,
};
fs.writeFileSync(
  path.join(raw, "result.json"),
  JSON.stringify(result, null, 2) + "\n",
);
fs.mkdirSync(path.join(evidence, "reading"), { recursive: true });
fs.writeFileSync(
  path.join(evidence, "reading", runId + ".json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: result.passed,
    total: result.total,
    errors,
    externalRequests: network,
    failures: records.filter((r) => !r.pass),
  }),
);
await context.close();
await browser.close();
process.exitCode =
  result.passed !== result.total || errors.length || network.length ? 1 : 0;
