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

For a controlled evaluation, `--render-invalid` permits a full diagnostic video when
the scene executes but contract findings exist. The result still has exit code 1,
`checks_failed`, and the original findings. This keeps visibly incorrect candidates
available for blind comparison. Missing inspection fields or invalid pixel-probe
coordinates become findings; they no longer abort image capture. A missing/null
evidence return also remains a failed check. Actual JavaScript drawing exceptions
and canvas/metadata mismatch still prevent export. The option cannot be combined
with preview/checks-only.

## Drawing and evidence together

For these two contracts, [the math-frame adapter](math-evidence.md) records bounds,
bar widths and signed vector endpoints from the same calls that draw them. It
reduces manually maintained registry fields without supplying a storyboard.

During Softmax's `exponential` stage, return three `geometry.massBars` with IDs
`mass-0..2`, coordinates, widths, heights, colors and opacity. The validator checks
that opaque, nonzero bar widths share the same proportions as exponential masses.
It samples their actual center colors as well. For legacy scenes, only shape bounds
with those exact IDs are accepted as ratio evidence; their colors are not probed.
Absent identifiable bars are reported as **unavailable**, never as verified ratios.
Fading or zero-total-width bars are **transient**. `checks.mass_geometry.states`
records checked/unavailable/invalid/transient counts across inspection samples.
These are partial checks, not a proof of every rendered frame or pixel.

New candidates may register `meta.stageTimeline = {version:1,caseId,duration,entries}`.
Each ordered entry contains `{stage,start,end,settledAt}`. Intervals cover the entire
duration contiguously, and each phase holds settled geometry for at least .75 seconds.
The validator derives the current phase from time independently; changing only a
reported stage cannot authorize unfinished geometry. Explicit vector/bar reveals
require this metadata. Timeline-free historical evidence remains supported.

For an explicit vector reveal, additionally record `reveal`, `targetValue` and
`targetEnd`; actual endpoints must encode `targetValue * unitScale * reveal`.
For a bar reveal, record `reveal` and `targetWidth`; actual width must equal their
product. Full targets are checked against the brief even during transitions.
Required roles must finish and remain visible in the relevant settled hold; final
residual joins and probability partitions remain independently checked.
`mass_geometry.states.target_only` identifies target-checked partial geometry and
does not count as a verified actual full ratio.

Each captured frame also records `pixelCoverage` potential/sampled/unavailable
counts and concrete skip reasons. Pure-color probes are unavailable for transparent
or subpixel primitives; their target/geometry checks still run. Available opaque
geometry continues to be probed. Sample and full-export coverage are reported
separately. Sparse probes never establish image-wide fidelity or artistic clarity.
The [API](math-evidence.md) explains measured text, separate ID namespaces,
phase opacity layers and explicit reveal calls; the [16 real controls](../evaluation/2026-10-03/progress-controls-v2/REPORT.md)
include both expected successes and expected failures.

The [renderer regression report](../evaluation/2026-10-03/render-evidence-v2/REPORT.md)
preserves all 16 old final candidates unchanged: exports increased from 9 to 16,
with 4 technical passes unchanged. New exports do not replace historical failures
or change the original blind comparison.

## Record a review

Write a review JSON with `kind` (`visual` / `technical`), `decision` (`revise` / `pass`), `reviewer`, `observations` (each with `time_s`, relative `evidence` filename, `description`), and a concrete `revision_instruction` when requesting changes. Include whether the reviewer is independent of the author. AI review leaves `artistic_acceptance` as `pending_user_review`.

```bash
python tools/review_run.py --run runs/softmax/attempt-01 \
  --review work/review-01.json --ledger runs/softmax/ledger.json
```

This checks evidence and frozen source integrity, saves the review and reports whether another revision is allowed. Two technical and two visual revision requests are permitted; a further request stops the ledger. A passing review stops it as well. This is a sequential local workflow; the ledger does not launch another model or schedule background work. Continue in the current authorized Codex session or use the official CLI as the author. No additional agent is spawned by these tools.

The [Softmax loop report](../evaluation/2026-10-01/softmax-loop/REPORT.md) demonstrates a failed candidate, one targeted visual revision, a verified full render and a fresh-browser repeat. The [residual loop report](../evaluation/2026-10-01/residual-loop/REPORT.md) records a visual defect missed by the first validator, one caption revision, the added shape/text check, and an intentional pixel-corruption regression.
