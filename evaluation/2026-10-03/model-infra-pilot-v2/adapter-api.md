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
Raw exponentials must be in the supported finite range.

| Method | Draws and records |
|---|---|
| `text(id, text, x, y, {size, color, align, opacity, font})` | Text and measured font bounds; alphabetic baseline |
| `massBar(index, {x,y,width,height,color,opacity})` | Actual rectangle and `geometry.massBars`, fixed IDs `mass-0..2` |
| `partition({x,y,width,height}, [{probability,color}, …])` | Three contiguous probability rectangles and capacity/segments |
| `vector(role,index,{start,value,unitScale,color,strokeWidth})` | Signed horizontal arrow and endpoint evidence; roles identity/correction/output |
| `finish()` | Detached snapshot of time, stage, mechanism, geometry and bounds |

Use one positive `unitScale` for all residual components. The returned `vector`
contains a detached `end` point; use an identity endpoint as the matching correction's
start. Output vectors can occupy a separate vertical lane. The validator checks
the supplied values, signed displacements and final sum independently.

The adapter records what was actually requested through these primitives. It does
not ensure that the author chose mathematically correct widths or semantic roles:
the independent checker does that. Empty required arrays remain empty when objects
were not drawn. Duplicate IDs fail. Drawing directly with `ctx` bypasses automatic
registration; later overpainting can invalidate the evidence, so sampled pixel
checks remain necessary. Sparse pixel probes do not prove all visible geometry,
readable motion, clear explanation or artistic quality.

The narrow overlap contract still flags text inside registered shapes; no new
layout policy or artistic acceptance is introduced here. The generic animation
runtime and its timing API remain documented in [runtime/API.md](../runtime/API.md).

