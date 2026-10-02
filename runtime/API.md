# Concept runtime (v1)

This is a small Canvas 2D drawing library, not a storyboard generator. The scene author chooses the object, composition, camera, action and timing. All samples are explicit-time and can be drawn in any order. No external dependencies or assets.

```js
import { createRuntime, tween, envelope } from './concept-runtime.mjs';
export function createScene(rt) {
  // Local revision changes these intervals without regenerating drawing infrastructure.
  const C = { secondStart: 5.2, secondEnd: 7.4 };
  const flake = rt.snowflake('flake', { depth: 1 });
  return rt.scene({ duration: 10, fps: 30, caseId: 'snowflake-rotation', shots: [{
    id: 'rotate-and-compose', start: 0, end: 10,
    camera: { x: 960, y: 500, zoom: 1 },
    draw(f, t) {
      const angle = tween(0, Math.PI / 3, t, 1.0, 2.7)
        + tween(0, Math.PI / 3, t, C.secondStart, C.secondEnd);
      f.draw(flake, { id: 'reference', x: 960, y: 460, scale: 280,
        color: '#fff', opacity: .16, layer: 10 });
      f.draw(flake, { x: 960, y: 460, scale: 280, rotation: angle });
      f.arcArrow('rotation', 960, 460, 345, -Math.PI / 2,
        -Math.PI / 2 + angle, { opacity: envelope(t, .8, 8.5) });
      f.caption('转过60°，轮廓又与原位重合', { opacity: envelope(t, .4, 4.8) });
      return { mechanism: { angle, turnDegrees: angle * 180 / Math.PI } };
    }
  }] });
}
const rt = createRuntime(document.getElementById('scene'), { width: 1920, height: 1080 });
window.C2M = createScene(rt); // meta.version = 2; render(t) returns generic evidence.
```

The example is an API illustration, not a generated candidate or accepted artwork. Choose your own composition; keep one visible action per beat and let the same object persist through its transformations. A sixfold shape's endpoint is symmetric: use a subdued ghost plus a motion arc or a highlighted arm to make the rotation visible. Colors or markers on a hexagon make its permutation identifiable; those markings are not themselves invariant.

- `createRuntime(canvas, {width,height,fps,font,caseId,timings})`: defaults dimensions to the canvas intrinsic size. Returns runtime `rt`.
- `rt.scene({duration,fps,caseId,background,shots})`: shots are contiguous `{id,start,end,draw(f, localTime),camera?,background?}` intervals covering the exact duration. `camera` is a pose or a function of local time, with `{x,y,zoom,rotation}`. It acts on world objects; screen text is independent of it. `render(t)` always draws a complete frame.
- `rt.object(id, {draw(ctx, style), bounds:{x,y,width,height},kind?,geometry?})`: reusable custom object in local coordinates. Identity and geometry persist; animation is provided as a pose when drawing. `draw` must be deterministic and must not keep animation state. Bounds are required declarations, not verified against all pixels.
- `rt.snowflake(id,{depth:0|1|2,color?,glow?})`: recursive sixfold line geometry in unit coordinates. Style override `reveal` draws 0..1 of total path length, `lineWidth` is in object units.
- `rt.hexagon(id,{colors?,marker?})`: six colored sectors in unit coordinates, with an optional top-vertex marker. An explicit diagnostic object, not an invariant colored snowflake.
- `f.draw(object,{id?,x?,y?,scale?,scaleX?,scaleY?,rotation?,opacity?,layer?,screen?,...style})`: pose is in pixels/radians; default scale is 1. `scaleX`/`scaleY` override uniform scale. To reflect, set `scaleX:-scale`, `scaleY:scale`; combine with rotation without replacing object identity. Extra instances (e.g. ghost) require unique `id`. Returns the original object. Default layer 20. Returned evidence records source identity, pose and local geometry.
- `f.text(id,text,x,y,{size?,font?,weight?,align?,color?,opacity?,screen?,layer?})`: measured text bounds; default world space, baseline coordinate. Returns measured width.
- `f.caption(text,{id?,size?,opacity?,...textStyle})`: screen overlay, layer 100, centered in subtitle area. Overwide text produces `caption_too_wide` evidence. It does not automatically wrap or shrink text.
- `f.line(id,x1,y1,x2,y2,{color?,width?,dash?,opacity?,layer?})`: world line.
- `f.arcArrow(id,cx,cy,radius,startAngle,endAngle,{color?,width?,opacity?,layer?})`: world-space signed rotation arc and arrowhead. Zero angle draws nothing.
- `f.raw(id,draw(ctx,f),bounds,style)`: Canvas escape hatch; no mandatory snowflake or numerical protocol. Default world space, `screen:true` disables camera. Supply conservative bounds and deterministic draw code. Runtime records these declared bounds; independent rendering/review is still necessary.
- `f.safe`: recommended composition area `{x,y,width,height,subtitleY,subtitleWidth}`. It is guidance, not an enforced template. Keep focal objects away from subtitle area; custom layout remains possible.
- `progress(t,start,end,easing= ease.smooth)`, `tween(a,b,t,start,end,easing)` and `envelope(t,start,end,fade=.25)`: clamped deterministic time functions. `ease` exports `linear`, `smooth`, `cubic`, `out`.
- `composeD6(a,b)`: exact D6 composition, **a after b**; element `{r:integer,f:0|1}` maps vertex `j` to `r + (-1)^f j mod 6`. `d6Permutation(element)` returns the vertex mapping. This checks action algebra, not whether the viewer understands it.

