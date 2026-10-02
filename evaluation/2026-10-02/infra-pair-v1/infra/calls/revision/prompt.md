Apply this concrete feedback as a minimal exact-match edit to scene.mjs.
Return only the patch JSON. Do not use tools, read files or invoke another model.
Do not regenerate the scene, change unrelated visuals, or weaken evidence/validators.
The old string of each edit must occur exactly once. sha256 is the current file hash.
Feedback: 只把第二次 60° 旋转整体提前 0.35 秒：起止从 5.2–7.2 秒改为 4.85–6.85 秒，旋转时长保持 2 秒；直接依附此动作的箭头或动作标记同步提前。其余物体、配色、几何、第一段动作、字幕内容、运镜与总时长保持原样。终点留到 10 秒，因此第二次旋转后的观看停顿多 0.35 秒。
Current sha256: 85f1f759507e40147b1b559c759f99e9efab4d182a503d40d84374dec7d63e50
Current scene.mjs:
import { tween, envelope } from './runtime/concept-runtime.mjs';

const C = { firstStart: 0.8, firstEnd: 2.8, secondStart: 5.2, secondEnd: 7.2 };
const STEP = Math.PI / 3;
const TOP = -Math.PI / 2;
const vertices = Array.from({ length: 6 }, (_, i) => ({
  x: Math.cos(TOP + i * STEP),
  y: Math.sin(TOP + i * STEP)
}));

export function createScene(rt) {
  const flake = rt.object('six-armed-crystal', {
    kind: 'sixfold-snowflake',
    geometry: { vertices },
    bounds: { x: -1.04, y: -1.04, width: 2.08, height: 2.08 },
    draw(ctx, style) {
      ctx.strokeStyle = style.color || '#bce7ec';
      ctx.lineWidth = style.lineWidth || 0.009;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash(style.ghost ? [0.018, 0.018] : []);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(TOP + i * STEP);
        ctx.moveTo(0, 0);
        ctx.lineTo(1, 0);
        for (const [position, length] of [[0.38, 0.22], [0.62, 0.23], [0.82, 0.14]]) {
          for (const side of [-1, 1]) {
            ctx.moveTo(position, 0);
            ctx.lineTo(position - length * 0.5, side * length * Math.sqrt(3) / 2);
          }
        }
        ctx.moveTo(0.88, 0);
        ctx.lineTo(0.94, -0.035);
        ctx.lineTo(1, 0);
        ctx.lineTo(0.94, 0.035);
        ctx.closePath();
        ctx.restore();
      }
      ctx.stroke();
    }
  });
  const tracer = rt.object('branch-tracer', {
    kind: 'tracking-marker',
    bounds: { x: -0.04, y: -1.04, width: 0.08, height: 0.37 },
    draw(ctx) {
      ctx.strokeStyle = '#edb975';
      ctx.lineWidth = 0.013;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -0.71);
      ctx.lineTo(0, -0.94);
      ctx.stroke();
      ctx.fillStyle = '#edb975';
      ctx.beginPath();
      ctx.arc(0, -1, 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return rt.scene({
    duration: 10, fps: 24, caseId: 'symmetry-compose-10s',
    background: '#101c29',
    shots: [{
      id: 'two-turns-one-outline', start: 0, end: 10,
      camera: { x: 960, y: 540, zoom: 1 },
      draw(f, t) {
        const first = tween(0, STEP, t, C.firstStart, C.firstEnd);
        const second = tween(0, STEP, t, C.secondStart, C.secondEnd);
        const angle = first + second;
        const x = 960, y = 445, scale = 300;
        f.draw(flake, {
          id: 'original-outline', x, y, scale, rotation: 0,
          color: '#7b91a7', opacity: 0.55, lineWidth: 0.006,
          ghost: true, layer: 10
        });
        f.draw(flake, { x, y, scale, rotation: angle, layer: 20 });
        f.draw(tracer, { x, y, scale, rotation: angle, layer: 30 });
        f.arcArrow('first-turn', x, y, 352, TOP, TOP + first, {
          color: '#7daebd', width: 3, opacity: envelope(t, C.firstStart, 10), layer: 35
        });
        f.arcArrow('second-turn', x, y, 352, TOP + STEP, TOP + STEP + second, {
          color: '#edb975', width: 3, opacity: envelope(t, C.secondStart, 10), layer: 35
        });
        const label = (id, text, a, opacity, color) => f.text(
          id, text, x + 402 * Math.cos(a), y + 402 * Math.sin(a) + 10,
          { size: 27, align: 'center', color, opacity }
        );
        label('first-angle', '60°', TOP + STEP / 2,
          envelope(t, C.firstStart, 10), '#7daebd');
        label('second-angle', '+60°', TOP + STEP * 1.5,
          envelope(t, C.secondStart, 10), '#edb975');
        f.text('caption', '每转 60°，雪花轮廓又与原位重合', 960, 883, {
          size: 34, align: 'center', color: '#d8e5e9',
          screen: true, opacity: envelope(t, 0.25, 10)
        });
        f.text('composition', '60° + 60° = 120°', 960, 943, {
          size: 30, align: 'center', color: '#edb975',
          screen: true, opacity: envelope(t, 7.4, 10)
        });
        return {
          mechanism: {
            angle, referenceAngle: 0,
            vertices: vertices.map(({ x, y }) => ({ x, y }))
          }
        };
      }
    }]
  });
}

Frozen interface (if present):
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

- `createRuntime(canvas, {width,height,fps,font,caseId})`: defaults dimensions to the canvas intrinsic size. Returns runtime `rt`.
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

