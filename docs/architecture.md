# Architecture direction

The control loop is: brief → mechanism contract → storyboard / candidate → local render → numerical and visual evidence → targeted revision → retained version.

The author can be the current Codex desktop session or the official CLI. The renderer and validator are ordinary local programs. This makes the loop usable with subscription authentication and gives a stable boundary for later API providers.

## Four boundaries

1. **Mechanism**: numerical state and invariants, separate from visual styling. Softmax shares a denominator; residual paths preserve identity; GRU gating combines old and candidate state according to an explicitly named convention.
2. **Scene**: stable object identities, time in seconds, camera and transition intent. Begin with renderer-specific source plus a portable brief; a universal DSL is deferred.
3. **Evidence**: exact input, source hash, renderer/dependency versions, failures, frames, mathematical checks and review verdict. Review can request a local revision rather than regenerate the full scene.
4. **Execution**: Codex authoring and review, deterministic render tools, bounded revision budgets and checkpointed artifacts. Generated code runs within the selected workspace sandbox. A static AST blacklist plus process resource limits is not a complete isolation boundary.

## Reference adoption hypotheses

| Reference | Potential reuse | Evidence needed before adoption |
|---|---|---|
| Paper2Manim | Per-scene repair, error classification, sampled visual review, successful/failed episodes | Actual generations with visual review and an ablation without review; license provenance before vendoring |
| OpenMotion | Editable component specs, project snapshots, standalone HTML, reusable motion presets | Runtime edit/restore checks, export timing and layouts suitable for mechanisms |
| Existing Three.js study | Deterministic frame-time rendering and network visual primitives | Extract after API and benchmark needs stabilize; keep original work separate |

Neither reference is selected as the foundation yet. Offline tests are useful for feasibility but cannot decide artistic quality.

## Evaluation protocol

Use the same case and constraints for each capable candidate; record an unsupported case explicitly. Start with Softmax before testing residual and GRU. Use three independent model runs per case for exploratory comparison, with a fixed renderer version, bounded repair budget (two technical, two visual revisions) and frozen prompt. Small samples are exploratory.

Record separately: first render success, final render success, invariant failures, clipping/overlap, mechanism readability, continuity and pacing, revision count, human interventions, wall time, model usage and local rendering time. Preserve failed attempts. Visual verdicts should describe evidence at timestamps; a rubric score alone is insufficient.
