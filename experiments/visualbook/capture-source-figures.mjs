import fs from "node:fs";
import path from "node:path";
import { root, output, sha } from "./prepare.mjs";
import { launchBrowser } from "./browser.mjs";
const section = process.argv[2],
  dest = path.join(root, "work/visualbook/source-snapshots", section, "frames");
fs.mkdirSync(dest, { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
await page.goto(`file://${output}/${section}.html`);
await page.evaluate(() => document.fonts.ready);
const images = page.locator(".source-block img"),
  count = await images.count(),
  records = [];
for (let i = 0; i < count; i++) {
  const img = images.nth(i);
  await img.scrollIntoViewIfNeeded();
  await img.evaluate(
    (n) =>
      new Promise((resolve, reject) => {
        if (n.complete)
          return n.naturalWidth
            ? resolve()
            : reject(Error("Source image failed"));
        n.onload = resolve;
        n.onerror = () => reject(Error("Source image failed"));
      }),
  );
  const file = path.join(dest, `${i + 1}.png`);
  await img.screenshot({ path: file });
  records.push({
    image: i + 1,
    file: path.relative(root, file),
    sha256: sha(fs.readFileSync(file)),
    alt: await img.getAttribute("alt"),
    width: await img.evaluate((n) => n.naturalWidth),
    height: await img.evaluate((n) => n.naturalHeight),
  });
}
fs.writeFileSync(
  path.join(dest, "manifest.json"),
  JSON.stringify(records, null, 2) + "\n",
);
console.log(JSON.stringify(records));
await browser.close();
