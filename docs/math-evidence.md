# Draw and record mathematical evidence

`runtime/math-frame.mjs` is a small Canvas2D adapter for the existing three-component
Softmax and residual contracts. It draws primitives and records their measured
evidence together. The author still chooses composition, stage, timing, colors,
explanation and the semantic role of each object. It does not generate a lesson.

Copy the module into the candidate's local source directory, so the render snapshot
includes the exact adapter version. Import it from that frozen local file:

```js
import { createMathFrame } from './math-frame.mjs';
// Called afresh inside window.C2M.render(t).
const f = createMathFrame(canvas, {
  caseId: 'softmax', time: t, stage: 'exponential',
  inputs: { logits: [-0.8, 0.4, 1.2] }
});
const colors = ['#57c7ef', '#af87ff', '#ffb65b'];
[-0.8, 0.4, 1.2].forEach((z, i) => {
  f.text(`label-${i}`, `exp(${z})`, 140, 110 + i * 80, { color: colors[i] });
  f.massBar(i, { x: 140, y: 130 + i * 80,
    width: 60 * Math.exp(z), height: 18, color: colors[i] });
});
return f.finish();
```

This is a frame/API example, not a complete candidate or a model-generated animation.
`createMathFrame` clears the canvas and resets common drawing state on each call.
It computes numerical evidence from the supplied inputs; the separate validator
recomputes the reference from the saved brief, so passing the wrong inputs still fails.
Raw exponentials must be positive and finite, and their directly normalized
probabilities must agree with an independently shifted calculation within 1e-9.
Extreme underflow can leave a positive total yet distort ratios; the adapter
rejects that domain explicitly rather than returning plausible wrong probabilities.
The raw-mass contract is not silently replaced by a shifted-mass mechanism.

| Method | Draws and records |
|---|---|
| `values` | Frozen target logits/masses/denominator/probabilities or input/identity/correction/output computed from inputs |
| `text(id, text, x, y, {size, color, align, opacity, font})` | Text and measured font bounds; alphabetic baseline; returns a frozen measured rectangle |
| `massBar(index, {x,y,width,height,color,opacity,reveal})` | Rectangle and `geometry.massBars`, fixed IDs `mass-0..2`; returns a frozen actual rectangle; with reveal, width is the complete target width |
| `partition({x,y,width,height,opacity}, [{probability,color}, …])` | Three contiguous probability rectangles and capacity/segments |
| `vector(role,index,{start,value,unitScale,color,strokeWidth,opacity,reveal})` | Signed horizontal arrow and endpoint evidence; roles identity/correction/output; value is the complete target value |
| `layer(opacity, draw)` | Multiplies effective opacity for primitive calls inside the callback and restores it afterward |
| `finish()` | Detached snapshot of time, stage, mechanism, geometry and bounds |

Use one positive `unitScale` for all residual components. The returned `vector`
contains a detached `end` point; use an identity endpoint as the matching correction's
start. Output vectors can occupy a separate vertical lane. The validator checks
the supplied values, signed displacements and final sum independently. A zero
target is drawn as a dot, so a correct zero component remains visible.

Text and mathematical shapes have separate ID namespaces. A label `class-0`
can coexist with the partition segment `class-0`; two text calls with the same
ID in one frame still fail. Bounds record `id` as `text:class-0` or
`shape:class-0`, and `sourceId` preserves the caller's ID. Geometry retains
its required mathematical IDs. A failed render reports the offending kind/ID.

Use measured text rectangles to place a following label or shape with an actual
gap. Neither measurement nor `layer` performs layout. A layer callback runs even
at opacity zero; draw each instance once per frame and use distinct text IDs.

The adapter records what was actually requested through these primitives. It does
not ensure that the author chose mathematically correct widths or semantic roles:
the independent checker does that. Empty required arrays remain empty when objects
were not drawn. Duplicate IDs fail. Drawing directly with `ctx` bypasses automatic
registration; later overpainting can invalidate the evidence, so sampled pixel
checks remain necessary. Sparse pixel probes do not prove all visible geometry,
readable motion, clear explanation or artistic quality.

