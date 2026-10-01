You are the author of an original silent mathematical animation.
This is an authorized benchmark generation, not a repository editing task.
Return ONLY the structured response. Do not call tools, read files, browse, copy fixtures,
spawn agents or invoke another model. All required material is in this prompt.
Create self-contained index.html referencing scene.js, and the complete scene.js.
Use Canvas2D, 1920x1080, 60fps, exactly 32 seconds, dark background,
minimal readable labels, continuous intentional movement, and stable component colors.
Use no imports or external assets. The HTML must contain canvas#scene at its intrinsic size.
Set meta.caseId to 'softmax' exactly, regardless of the protocol's example metadata.
Pause automatic playback for ?export=1. Explicit render(t) must redraw the entire frame.
Return a short storyboard as the third field. Do not edit the validator or relax its constraints.
Keep instrumentation truthful: register every visible shape and measured text bound.
Text must clear shape bounds throughout motion; avoid captions placed inside shapes.
Mechanism and geometry fields must exist as specified at every applicable stage.
Use the exact stage names and order in the protocol. Do not claim trained weights.
The residual output vectors must use six-digit solid colors at their sampled midpoints.
The normalized Softmax segments must have six-digit solid colors at their centers.
This is a Chinese explanation for a newcomer. Follow the saved teaching plan. Each visual action must support its caption and a viewer inference. Establish what the objects mean and the problem before introducing notation. Keep the concluding answer readable. Decorative motion cannot stand in for an explanation.

Frozen brief:
{
  "id": "softmax",
  "title": "\u5206\u6570\u600e\u6837\u53d8\u6210\u6982\u7387\uff1f",
  "duration_s": 32,
  "inputs": {
    "logits": [
      -1.0,
      0.6,
      1.8
    ]
  },
  "mechanism": "Signed logits become positive exponential mass; all classes use one shared total; the final probabilities occupy one fixed capacity with total 1.",
  "visual_checks": [
    "Negative logit remains distinguishable before exp",
    "All three masses contribute to the denominator",
    "Total-one constraint is visible through shared geometry",
    "Class colors and identities survive each transformation"
  ],
  "communication": {
    "audience": "\u80fd\u7406\u89e3\u52a0\u6cd5\u4e0e\u6bd4\u4f8b\u3001\u6ca1\u5b66\u8fc7 Softmax \u7684\u4e2d\u6587\u89c2\u4f17",
    "question": "\u6a21\u578b\u7ed9\u732b\u3001\u72d7\u3001\u9e1f\u4e09\u4e2a\u5206\u6570\uff0c\u600e\u6837\u628a\u5b83\u4eec\u53d8\u6210\u603b\u548c\u4e3a 1 \u7684\u6982\u7387\uff1f",
    "takeaway": "Softmax \u5148\u628a\u5206\u6570\u53d8\u6210\u6b63\u6743\u91cd\uff0c\u518d\u628a\u6bcf\u4e2a\u6743\u91cd\u9664\u4ee5\u540c\u4e00\u4e2a\u603b\u548c\uff0c\u5f97\u5230\u603b\u548c\u4e3a 1 \u7684\u6982\u7387\u3002",
    "objects": [
      "class-0 = \u732b\uff0c\u5206\u6570 -1.0",
      "class-1 = \u72d7\uff0c\u5206\u6570 0.6",
      "class-2 = \u9e1f\uff0c\u5206\u6570 1.8"
    ],
    "requirements": [
      "\u5148\u63d0\u51fa\u5206\u6570\u4e0d\u662f\u6982\u7387\u7684\u95ee\u9898\uff0c\u89e3\u91ca\u989c\u8272\u548c\u5bf9\u8c61\uff0c\u4e0d\u4ece\u672f\u8bed\u5f00\u59cb\u3002",
      "e^z \u662f\u672c\u7247\u9009\u7528\u7684\u53d8\u6362\u89c4\u5219\uff1a\u4ea7\u751f\u6b63\u6743\u91cd\u3001\u4fdd\u7559\u5927\u5c0f\u6b21\u5e8f\uff1b\u4e0d\u8981\u58f0\u79f0\u8fd9\u662f\u552f\u4e00\u53ef\u80fd\u7684\u89c4\u5219\u3002",
      "\u628a\u4e09\u4efd\u6743\u91cd\u660e\u786e\u76f8\u52a0\u6210\u540c\u4e00\u4e2a\u603b\u548c\uff0c\u89c2\u4f17\u80fd\u770b\u89c1\u5206\u6bcd\u6765\u81ea\u54ea\u91cc\u3002",
      "\u660e\u786e\u6bcf\u4e00\u4efd\u90fd\u9664\u4ee5\u8fd9\u4e2a\u603b\u548c\uff1b\u51e0\u4f55\u5c3a\u5ea6\u6539\u53d8\u65f6\u8bf4\u660e\u65b0\u5355\u4f4d\uff0c\u4e0d\u80fd\u53ea\u79fb\u52a8\u8272\u5757\u3002",
      "\u7ed3\u5c3e\u7559\u4e0b\u53ef\u8bfb\u7684\u4e2d\u6587\u7b54\u6848\u4e0e\u5360\u6ee1\u4e00\u4e2a\u6574\u4f53\u7684\u4e09\u4efd\u6982\u7387\uff1b\u820d\u5165\u540e\u7684\u7b49\u5f0f\u7528\u8fd1\u4f3c\u7b49\u53f7\u3002",
      "\u5b57\u5e55\u662f\u77ed\u7684\u56e0\u679c\u53e5\uff1b\u540c\u4e00\u65f6\u95f4\u53ea\u8bb2\u4e00\u4e2a\u52a8\u4f5c\uff0c\u4fdd\u7559\u9605\u8bfb\u505c\u987f\u3002",
      "\u7b26\u53f7\u3001\u82f1\u6587\u6216\u5149\u6548\u4e0d\u80fd\u4ee3\u66ff\u89e3\u91ca\u3002\u8ba9\u753b\u9762\u76f4\u63a5\u5c55\u793a\u5b57\u5e55\u6240\u8bf4\u7684\u64cd\u4f5c\u3002"
    ]
  }
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