`render(t)` returns `{time,requestedTime,stage,shot,camera,bounds,objects,findings,...sceneEvidence}`. The runtime fixes `stage` to the current shot ID. Place concept-specific truth under `mechanism`; validators should recompute it independently. Every active instance has a stable frame ID, and bounds include camera and pose transforms. For duplicated instances `sourceId` identifies the shared object. A passing runtime test or numerical contract is never artistic acceptance.


## Named timing overrides

Register action intervals once in the authored scene. The host may then pass a JSON timing dictionary when creating its runtime, without changing scene source or calling a model:

```js
// Host: this data can come from timing.json, loaded by the preview coordinator.
const rt = createRuntime(canvas, {
  width: 1920, height: 1080,
  timings: { 'turn-two': { start: 4.85, end: 6.85 } }
});

// Scene module: register defaults, then derive pose and attached markers from T.
const T = rt.timings({
  'turn-one': { start: .8, end: 2.8 },
  'turn-two': { start: 5.2, end: 7.2 }
});
const firstAngle = tween(0, Math.PI / 3, t, T['turn-one'].start, T['turn-one'].end);
const secondAngle = tween(0, Math.PI / 3, t, T['turn-two'].start, T['turn-two'].end);
// Draw the original object at rotation: firstAngle + secondAngle.
```

`rt.timings(definitions)` returns a frozen dictionary of frozen effective `{start,end}` values. Definitions require both fields, finite numbers and `end > start`. Overrides may provide just one endpoint; the merged interval must remain valid. Input dictionaries are copied and never mutated. Multiple registration groups may have disjoint IDs; re-registering an ID fails. Empty definitions, empty or whitespace IDs, empty interval records, unknown interval fields, nonfinite values and reversed intervals fail. An empty override dictionary means no changes, preserving existing sources.

Override IDs are checked against all registered groups when `rt.scene(...)` is created, so a valid ID in a later group is not rejected prematurely. Unregistered IDs fail at that point. Register all timings before creating a scene; later registration fails. `scene.meta.timings` records the effective intervals; existing sources that do not register timings get `{}`. Rendering still depends only on explicit time. The runtime does not load files or monitor JSON itself: the host supplies the overrides on scene construction.

This is a named parameter mechanism. It does not guarantee that an author used every timing value faithfully, that attached annotations stay synchronized, or that the revision improves the artwork. Independently compare trajectories, source hashes, unchanged-region pixels and visual evidence. Adapting an existing source to registered timings is a separate recorded change, not a zero-model timing edit.
