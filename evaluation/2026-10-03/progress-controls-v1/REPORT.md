# Explicit reveal controls · progress-controls-v1

These are hand-authored engineering controls. They are not model-generated videos, teaching exemplars or artistic approvals. Expected outcomes and all source/tooling hashes were frozen before rendering.

Actual exports/full decodes: 16/16. Expected technical outcomes: 15/16. Batch wall time 17.357s; model calls 0.

| Fixture | Expected | Actual findings | Match |
|---|---|---|---|
| residual-forged-geometry | wrong_vector_geometry | pixel_mismatch, wrong_merge, wrong_vector_geometry | True |
| residual-invisible-output | invisible_required_vector | invisible_required_vector | True |
| residual-never-finished | incomplete_vector_reveal | incomplete_vector_reveal | True |
| residual-no-timeline | reveal_timeline_required | invisible_required_vector, pixel_mismatch, reveal_timeline_required | True |
| residual-reveal-correct | pass | pixel_mismatch | False |
| residual-wrong-merge | wrong_merge | pixel_mismatch, wrong_merge | True |
| residual-wrong-target | wrong_vector_target | pixel_mismatch, wrong_merge, wrong_vector_geometry, wrong_vector_target | True |
| residual-zero-output | pass | pass | True |
| softmax-affine-target | wrong_mass_geometry | wrong_mass_geometry | True |
| softmax-forged-width | wrong_mass_reveal | pixel_mismatch, wrong_mass_reveal | True |
| softmax-hidden-partition | invisible_partition | invisible_partition | True |
| softmax-never-finished | incomplete_mass_reveal | incomplete_mass_reveal | True |
| softmax-opacity-groups | pass | pass | True |
| softmax-overpaint | pixel_mismatch | pixel_mismatch | True |
| softmax-phase-overlap | text_overlap | text_overlap | True |
| softmax-staggered-reveal | pass | pass | True |

The first version rejected the correct partial-vector control because short subpixel strokes were compared to an opaque pure-color pixel reference. The second version explicitly marks such probes unavailable, while still independently checking target values, partial geometry, completion, final visibility, joins and available stable pixels. Neither archive is overwritten.

Correct zero outputs render a visible dot. Timeline gaps, wrong targets, forged geometry, incomplete final reveals, invisible outputs/partitions, wrong joins, bar-width offsets, pixel overwrites and overlapping phase captions remain negative controls.

[Frozen plan and expected labels](plan.json) · [Full results and sources](results.json) · [Source/tooling hashes](frozen.json)

The independent validator does not import the runtime timeline utility. A correct target is not enough: actual partial geometry must agree with reveal, reveal requires a valid timeline, and required objects must be complete and visible in settled phases. Pixel availability is reported separately and unavailable probes never count as verified pixels.

Unit checks use a simulated Canvas and are separate from these actual browser/FFmpeg runs. Installation is reused, not newly tested. The root coding agent may inspect frames but does not assign independent artistic quality or student comprehension.
