# Local scene protocol · version 1

An HTML candidate exposes `window.C2M` with:

```js
{
  meta: { version: 1, caseId: 'softmax', renderer: 'canvas2d',
          width: 1920, height: 1080, duration: 12, fps: 60 },
  render(timeInSeconds) { /* draw one complete frame, return evidence */ }
}
```

The canvas has ID `scene`. Its intrinsic size matches metadata. With `?export=1`, automatic playback is paused. Frame rendering must use its explicit time; no wall clock, unseeded random numbers or accumulated animation state. Draw the entire frame on each call.

`render(t)` returns time, stage, numerical mechanism data, and bounds measured while drawing. Every active text or shape has `{id, kind, x, y, width, height, opacity}`. Draw text using measured font bounds. In the normalized Softmax stage, also return `geometry.capacity` and three `geometry.segments` with stable IDs `class-0..2`, coordinates and six-digit hex colors. Mechanism fields are `logits`, positive raw `masses`, shared `denominator`, and `probabilities`.

The independent validator recomputes reference probabilities from the saved brief. It checks numbers, partition widths, gaps, total capacity, text overlap, shape/text collisions and clipping. The renderer also samples actual canvas pixels at segment centers. Required stages must occur in order across sampled frames. Bounds checks use an opacity threshold of 0.2 and a two-pixel overlap tolerance. Intended text inside a shape is not supported by this narrow layout contract.

The evidence registry is supplied by the candidate; this is useful instrumentation, not an adversarial proof of every pixel or of semantic understanding. Visual review remains necessary. A deliberate regression fixture overwrites the residual output pixels while keeping all numerical and geometric evidence correct; the renderer rejects it with `pixel_mismatch`.

## Residual evidence

For `caseId: 'residual'`, return `mechanism: {input, identity, correction, output}`. The independent reference uses the brief's `x` and `residual`, checks `identity = x`, and recomputes `output = x + residual` componentwise. The illustrative correction is not a learned network.

Return `geometry.unitScale`, a positive shared pixels-per-unit scale, and signed horizontal vectors with `{id, start: {x, y}, end: {x, y}, color}`. `identity` exists throughout; `correction` is required after the input stage; `output` is required in the final stage. Stable IDs are `identity-i`, `correction-i`, `output-i`. Each signed displacement must equal its value times the shared scale. At the final merge, each correction starts at its identity endpoint, and the output's horizontal endpoints span their signed sum. The output may use a separate vertical lane for readability. Actual canvas colors are sampled at its vector midpoints in the output stage.

The required stage sequences are Softmax: `logits → exponential → shared-total → normalizing → normalized`; residual: `input → branches → merging → output`.

The rendered-evidence validator supports **Softmax and residual addition**. Unsupported case IDs fail explicitly. GRU has a numerical brief but its scene protocol and render validator are still pending.

## Run a candidate

```bash
npm ci
npx playwright install chromium
node tools/render_scene.mjs \
  --scene benchmarks/scenes/softmax/index.html \
  --out runs/softmax/attempt-01 \
  --author 'Codex desktop session'

node tools/render_scene.mjs \
  --scene benchmarks/scenes/residual/index.html \
  --out runs/residual/attempt-01 \
  --author 'Codex desktop session'
```

FFmpeg and ffprobe must be on PATH. Use `--checks-only` to capture evidence without encoding. `--brief` accepts a saved case object. Every output directory must be new: attempts are never overwritten. A run snapshots local source and serves the frozen copy on localhost. External asset requests are blocked.

Optional environment settings: `C2M_NODE_MODULES` selects an existing directory containing Playwright; `C2M_CHROMIUM` selects a browser executable; `C2M_FFMPEG` and `C2M_FFPROBE` select media tools. Use trusted locally installed tooling. The run records Playwright, Chromium, FFmpeg versions, source hashes, checks, keyframes, encoded video metadata and a decode check. New runs also preserve renderer/validator source and hashes under `tooling/`; historical passes remain tied to their original check scope.

Every exported frame uses `t = frame_index / fps`. FFmpeg receives exactly `duration * fps` frames. ffprobe must confirm count, rate, dimensions and duration. A repeated-time capture after an intervening frame checks history independence on this runtime.

## Record a review

Write a review JSON with `kind` (`visual` / `technical`), `decision` (`revise` / `pass`), `reviewer`, `observations` (each with `time_s`, relative `evidence` filename, `description`), and a concrete `revision_instruction` when requesting changes. Include whether the reviewer is independent of the author. AI review leaves `artistic_acceptance` as `pending_user_review`.

```bash
python tools/review_run.py --run runs/softmax/attempt-01 \
  --review work/review-01.json --ledger runs/softmax/ledger.json
```

This checks evidence and frozen source integrity, saves the review and reports whether another revision is allowed. Two technical and two visual revision requests are permitted; a further request stops the ledger. A passing review stops it as well. This is a sequential local workflow; the ledger does not launch another model or schedule background work. Continue in the current authorized Codex session or use the official CLI as the author. No additional agent is spawned by these tools.

The [Softmax loop report](../evaluation/2026-10-01/softmax-loop/REPORT.md) demonstrates a failed candidate, one targeted visual revision, a verified full render and a fresh-browser repeat. The [residual loop report](../evaluation/2026-10-01/residual-loop/REPORT.md) records a visual defect missed by the first validator, one caption revision, the added shape/text check, and an intentional pixel-corruption regression.
