# Explicit reveal evidence and settled phases

Status: design before implementation and model evaluation. The old v1/v2 records
keep their original validators and results.

The v2 residual C1 source draws correction values as `residual[i] * progress` while
its mechanism registry reports the full target value. Its checker finds wrong
geometry from 4.5 to 8.625 seconds, although the final signed displacement is right.
V2 residual C2 has a different fault: its head-to-tail merge is wrong through
18 seconds. These must not be conflated or fixed by accepting every transition.

Introduce an explicit `reveal` parameter on mathematical drawing primitives. The
passed value/width remains the intended target. The helper records that target,
the finite progress, and the actual partial geometry produced by that same call.
The checker independently validates target math and actual target × reveal
geometry. It cannot interpret an arbitrary small `value` as a reveal: old code
that multiplies the target before passing it remains wrong under the old rule.

Reveals require a declared stage timeline in metadata. Its exact expected stage
order, contiguous duration, positive spans and a minimum settled interval are
validated independently. By each relevant phase's `settledAt`, required primitives
must be fully revealed and visible. Identity/correction must remain complete by
the final residual phase; partial output reveal compares the full intended sum
before completion and the actual endpoints after completion. A never-finished or
invisible output cannot pass. Endpoint joins and wrong targets remain failures.

Add a small explicit-time timeline utility; authors supply its intervals and
settled times. It has no coordinates, captions or storyboard content. Expose an
opacity group to reduce the chance that a later frame accidentally redraws every
earlier caption. This does not guarantee artistic quality or choose what to hide.

Keep ID namespace repair separately measured: the earlier dependency replay
changed only the adapter and recovered four exports. Do not count those videos
as evidence that this later transition contract improves model quality.

Before a new model experiment, create and freeze controlled cases:

| Control | Expected |
|---|---|
| Partial negative vector, correct target and explicit reveal | Allowed before settled time; target still checked |
| Wrong target concealed by a reveal | Mathematical failure |
| Correct target but forged actual endpoint | Geometry failure |
| Reveals without a valid timeline | Failure, no blanket exemption |
| Zero or unfinished reveal at final hold | Incomplete evidence failure |
| Correct residual sum at wrong origin | Merge failure persists |
| Partially revealed exponential bars with correct targets | Target-only evidence before completion |
| Additive target bar-width bias | Proportion failure |
| Correct registry overwritten by another color | Pixel mismatch |
| Stage groups fade out old captions | Bounds include effective opacity; original registry not manually suppressed |

All new controls are hand-authored engineering fixtures, not model outputs or
accepted teaching animations. Actual deterministic renders and full decode are
separate from unit/mock checks. New model tests will compare fixed methods under
the same task, author/retry budgets, runtime and judge evidence access; no old
source or verdict is overwritten. A paper-inspired temporal diagnostic is not a
reproduction of its dataset or reported numbers.
