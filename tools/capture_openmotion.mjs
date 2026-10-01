/** Sample generated HTML at deterministic timestamps and probe upstream recorder timing.
 * Run after evaluate_openmotion.mjs. Does not test the blocked full export service.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: {
  upstream: { type: 'string' }, out: { type: 'string' }, chrome: { type: 'string' }
}});
if (!values.upstream || !values.out || !values.chrome) {
  throw new Error('--upstream, --out and --chrome are required');
}
const upstream = resolve(values.upstream), out = resolve(values.out);
const { register } = await import(pathToFileURL(join(upstream, 'node_modules/tsx/dist/esm/api/index.mjs')));
register();
const puppeteer = (await import(pathToFileURL(join(upstream, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')))).default;
const html = readFileSync(join(out, 'original.html'));
const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const errors = [];
try {
  const browser = await puppeteer.launch({ executablePath: values.chrome, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--ozone-platform=headless'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 854, height: 480, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle0' });
    const states = [];
    for (const time of [0.8, 4.5, 7.5, 11.5]) {
      const boxes = await page.evaluate(ms => {
        document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; });
        return [...document.querySelectorAll('[data-om-name]')].map(el => {
          const b = el.getBoundingClientRect();
          return { name: el.getAttribute('data-om-name'), x: b.x, y: b.y, width: b.width, height: b.height };
        });
      }, time * 1000);
      await page.screenshot({ path: join(out, `frame-${time}.png`) });
      states.push({ time_s: time, boxes });
    }
    writeFileSync(join(out, 'sampled-states.json'), JSON.stringify({ errors, states }, null, 2));
  } finally { await browser.close(); }

  process.env.CHROME_PATH = values.chrome;
  const { recordFrames } = await import(pathToFileURL(join(upstream, 'open-motion/src/export/recorder.ts')));
  const result = { intended_duration_s: 12, requested_fps: 30, scope: 'recorder module only' };
  try {
    const start = performance.now();
    const framesDir = join(out, 'native-frames');
    mkdirSync(framesDir, { recursive: true });
    const frames = await recordFrames({ previewUrl: url, width: 854, height: 480, fps: 30,
      durationMs: 12000, framesDir });
    Object.assign(result, { success: true, captured_frames: frames.length,
      capture_wall_seconds: (performance.now() - start) / 1000,
      encoded_duration_at_requested_fps_s: frames.length / 30 });
  } catch (error) { Object.assign(result, { success: false, error: String(error) }); }
  writeFileSync(join(out, 'capture-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { server.close(); }
