// Save source-and-figure viewports for maintainers; screenshots are not scores.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dependencies, output, evidence, sha } from "./prepare.mjs";
const { chromium } = await import(
  pathToFileURL(
    path.join(dependencies, "node_modules/playwright-core/index.mjs"),
  )
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ??
    "/home/yang-zhi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
});
const raw = path.join(
  evidence,
  "raw/reading-frames",
  process.argv[2] ?? "final",
);
if (fs.existsSync(raw)) throw Error("Use a new capture id");
fs.mkdirSync(raw, { recursive: true });
const active = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "active.json")),
  ),
  records = [];
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
]) {
  const page = await browser.newPage({ viewport });
  for (const [section, attempt] of Object.entries(active)) {
    await page.goto(`file://${output}/${section}.html`);
    await page.waitForFunction(() => !!window.visualbook);
    await page.evaluate(() => document.fonts.ready);
    const figures = JSON.parse(
      fs.readFileSync(
        path.join(
          import.meta.dirname,
          "candidates",
          section,
          attempt,
          "response.json",
        ),
      ),
    ).figures;
    for (const f of figures) {
      await page
        .locator("#" + f.afterAnchor)
        .evaluate((el) => scrollBy(0, el.getBoundingClientRect().top - 110));
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      const name = `${viewport.width}-${section}-${f.id}.png`,
        file = path.join(raw, name);
      await page.screenshot({ path: file });
      records.push({
        section,
        attempt,
        figure: f.id,
        viewport,
        name,
        screenshotSha256: sha(fs.readFileSync(file)),
        htmlSha256: sha(fs.readFileSync(path.join(output, section + ".html"))),
      });
    }
  }
  await page.close();
}
fs.writeFileSync(
  path.join(raw, "manifest.json"),
  JSON.stringify(records, null, 2) + "\n",
);
console.log(JSON.stringify({ viewports: records.length, raw }));
await browser.close();
