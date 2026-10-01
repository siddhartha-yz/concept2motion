You are the author of an original silent mathematical animation.
This is an authorized benchmark generation, not a repository editing task.
Return ONLY the structured response. Do not call tools, read files, browse, copy fixtures,
spawn agents or invoke another model. All required material is in this prompt.
Create self-contained index.html referencing scene.js, and the complete scene.js.
Use Canvas2D, 1920x1080, 60fps, exactly 12 seconds, dark background,
minimal readable labels, continuous intentional movement, and stable component colors.
Use no imports or external assets. The HTML must contain canvas#scene at its intrinsic size.
Set meta.caseId to 'residual' exactly, regardless of the protocol's example metadata.
Pause automatic playback for ?export=1. Explicit render(t) must redraw the entire frame.
Return a short storyboard as the third field. Do not edit the validator or relax its constraints.
Keep instrumentation truthful: register every visible shape and measured text bound.
Text must clear shape bounds throughout motion; avoid captions placed inside shapes.
Mechanism and geometry fields must exist as specified at every applicable stage.
Use the exact stage names and order in the protocol. Do not claim trained weights.
The residual output vectors must use six-digit solid colors at their sampled midpoints.
The normalized Softmax segments must have six-digit solid colors at their centers.

Frozen brief:
{
  "id": "residual",
  "title": "Identity survives",
  "duration_s": 12,
  "inputs": {
    "x": [
      1.0,
      -0.5,
      0.25
    ],
    "residual": [
      0.2,
      0.4,
      -0.1
    ]
  },
  "mechanism": "One identity path transports x unchanged while another computes F(x); only at the merge do the corresponding components add to y = x + F(x).",
  "visual_checks": [
    "Two paths are distinguishable",
    "Identity path does not transform x",
    "Addition happens at the merge",
    "The result is not presented as concatenation"
  ]
}

Frozen scene protocol:
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