## Partial geometry and settled phases

Copy `runtime/math-timeline.mjs` alongside the frame adapter. The author chooses
every interval and caption. `createMathTimeline({caseId,duration,entries})`
requires contiguous intervals covering the duration, the required stage order,
and at least 0.75 seconds between each `settledAt` and its `end`. Save
`stageTimeline: timeline.meta` in `window.C2M.meta`.

```js
const phase = timeline.at(t);
const f = createMathFrame(canvas, {
  caseId: 'residual', time: t, stage: phase.stage,
  inputs: {x: [.7, -.4, .2], residual: [-.2, .15, -.3]}
});
const a = f.vector('identity', 0, {
  start: {x: 220, y: 150}, value: f.values.input[0],
  unitScale: 180, color: '#57c7ef', reveal: timeline.reveal('input', t)
});
// Use the identity's complete endpoint for the correction's fixed origin.
f.vector('correction', 0, {
  start: a.targetEnd, value: f.values.correction[0], unitScale: 180,
  color: '#ffb65b', reveal: timeline.reveal('branches', t)
});
return f.finish();
```

This excerpt demonstrates two primitive calls, not a complete valid lesson.
The full candidate must draw all required components and outputs. Explicit
`reveal` is in 0..1. Actual vector displacement equals target value × scale ×
reveal; actual bar width equals target width × reveal. Keep the full target in
`value`/`width`, rather than multiplying it before passing it to the helper.
Without explicit reveal, the supplied value is treated as actual complete geometry.

`timeline.reveal(stage,t)` smoothly reaches one by that stage's `settledAt`.
`timeline.opacity(stage,t,{fade:.2,persist:false})` fades a stage layer, with a
positive fade no longer than .25 seconds. Final-stage opacity remains one at
the exact endpoint. Use `f.layer(...)` for captions that must disappear when
their phase ends; keep the mechanism's component identities consistent.

The validator independently checks timeline metadata, full target mathematics,
actual partial geometry and completion/visibility in settled phases. It does not
import the timeline utility. A correct target during a reveal is recorded as
`target_only`, not a verified full exponential-width ratio. Wrong targets,
unfinished final geometry and invisible required objects remain failures.

Pixel probes on transparent or subpixel geometry cannot use an opaque pure-color
reference. Each frame records `pixelCoverage` with potential/sampled/unavailable
counts and skip reasons. Unavailable probes never count as verified. Stable,
opaque geometry continues to receive pixel checks; all exported frame times
receive numerical/geometry checks. These remain sparse probes, not image-wide proof.

The [explicit reveal controls](../evaluation/2026-10-03/progress-controls-v2/REPORT.md)
export and fully decode 16 hand-authored clips, including wrong targets, forged
partial geometry, incomplete reveals, hidden objects, overpainting and caption
overlap. Version 1's subpixel false positive is preserved separately. These
controls validate engineering behavior, not AI generation or artistic quality.

The narrow overlap contract still flags text inside registered shapes; no new
layout policy or artistic acceptance is introduced here. The generic animation
runtime and its timing API remain documented in [runtime/API.md](../runtime/API.md).

The [controlled regression](../evaluation/2026-10-03/render-evidence-v2/REPORT.md)
includes real renders of correct Softmax/residual fixtures, an affine-width error
and a deliberate pixel overwrite. All four fixtures are hand-authored controls,
with zero model calls. To repeat them into a fresh directory:

```bash
python3 tools/replay_math_frame.py --out runs/math-frame-controls-01
```

The harness refuses an existing output directory and an adapter that differs from
the frozen fixture version. It saves inputs, source snapshots/hashes, tooling,
checks, frames, full video/decode validation and technical results. Environment
overrides for the renderer are described in [scene-protocol.md](scene-protocol.md).
